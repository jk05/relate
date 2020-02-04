import {Module} from '@nestjs/common';

import {DBMSResolver} from './dbms.resolver';
import {AccountModule, LocalAccountProvider} from '../tmp_accounts';

@Module({
    exports: [],
    imports: [AccountModule],
    providers: [DBMSResolver, LocalAccountProvider],
})
export class DBMSModule {}
