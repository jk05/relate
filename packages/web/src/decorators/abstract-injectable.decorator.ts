import {Injectable, InjectableOptions} from '@nestjs/common';

export interface IAbstractInjectableOptions extends InjectableOptions {
    provider: any;
}

export function AbstractInjectable(options: IAbstractInjectableOptions) {
    return function decorate(...args: any): any {
        const [target] = args;

        Injectable(options)(target);

        target.provide = options.provider;
        target.useClass = target;

        return target;
    };
}
