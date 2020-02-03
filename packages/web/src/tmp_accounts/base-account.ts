export abstract class BaseAccount {
    abstract startDBMS(identifier: string): Promise<boolean>;
    abstract stopDBMS(identifier: string): Promise<boolean>;
    abstract statusDBMS(identifier: string): Promise<boolean>;
}
