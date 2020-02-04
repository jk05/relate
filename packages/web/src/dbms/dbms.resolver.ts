import {Resolver, Args, Mutation, Query} from '@nestjs/graphql';
import {HttpException, HttpStatus, Inject} from '@nestjs/common';

import {AccountProvider} from '../tmp_accounts';

@Resolver(() => String)
export class DBMSResolver {
    constructor(@Inject(AccountProvider) protected readonly account: AccountProvider) {}

    @Query(() => Boolean)
    statusDBMS(@Args('identifier') identifier: string): Promise<boolean> {
        return this.account.statusDBMS(identifier).catch((err) => {
            throw new HttpException(err, HttpStatus.FORBIDDEN);
        });
    }

    @Mutation(() => Boolean)
    startDBMS(@Args('identifier') identifier: string): Promise<boolean> {
        return this.account.startDBMS(identifier).catch((err) => {
            throw new HttpException(err, HttpStatus.FORBIDDEN);
        });
    }

    @Mutation(() => Boolean)
    stopDBMS(@Args('identifier') identifier: string): Promise<boolean> {
        return this.account.stopDBMS(identifier).catch((err) => {
            throw new HttpException(err, HttpStatus.FORBIDDEN);
        });
    }
}
