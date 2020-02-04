import {Module} from '@nestjs/common';

import {LocalAccountProvider} from './local-account.provider';

@Module({
    exports: [LocalAccountProvider],
    imports: [],
    providers: [LocalAccountProvider],
})
export class AccountModule {}
