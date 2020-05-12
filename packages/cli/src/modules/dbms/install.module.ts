import {OnApplicationBootstrap, Module, Inject} from '@nestjs/common';
import {SystemModule, SystemProvider} from '@relate/common';
import path from 'path';
import fse from 'fs-extra';

import InstallCommand from '../../commands/dbms/install';

@Module({
    exports: [],
    imports: [SystemModule],
    providers: [],
})
export class InstallModule implements OnApplicationBootstrap {
    constructor(
        @Inject('PARSED_PROVIDER') protected readonly parsed: ParsedInput<typeof InstallCommand>,
        @Inject('UTILS_PROVIDER') protected readonly utils: CommandUtils,
        @Inject(SystemProvider) protected readonly systemProvider: SystemProvider,
    ) {}

    async onApplicationBootstrap(): Promise<void> {
        const {args, flags} = this.parsed;
        const {name} = args;
        const {environment: environmentId, credentials} = flags;
        let {version} = flags;
        const environment = await this.systemProvider.getEnvironment(environmentId);

        if (!name || !credentials || !version) {
            // @todo: figure this out in combination with TTY
            throw new Error(`Not yet implemented`);
        }

        const pathVersion = path.resolve(version);
        if (await fse.pathExists(pathVersion)) {
            version = pathVersion;
        }

        return environment.installDbms(name, credentials, version).then((res) => {
            this.utils.log(res);
        });
    }
}