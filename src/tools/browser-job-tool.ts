import type { JobHuntingConfig } from '../config/default-config.js';
import { dedupeJobs } from '../domain/job-ledger.js';
import { collectWithBrowserSkill } from '../browser/browser-skill-adapter.js';
import { createSafeBskRunner, type BskRunner } from '../browser/browser-skill-runner.js';
import { defineTool, type JsonValue, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { readWorkspaceJson, writeWorkspaceJson, type WorkspaceContext } from '../workspace/workspace-output.js';
import type { JobRecord } from '../domain/types.js';

export type BrowserJobWorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: unknown): ContentBlock[] => [
    { type: 'text', text: JSON.stringify(value) ?? 'null' },
  ],
};

const asJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const readJobs = async (workspace: WorkspaceContext): Promise<JobRecord[]> =>
  (await readWorkspaceJson<JobRecord[]>(workspace.path, 'data/jobs.json')) ?? [];

export const createBrowserJobTool = (
  resolveWorkspace: BrowserJobWorkspaceResolver,
  config: JobHuntingConfig,
  runner: BskRunner = createSafeBskRunner(config.browserSkill.executable),
): ToolDefinition => defineTool({
  name: 'job_hunting_collect_browser_jobs',
  description: 'Collect visible job postings through the configured read-only Tencent/BrowserSkill session and persist them in the active Workspace after explicit confirmation.',
  parameters: {
    urls: {
      type: 'array',
      items: { type: 'string' },
      required: true,
      description: 'HTTP(S) URLs on configured allowlisted job sites.',
    },
    confirmed: {
      type: 'boolean',
      const: true,
      required: true,
      description: 'Explicitly confirm this read-only browser collection run.',
    },
    source: {
      type: 'string',
      description: 'Stable source label stored on collected jobs.',
    },
  },
  output: jsonOutput,
  async execute(args, exec) {
    const workspace = await resolveWorkspace(exec);
    const collected = await collectWithBrowserSkill(
      {
        urls: args.urls,
        config: config.browserSkill,
        userApproved: args.confirmed,
        executable: config.browserSkill.executable,
        source: args.source ?? 'browser-skill',
      },
      runner,
    );
    const existing = await readJobs(workspace);
    const jobs = dedupeJobs(existing, collected);
    await writeWorkspaceJson(workspace.path, 'data/jobs.json', jobs);

    return asJson({
      source: 'browser-skill',
      collected: collected.length,
      added: jobs.length - existing.length,
      total: jobs.length,
    });
  },
});
