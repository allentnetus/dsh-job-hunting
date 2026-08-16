import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseConfig } from '../../src/config/schema.js';
import { createBrowserJobTool } from '../../src/tools/browser-job-tool.js';
import type {
  BskCommandResult,
  BskRunner,
} from '../../src/browser/browser-skill-runner.js';

class FakeBskRunner implements BskRunner {
  readonly commands: string[][] = [];

  constructor(private readonly results: BskCommandResult[]) {}

  async run(args: readonly string[]): Promise<BskCommandResult> {
    this.commands.push([...args]);
    return this.results.shift() ?? { exitCode: 0, stdout: '' };
  }
}

describe('BrowserSkill job tool', () => {
  it('collects through BrowserSkill and persists jobs in the active Workspace', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-browser-tool-'));
    try {
      const runner = new FakeBskRunner([
        { exitCode: 0, stdout: '{"available":true}' },
        { exitCode: 0, stdout: 'ABCD' },
        { exitCode: 0, stdout: '' },
        {
          exitCode: 0,
          stdout: JSON.stringify({
            visibleJobs: [
              {
                title: 'Data Analyst',
                company: 'Acme',
                location: 'Shanghai',
                url: 'https://jobs.example.com/jobs/1',
              },
            ],
          }),
        },
        { exitCode: 0, stdout: '' },
      ]);
      const config = parseConfig({
        browserSkill: {
          enabled: true,
          allowedDomains: ['jobs.example.com'],
        },
      });
      const tool = createBrowserJobTool(
        async () => ({
          id: 'workspace-1',
          path: workspaceRoot,
          sessionIds: [],
          status: 'ok' as const,
        }),
        config,
        runner,
      );

      const result = await tool.execute(
        {
          urls: ['https://jobs.example.com/search'],
          confirmed: true,
        },
        {} as never,
      );

      expect(result).toEqual({
        source: 'browser-skill',
        collected: 1,
        added: 1,
        total: 1,
      });
      expect(JSON.parse(await readFile(path.join(workspaceRoot, 'data/jobs.json'), 'utf8'))).toMatchObject([
        {
          title: 'Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          source: 'browser-skill',
        },
      ]);
      expect(runner.commands.at(-1)).toEqual(['session', 'stop', 'ABCD']);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
