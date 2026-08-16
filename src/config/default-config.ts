export const DEFAULT_BROWSER_ALLOWED_DOMAINS = [
  'www.51job.com',
  'www.zhipin.com',
  'www.liepin.com',
  'www.zhaopin.com',
  'www.iguopin.com',
] as const;

export const defaultConfig = {
  outputDir: 'job-hunting-site',
  schedule: {
    enabled: false,
    mode: 'session-reminder',
    time: '08:00',
    timezone: 'Asia/Shanghai',
  },
  browserSkill: {
    enabled: true,
    executable: 'bsk',
    mode: 'read-only',
    allowedDomains: DEFAULT_BROWSER_ALLOWED_DOMAINS,
    additionalAllowedDomains: [],
    requireUserApproval: true,
    maxItemsPerRun: 50,
    minIntervalMs: 1000,
  },
  desktopShortcut: {
    enabled: true,
    name: 'Job Hunting',
    requireApproval: true,
  },
} as const;

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
