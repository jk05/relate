import {Module} from '@nestjs/common';

import {DBMSResolver} from './dbms.resolver';
import {AccountModule, AccountProvider, LocalAccountProvider} from '../tmp_accounts';

@Module({
    exports: [],
    imports: [AccountModule],
    providers: [
        DBMSResolver,
        {
            // @todo: this is probably not dynamic enough?
            provide: AccountProvider,
            useClass: LocalAccountProvider,
        },
    ],
})
export class DBMSModule {}
