import {LAUNCH_TOKEN_PARAMETER} from './extension.constants';

export function createAppLaunchUrl(appRoot: string, launchToken?: string): string {
    return launchToken ? `${appRoot}?${LAUNCH_TOKEN_PARAMETER}=${launchToken}` : appRoot;
}
