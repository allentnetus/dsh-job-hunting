import { describe, expect, it } from 'vitest';

import type { JobRecord } from '../../src/domain/types.js';
import {
  BrowserHumanAssistanceRequiredError,
  checkBrowserSkill,
  collectWithBrowserSkill,
} from '../../src/browser/browser-skill-adapter.js';
import type { BrowserCollectionRequest } from '../../src/browser/browser-policy.js';
import type {
  BskCommandResult,
  BskRunner,
} from '../../src/browser/browser-skill-runner.js';

class FakeBskRunner implements BskRunner {
  readonly commands: string[][] = [];

  constructor(
    private readonly results: BskCommandResult[],
    private readonly onRun?: (args: readonly string[]) => void,
  ) {}

  async run(args: readonly string[]): Promise<BskCommandResult> {
    this.commands.push([...args]);
    this.onRun?.(args);
    return this.results.shift() ?? { exitCode: 0, stdout: '' };
  }
}

const request: BrowserCollectionRequest = {
  urls: ['https://jobs.example.com/search'],
  config: {
    enabled: true,
    mode: 'read-only',
    allowedDomains: ['jobs.example.com'],
    requireUserApproval: true,
    maxItemsPerRun: 50,
    minIntervalMs: 1000,
  },
  userApproved: true,
  source: 'browser-skill',
};

const visibleJobs: JobRecord[] = [
  {
    id: 'ignored-by-normalizer',
    source: 'ignored-by-normalizer',
    title: '  Data Analyst ',
    company: ' Acme ',
    location: ' Shanghai ',
    requirements: [' SQL ', 'SQL'],
    url: 'https://jobs.example.com/jobs/1#details',
    collectedAt: '2026-08-16T08:00:00.000Z',
  },
];

const availableStatus = { exitCode: 0, stdout: '{"available":true}' };

