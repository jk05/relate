import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {GraphQLModule} from '@nestjs/graphql';

import {DBMSModule} from './dbms';
import {AppsModule} from './apps';

import configuration from './configs/dev.config';

export interface IWebModuleConfig {
    host: string;
    port: number;
    staticFileRoot: string;
    staticHTTPRoot: string;
}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        DBMSModule,
        GraphQLModule.forRoot({
            autoSchemaFile: 'schema.graphql',
            installSubscriptionHandlers: true,
        }),
        AppsModule,
    ],
})
export class WebModule {}
