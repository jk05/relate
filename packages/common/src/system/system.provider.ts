import path from 'path';
import {Injectable, OnModuleInit} from '@nestjs/common';
import fse from 'fs-extra';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import {coerce} from 'semver';

import {
    DEFAULT_ENVIRONMENT_NAME,
    JSON_FILE_EXTENSION,
    JWT_INSTANCE_TOKEN_SALT,
    DBMS_DIR_NAME,
    RELATE_KNOWN_CONNECTIONS_FILE,
    TWENTY_FOUR_HOURS_SECONDS,
    EXTENSION_DIR_NAME,
    EXTENSION_TYPES,
} from '../constants';
import {
    ENVIRONMENT_TYPES,
    EnvironmentAbstract,
    ENVIRONMENTS_DIR_NAME,
    createEnvironmentInstance,
} from '../environments';
import {
    NotFoundError,
    ValidationFailureError,
    TargetExistsError,
    InvalidArgumentError,
    NotSupportedError,
    AmbiguousTargetError,
    ExtensionExistsError,
} from '../errors';
import {EnvironmentConfigModel, AppLaunchTokenModel, IAppLaunchToken} from '../models';
import {
    envPaths,
    getSystemAccessToken,
    registerSystemAccessToken,
    isValidUrl,
    isValidPath,
    extractExtension,
    arrayHasItems,
    discoverExtensionDistributions,
    IExtensionMeta,
} from '../utils';
import {ensureDirs, ensureFiles} from './files';

@Injectable()
export class SystemProvider implements OnModuleInit {
    protected readonly dataPaths = {
        ...envPaths(),
        dbmss: path.join(envPaths().data, DBMS_DIR_NAME),
        environments: path.join(envPaths().config, ENVIRONMENTS_DIR_NAME),
        extensions: path.join(envPaths().data, EXTENSION_DIR_NAME),
    };

    protected readonly cachePaths = {
        dbmss: path.join(envPaths().cache, DBMS_DIR_NAME),
        extensions: path.join(envPaths().cache, EXTENSION_DIR_NAME),
    };

    protected readonly filePaths = {
        knownConnections: path.join(envPaths().data, RELATE_KNOWN_CONNECTIONS_FILE),
    };

    protected readonly allEnvironments: Map<string, EnvironmentAbstract> = new Map<string, EnvironmentAbstract>();

    async onModuleInit(): Promise<void> {
        await ensureDirs(this.dataPaths);
        await ensureDirs(this.cachePaths);
        await ensureFiles(this.filePaths);
        await this.discoverEnvironments();
    }

    async getEnvironment(uuid?: string): Promise<EnvironmentAbstract> {
        await this.discoverEnvironments();

        const environment = this.allEnvironments.get(uuid ? uuid : DEFAULT_ENVIRONMENT_NAME);

        if (!environment) {
            throw new NotFoundError(`Environment "${uuid}" not found`);
        }

        return environment;
    }

    async registerAccessToken(
        environmentId: string,
        dbmsId: string,
        dbmsUser: string,
        accessToken: string,
    ): Promise<string> {
        await registerSystemAccessToken(this.filePaths.knownConnections, environmentId, dbmsId, dbmsUser, accessToken);

        return accessToken;
    }

    async getAccessToken(environmentId: string, dbmsId: string, dbmsUser: string): Promise<string> {
        const environment = await this.getEnvironment(environmentId);
        const dbms = await environment.getDbms(dbmsId);
        const token = await getSystemAccessToken(this.filePaths.knownConnections, environment.id, dbms.id, dbmsUser);

        if (!token) {
            throw new NotFoundError(`No Access Token found for user "${dbmsUser}"`);
        }

        return token;
    }

    async initInstallation(): Promise<void> {
        await ensureDirs(this.dataPaths);
        await ensureFiles(this.filePaths);
        const defaultEnvironmentPath = path.join(
            this.dataPaths.config,
            ENVIRONMENTS_DIR_NAME,
            DEFAULT_ENVIRONMENT_NAME + JSON_FILE_EXTENSION,
        );

        const defaultEnvironmentExists = await fse.pathExists(defaultEnvironmentPath);
        if (this.allEnvironments.get(DEFAULT_ENVIRONMENT_NAME) || defaultEnvironmentExists) {
            throw new TargetExistsError(`Environment "${DEFAULT_ENVIRONMENT_NAME}" exists, will not overwrite`);
        }

        const config = {
            dbmss: {},
            id: DEFAULT_ENVIRONMENT_NAME,
            neo4jDataPath: this.dataPaths.data,
            type: ENVIRONMENT_TYPES.LOCAL,
            user: 'local',
        };
        const configModel = new EnvironmentConfigModel(config);
        const defaultEnvironment = await createEnvironmentInstance(configModel, defaultEnvironmentPath);

        await fse.writeJSON(defaultEnvironmentPath, config, {spaces: 2});
        this.allEnvironments.set(DEFAULT_ENVIRONMENT_NAME, defaultEnvironment);
    }

