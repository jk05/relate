import path from 'path';
import envPaths from 'env-paths';
import {spawn} from 'child_process';
import {access, constants} from 'fs';

import {AccountProvider} from './account.provider';
import {AbstractInjectable} from '../decorators';

const neo4j = (dbmsID: string, command: string) =>
    new Promise<boolean>((resolve, reject) => {
        const {config: configPath} = envPaths('daedalus', {suffix: ''});
        const neo4jPath = path.join(configPath, 'neo4jDBMS', dbmsID, 'bin', 'neo4j');

        access(neo4jPath, constants.X_OK, (err: NodeJS.ErrnoException | null) => {
            if (err) {
                reject(err);
                return;
            }

            const neo4jCommand = spawn(neo4jPath, [command]);

            const log = (data: Buffer) => console.log(data.toString());
            neo4jCommand.stderr.on('data', log);
            neo4jCommand.stderr.on('error', reject);
            neo4jCommand.stderr.on('close', reject);
            neo4jCommand.stderr.on('end', reject);

            neo4jCommand.stdout.on('data', log);
            neo4jCommand.stdout.on('error', reject);
            neo4jCommand.stdout.on('close', () => resolve(true));
            neo4jCommand.stdout.on('end', () => resolve(true));
        });
    });

@AbstractInjectable({
    provider: AccountProvider,
})
export class LocalAccountProvider extends AccountProvider {
    startDBMS(uuid: string): Promise<boolean> {
        return neo4j(uuid, 'start');
    }

    stopDBMS(uuid: string): Promise<boolean> {
        return neo4j(uuid, 'stop');
    }

    statusDBMS(uuid: string): Promise<boolean> {
        return neo4j(uuid, 'status');
    }
}
