import { describe, expect, it } from 'vitest';

import { defaultConfig } from '../../src/config/default-config.js';
import { parseConfig } from '../../src/config/schema.js';

describe('config schema', () => {
  it('暴露 brief 中约定的精确默认配置', () => {
    expect(defaultConfig).toEqual({
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
        allowedDomains: [
          'www.51job.com',
          'www.zhipin.com',
          'www.liepin.com',
          'www.zhaopin.com',
          'www.iguopin.com',
        ],
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
    });
  });

  it('对部分配置应用默认值并保留合法覆盖', () => {
    expect(
      parseConfig({
        browserSkill: {
          enabled: true,
          allowedDomains: ['jobs.example.com'],
        },
        desktopShortcut: {
          enabled: false,
        },
      }),
    ).toEqual({
      ...defaultConfig,
      browserSkill: {
        ...defaultConfig.browserSkill,
        enabled: true,
        allowedDomains: ['jobs.example.com'],
      },
      desktopShortcut: {
        ...defaultConfig.desktopShortcut,
        enabled: false,
      },
    });
  });

  it('把额外招聘网站追加到默认白名单并去重', () => {
    expect(
      parseConfig({
        browserSkill: {
          additionalAllowedDomains: ['www.example-job-site.com', 'www.51job.com'],
        },
      }).browserSkill,
    ).toMatchObject({
      allowedDomains: [
        'www.51job.com',
        'www.zhipin.com',
        'www.liepin.com',
        'www.zhaopin.com',
        'www.iguopin.com',
        'www.example-job-site.com',
      ],
      additionalAllowedDomains: ['www.example-job-site.com', 'www.51job.com'],
    });
  });

  it('拒绝非法 schedule 配置', () => {
    expect(() =>
      parseConfig({
        schedule: {
          time: '24:00',
        },
      }),
    ).toThrow(/schedule\.time/i);

    expect(() =>
      parseConfig({
        schedule: {
          mode: 'cron',
        },
      }),
    ).toThrow(/schedule\.mode/i);
  });

  it('拒绝非法 browserSkill 配置', () => {
    expect(() =>
      parseConfig({
        browserSkill: {
          mode: 'write',
        },
      }),
    ).toThrow(/browserSkill\.mode/i);

    expect(() =>
      parseConfig({
        browserSkill: {
          maxItemsPerRun: 0,
        },
      }),
    ).toThrow(/browserSkill\.maxItemsPerRun/i);

    expect(() =>
      parseConfig({
        browserSkill: {
          minIntervalMs: 0,
        },
      }),
    ).toThrow(/browserSkill\.minIntervalMs/i);

    expect(() =>
      parseConfig({
        browserSkill: {
          minIntervalMs: 1.5,
        },
      }),
    ).toThrow(/browserSkill\.minIntervalMs/i);

    expect(() =>
      parseConfig({
        browserSkill: {
          allowedDomains: ['ok.example.com', ''],
        },
      }),
    ).toThrow(/browserSkill\.allowedDomains/i);

    expect(() =>
      parseConfig({
        browserSkill: {
          additionalAllowedDomains: [''],
        },
      }),
    ).toThrow(/browserSkill\.additionalAllowedDomains/i);
  });

  it('拒绝非法 desktopShortcut 配置', () => {
    expect(() =>
      parseConfig({
        desktopShortcut: {
          name: '   ',
        },
      }),
    ).toThrow(/desktopShortcut\.name/i);

    expect(() =>
      parseConfig({
        desktopShortcut: {
          requireApproval: 'yes',
        },
      }),
    ).toThrow(/desktopShortcut\.requireApproval/i);
  });
});
