import { access } from 'node:fs/promises';

import { defineTool, type JsonValue, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';

import type { JobHuntingConfig } from '../config/default-config.js';
import { readWorkspaceJson, resolveOutputRoot, type WorkspaceContext } from '../workspace/workspace-output.js';
import type { InterestState } from '../domain/types.js';
import type { JobRecord } from '../domain/types.js';

export type WorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: unknown): ContentBlock[] => [
    { type: 'text', text: JSON.stringify(value) ?? 'null' },
  ],
};

const asJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const createStatusTool = (
  resolveWorkspace: WorkspaceResolver,
  config: JobHuntingConfig,
): ToolDefinition => defineTool({
  name: 'job_hunting_status',
  description: 'Show the active Workspace, local job/profile/site state, and configured automation defaults.',
  parameters: {},
  output: jsonOutput,
  async execute(_args, exec) {
    const workspace = await resolveWorkspace(exec);
    const jobs = await readWorkspaceJson<JobRecord[]>(workspace.path, 'data/jobs.json');
    const interest = await readWorkspaceJson<InterestState>(workspace.path, 'data/interest-ledger.json');
    return asJson({
      workspace: { id: workspace.id, path: workspace.path, status: workspace.status },
      jobs: { count: jobs?.length ?? 0, present: jobs !== undefined },
      profileConfirmed: await exists(resolveOutputRoot(workspace, 'profile/profile.json')),
      siteIndex: await exists(resolveOutputRoot(workspace, `${config.outputDir}/index.html`)),
      interestPoolCount: Object.values(interest?.marks ?? {}).filter((mark) => mark === 'interested').length,
      browserSkill: { enabled: config.browserSkill.enabled },
      schedule: { enabled: config.schedule.enabled },
      policy: { autoApply: false, bypassRestrictions: false },
    });
  },
});