    private async discoverEnvironments(): Promise<void> {
        this.allEnvironments.clear();
        const environmentsDir = path.join(this.dataPaths.config, ENVIRONMENTS_DIR_NAME);
        const availableFiles = await fse.readdir(environmentsDir);
        const availableEnvironments = _.filter(
            availableFiles,
            (environment) => path.extname(environment).toLocaleLowerCase() === JSON_FILE_EXTENSION,
        );

        await Promise.all(
            _.map(availableEnvironments, async (environment) => {
                const configPath = path.join(environmentsDir, environment);
                const config = await fse.readJSON(configPath);
                const environmentConfig: EnvironmentConfigModel = new EnvironmentConfigModel({
                    ...config,
                    neo4jDataPath: config.neo4jDataPath || this.dataPaths.data,
                });

                this.allEnvironments.set(
                    `${environmentConfig.id}`,
                    await createEnvironmentInstance(environmentConfig, configPath),
                );
            }),
        );
    }

    createAppLaunchToken(
        environmentId: string,
        appId: string,
        dbmsId: string,
        principal: string,
        accessToken: string,
    ): Promise<string> {
        const jwtTokenSalt = `${JWT_INSTANCE_TOKEN_SALT}-${appId}`;
        const validated = JSON.parse(
            JSON.stringify(
                new AppLaunchTokenModel({
                    accessToken,
                    environmentId,
                    appId,
                    dbmsId,
                    principal,
                }),
            ),
        );

        return new Promise((resolve, reject) => {
            jwt.sign(validated, jwtTokenSalt, {expiresIn: TWENTY_FOUR_HOURS_SECONDS}, (err, token) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(token);
            });
        });
    }

    parseAppLaunchToken(appId: string, launchToken: string): Promise<IAppLaunchToken> {
        const jwtTokenSalt = `${JWT_INSTANCE_TOKEN_SALT}-${appId}`;

        return new Promise((resolve, reject) => {
            jwt.verify(launchToken, jwtTokenSalt, (err: any, decoded: any) => {
                if (err) {
                    reject(new ValidationFailureError('Failed to decode App Launch Token'));
                    return;
                }

                if (decoded.appId !== appId) {
                    reject(new ValidationFailureError('App Launch Token mismatch'));
                    return;
                }

                try {
                    resolve(
                        new AppLaunchTokenModel({
                            accessToken: decoded.accessToken,
                            appId: decoded.appId,
                            dbmsId: decoded.dbmsId,
                            environmentId: decoded.environmentId,
                            principal: decoded.principal,
                        }),
                    );
                    return;
                } catch (e) {
                    if (e instanceof ValidationFailureError) {
                        reject(e);
                        return;
                    }

                    reject(new ValidationFailureError('Invalid App Launch Token'));
                }
            });
        });
    }

    async listInstalledExtensions(): Promise<IExtensionMeta[]> {
        const all = await Promise.all(
            _.flatMap(_.values(EXTENSION_TYPES), (type) =>
                discoverExtensionDistributions(path.join(this.dataPaths.data, EXTENSION_DIR_NAME, type)),
            ),
        );

        return _.flatten(all);
    }

    async installExtension(name: string, version = '*'): Promise<IExtensionMeta> {
        if (!version) {
            throw new InvalidArgumentError('Version must be specified');
        }

        const extensionDistributions = path.join(this.dataPaths.cache, EXTENSION_DIR_NAME);
        const extensionTarget = path.join(this.dataPaths.data, EXTENSION_DIR_NAME);

        // version as a URL.
        if (isValidUrl(version)) {
            throw new NotSupportedError(`fetch and install extension ${name}@${version}`);
        }

        const coercedVersion = version === '*' || (coerce(version) && coerce(version)!.version);

        if (coercedVersion && !isValidPath(version)) {
            const {version: semver} = coerce(version) || {};
            const requestedDistribution = _.find(
                await discoverExtensionDistributions(extensionDistributions),
                (dist) => {
                    if (dist.name !== name) {
                        return false;
                    }

                    if (version === '*') {
                        return dist.version === '*';
                    }

                    return dist.version === semver;
                },
            );

            // if cached version of extension doesn't exist, attempt to download
            if (!requestedDistribution) {
                throw new NotSupportedError(`fetch and install ${name}@${version}`);
            }

            return this.installRelateExtension(requestedDistribution, extensionTarget, requestedDistribution.dist);
        }

        // version as a file path.
        if ((await fse.pathExists(version)) && (await fse.stat(version)).isFile()) {
            const discovered = await extractExtension(version, extensionDistributions);

            return this.installRelateExtension(discovered, extensionTarget, discovered.dist);
        }

        throw new InvalidArgumentError('Provided version argument is not valid semver, url or path.');
    }

    private async installRelateExtension(
        extension: IExtensionMeta,
        extensionsDir: string,
        extractedDistPath: string,
    ): Promise<IExtensionMeta> {
        const target = path.join(extensionsDir, extension.type, extension.name);

        if (!(await fse.pathExists(extractedDistPath))) {
            throw new AmbiguousTargetError(`Path to extension does not exist "${extractedDistPath}"`);
        }

        if (await fse.pathExists(target)) {
            throw new ExtensionExistsError(`${extension.name} is already installed`);
        }

        await fse.copy(extractedDistPath, target);

        return extension;
    }

    async uninstallExtension(name: string): Promise<IExtensionMeta[]> {
        const installedExtensions = await this.listInstalledExtensions();
        const targets = _.filter(installedExtensions, (ext) => ext.name === name);

        if (!arrayHasItems(targets)) {
            throw new InvalidArgumentError(`Extension ${name} is not installed`);
        }

        return Promise.all(
            _.map(targets, async (ext) => {
                await fse.remove(ext.dist);

                return ext;
            }),
        );
    }
}