describe('BrowserSkill adapter', () => {
  it('reports an unavailable BrowserSkill without throwing when the command runner fails', async () => {
    const runner: BskRunner = {
      run: async (): Promise<BskCommandResult> => {
        throw new Error('bsk is not installed');
      },
    };

    await expect(checkBrowserSkill('bsk', runner)).resolves.toMatchObject({
      available: false,
      executable: 'bsk',
      message: 'bsk is not installed',
    });
  });

  it('collects only structured visible jobs and stops the session', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'ABCD' },
      { exitCode: 0, stdout: '' },
      {
        exitCode: 0,
        stdout: JSON.stringify({ visibleJobs }),
      },
      { exitCode: 0, stdout: '' },
    ]);

    const jobs = await collectWithBrowserSkill(request, runner);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: 'browser-skill',
      title: 'Data Analyst',
      company: 'Acme',
      location: 'Shanghai',
      requirements: ['SQL'],
      url: 'https://jobs.example.com/jobs/1',
      collectedAt: '2026-08-16T08:00:00.000Z',
    });
    expect(runner.commands).toEqual([
      ['status'],
      ['session', 'start', '--no-focus'],
      ['navigate', 'https://jobs.example.com/search', '--session', 'ABCD'],
      ['snapshot', '--session', 'ABCD'],
      ['session', 'stop', 'ABCD'],
    ]);
    expect(runner.commands.some((command) => command[0] === 'evaluate')).toBe(false);
  });

  it('stops the session when a collection command fails', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'ABCD' },
      { exitCode: 1, stderr: 'navigation failed', stdout: '' },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).rejects.toThrow(/navigation failed/i);
    expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
  });

  it('preserves the collection error when session cleanup also fails', async () => {
    const runner = new FakeBskRunner(
      [
        availableStatus,
        { exitCode: 0, stdout: 'ABCD' },
        { exitCode: 1, stderr: 'navigation failed', stdout: '' },
      ],
      (args) => {
        if (args[0] === 'session' && args[1] === 'stop') {
          throw new Error('stop failed');
        }
      },
    );

    await expect(collectWithBrowserSkill(request, runner)).rejects.toThrow(/navigation failed/i);
  });

  it('reports a clear cleanup error when collection succeeds but session cleanup fails', async () => {
    const runner = new FakeBskRunner(
      [
        availableStatus,
        { exitCode: 0, stdout: 'ABCD' },
        { exitCode: 0, stdout: '' },
        { exitCode: 0, stdout: JSON.stringify({ visibleJobs }) },
      ],
      (args) => {
        if (args[0] === 'session' && args[1] === 'stop') {
          throw new Error('stop failed');
        }
      },
    );

    await expect(collectWithBrowserSkill(request, runner)).rejects.toThrow(
      /cleanup.*stop failed/i,
    );
  });

  it('uses emergency stop-all cleanup when a successful start has no parseable session id', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: '{"status":"started"}' },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).rejects.toThrow(/usable session id/i);
    expect(runner.commands).toEqual([
      ['status'],
      ['session', 'start', '--no-focus'],
      ['session', 'stop', '--all'],
    ]);
  });

  it('rejects an invalid JSON session id instead of using a status word as the session', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: '{"sessionId":"ABCDE","status":"done"}' },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).rejects.toThrow();
    expect(runner.commands).toEqual([
      ['status'],
      ['session', 'start', '--no-focus'],
      ['session', 'stop', '--all'],
    ]);
    expect(runner.commands).not.toContainEqual(['session', 'stop', 'done']);
  });

  it('accepts a four-character session id from an explicitly labeled output', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'BrowserSkill session id: ABCD' },
      { exitCode: 0, stdout: '' },
      {
        exitCode: 0,
        stdout: JSON.stringify({ visibleJobs }),
      },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).resolves.toHaveLength(1);
    expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
  });

  it('does not return more visible jobs than maxItemsPerRun', async () => {
    const cappedRequest = {
      ...request,
      config: {
        ...request.config,
        maxItemsPerRun: 1,
      },
    } as BrowserCollectionRequest;
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'ABCD' },
      { exitCode: 0, stdout: '' },
      {
        exitCode: 0,
        stdout: JSON.stringify({
          visibleJobs: [
            visibleJobs[0],
            {
              ...visibleJobs[0],
              id: 'second-job',
              title: 'Product Analyst',
              url: 'https://jobs.example.com/jobs/2',
            },
          ],
        }),
      },
      { exitCode: 0, stdout: '' },
    ]);

    const jobs = await collectWithBrowserSkill(cappedRequest, runner);

    expect(jobs).toHaveLength(1);
    expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
  });

  it('waits at least minIntervalMs between consecutive URL navigations', async () => {
    const navigateAt: number[] = [];
    const intervalMs = 30;
    const intervalRequest: BrowserCollectionRequest = {
      ...request,
      urls: [
        'https://jobs.example.com/search?page=1',
        'https://jobs.example.com/search?page=2',
      ],
      config: {
        ...request.config,
        minIntervalMs: intervalMs,
      },
    };
    const runner = new FakeBskRunner(
      [
        availableStatus,
        { exitCode: 0, stdout: 'ABCD' },
        { exitCode: 0, stdout: '' },
        { exitCode: 0, stdout: JSON.stringify({ visibleJobs }) },
        { exitCode: 0, stdout: '' },
        { exitCode: 0, stdout: JSON.stringify({ visibleJobs }) },
        { exitCode: 0, stdout: '' },
      ],
      (args) => {
        if (args[0] === 'navigate') navigateAt.push(Date.now());
      },
    );

    await collectWithBrowserSkill(intervalRequest, runner);

    expect(navigateAt).toHaveLength(2);
    expect(navigateAt[1]! - navigateAt[0]!).toBeGreaterThanOrEqual(intervalMs - 5);
  });

  it('reports human assistance for login or captcha without retrying', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'ABCD' },
      { exitCode: 0, stdout: '' },
      {
        exitCode: 0,
        stdout: JSON.stringify({ assistanceRequired: 'captcha' }),
      },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).rejects.toBeInstanceOf(
      BrowserHumanAssistanceRequiredError,
    );
    expect(runner.commands).toHaveLength(5);
    expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
  });

  it('maps auth assistance payloads to login assistance without retrying', async () => {
    const runner = new FakeBskRunner([
      availableStatus,
      { exitCode: 0, stdout: 'ABCD' },
      { exitCode: 0, stdout: '' },
      {
        exitCode: 0,
        stdout: JSON.stringify({ assistanceRequired: { type: 'auth' } }),
      },
      { exitCode: 0, stdout: '' },
    ]);

    await expect(collectWithBrowserSkill(request, runner)).rejects.toMatchObject({
      code: 'HUMAN_ASSISTANCE_REQUIRED',
      reason: 'login',
    });
    expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
  });
});
