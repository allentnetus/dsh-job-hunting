import type { Context } from '@deepseek-ai/cordis';
import type { JobHuntingConfig } from './config/default-config.js';
export declare const name = "dsh-job-hunting";
export declare const inject: readonly ['tools', 'skills', 'workspaceRegistry'];
export declare const Config: {
    readonly '~standard': {
        readonly version: 1;
        readonly vendor: 'dsh-job-hunting';
        readonly validate: (value: unknown) => {
            value: JobHuntingConfig;
            issues?: never;
        } | {
            value?: never;
            issues: {
                message: string;
            }[];
        };
    };
};
export declare const apply: (ctx: Context, configInput?: unknown) => (() => void);
