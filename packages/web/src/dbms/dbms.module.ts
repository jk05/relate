import {Module} from '@nestjs/common';

import {DBMSResolver} from './dbms.resolver';
import {AccountModule} from '../tmp_accounts';

@Module({
    exports: [],
    imports: [AccountModule],
    providers: [DBMSResolver],
})
export class DBMSModule {}
