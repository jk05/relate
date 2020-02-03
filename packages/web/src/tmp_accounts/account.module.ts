import {Module} from '@nestjs/common';

import {AccountProvider} from './local-account.provider';

@Module({
    exports: [AccountProvider],
    imports: [],
    providers: [AccountProvider],
})
export class AccountModule {}
