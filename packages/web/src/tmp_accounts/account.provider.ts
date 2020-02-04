import {NotImplementedError} from '../errors';

export abstract class AccountProvider {
    startDBMS(_: string): Promise<boolean> {
        throw new NotImplementedError('startDBMS not implemented');
    }

    stopDBMS(_: string): Promise<boolean> {
        throw new NotImplementedError('stopDBMS not implemented');
    }

    statusDBMS(_: string): Promise<boolean> {
        throw new NotImplementedError('statusDBMS not implemented');
    }
}
