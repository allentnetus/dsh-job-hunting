export declare const DEFAULT_BROWSER_ALLOWED_DOMAINS: readonly ['www.51job.com', 'www.zhipin.com', 'www.liepin.com', 'www.zhaopin.com', 'www.iguopin.com'];
export declare const defaultConfig: {
    readonly outputDir: 'job-hunting-site';
    readonly schedule: {
        readonly enabled: false;
        readonly mode: 'session-reminder';
        readonly time: '08:00';
        readonly timezone: 'Asia/Shanghai';
    };
    readonly browserSkill: {
        readonly enabled: true;
        readonly executable: 'bsk';
        readonly mode: 'read-only';
        readonly allowedDomains: readonly ["www.51job.com", "www.zhipin.com", "www.liepin.com", "www.zhaopin.com", "www.iguopin.com"];
        readonly additionalAllowedDomains: readonly [];
        readonly requireUserApproval: true;
        readonly maxItemsPerRun: 50;
        readonly minIntervalMs: 1000;
    };
    readonly desktopShortcut: {
        readonly enabled: true;
        readonly name: 'Job Hunting';
        readonly requireApproval: true;
    };
};
export type JobHuntingConfig = {
    outputDir: string;
    schedule: {
        enabled: boolean;
        mode: 'session-reminder';
        time: string;
        timezone: string;
    };
    browserSkill: {
        enabled: boolean;
        executable: string;
        mode: 'read-only';
        allowedDomains: string[];
        additionalAllowedDomains: string[];
        requireUserApproval: boolean;
        maxItemsPerRun: number;
        minIntervalMs: number;
    };
    desktopShortcut: {
        enabled: boolean;
        name: string;
        requireApproval: boolean;
    };
};
