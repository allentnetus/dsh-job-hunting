import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BROWSER_SKILL_CONFIG,
  validateBrowserPolicy,
} from '../../src/browser/browser-policy.js';
import type {
  BrowserCollectionRequest,
  BrowserSkillConfig,
} from '../../src/browser/browser-policy.js';

const config: BrowserSkillConfig = {
  ...DEFAULT_BROWSER_SKILL_CONFIG,
  enabled: true,
  allowedDomains: ['jobs.example.com'],
};

const request: BrowserCollectionRequest = {
  urls: ['https://jobs.example.com/search?q=data'],
  config,
  userApproved: true,
};

describe('browser policy', () => {
  it('uses safe defaults while keeping the integrated tool enabled', () => {
    expect(DEFAULT_BROWSER_SKILL_CONFIG).toEqual({
      enabled: true,
      mode: 'read-only',
      allowedDomains: [
        'www.51job.com',
        'www.zhipin.com',
        'www.liepin.com',
        'www.zhaopin.com',
        'www.iguopin.com',
      ],
      requireUserApproval: true,
      maxItemsPerRun: 50,
      minIntervalMs: 1000,
    });
  });

  it('allows approved read-only collection on an exact allowlisted hostname', () => {
    expect(() => validateBrowserPolicy(request, config)).not.toThrow();
  });

  it.each([
    'www.51job.com',
    'www.zhipin.com',
    'www.liepin.com',
    'www.zhaopin.com',
    'www.iguopin.com',
  ])('allows the default recruitment site hostname %s', (hostname) => {
    const defaultRequest: BrowserCollectionRequest = {
      urls: [`https://${hostname}/`],
      config: DEFAULT_BROWSER_SKILL_CONFIG,
      userApproved: true,
    };

    expect(() => validateBrowserPolicy(defaultRequest, DEFAULT_BROWSER_SKILL_CONFIG)).not.toThrow();
  });

  it.each([
    ['an empty hostname allowlist', { allowedDomains: [] }],
    ['write mode', { mode: 'write' }],
    ['a non-positive rate interval', { minIntervalMs: 0 }],
    ['credential extraction', { credentialExtraction: true }],
    ['a form submission action', { actions: ['submit-form'] }],
  ])('rejects %s', (_label, overrides) => {
    const unsafeRequest = {
      ...request,
      ...overrides,
      config: { ...config, ...overrides },
    } as BrowserCollectionRequest;

    expect(() => validateBrowserPolicy(unsafeRequest, unsafeRequest.config!)).toThrow();
  });

  it.each(['payment-confirmation', 'auth-token', 'captcha-challenge', 'otp-entry', 'login-page'])
    ('rejects actions containing %s', (action) => {
      const unsafeRequest: BrowserCollectionRequest = {
        ...request,
        actions: [action],
      };

      expect(() => validateBrowserPolicy(unsafeRequest, config)).toThrow(/not allowed/i);
    });

  it('rejects subdomain suffix spoofs outside the exact hostname allowlist', () => {
    const unsafeRequest: BrowserCollectionRequest = {
      ...request,
      urls: ['https://jobs.example.com.attacker.test/listings'],
    };

    expect(() => validateBrowserPolicy(unsafeRequest, config)).toThrow(/allowlist|domain|host/i);
  });
});
