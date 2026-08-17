import type { Context } from '@deepseek-ai/cordis';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import type { JobHuntingConfig } from './config/default-config.js';
import { defaultConfig } from './config/default-config.js';
import { parseConfig } from './config/schema.js';
import { resolveActiveWorkspace, type DshContext } from './workspace/workspace-output.js';
import { createJobTools, type WorkspaceResolver as JobWorkspaceResolver } from './tools/job-tools.js';
import { createBrowserJobTool } from './tools/browser-job-tool.js';
import { createResumeTools, type WorkspaceResolver as ResumeWorkspaceResolver } from './tools/resume-tools.js';
import { createSiteTools, type WorkspaceResolver as SiteWorkspaceResolver } from './tools/site-tools.js';
import { createStatusTool, type WorkspaceResolver as StatusWorkspaceResolver } from './tools/status-tool.js';
import { jobHuntingSkill } from './skill/job-hunting.skill.js';

export const name = 'dsh-job-hunting';

export const inject = ['tools', 'skills', 'workspaceRegistry'] as const;

export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-job-hunting',
    validate(value: unknown) {
      try {
        return { value: parseConfig(value) };
      } catch (error) {
        return {
          issues: [{ message: error instanceof Error ? error.message : String(error) }],
        };
      }
    },
  },
} as const;

const toWorkspaceContext = (ctx: Context, exec: ToolRunContext) => ({
  workspaceRegistry: ctx.workspaceRegistry as unknown as WorkspaceRegistry as unknown as NonNullable<DshContext['workspaceRegistry']>,
  ...(exec.agent === undefined
    ? {}
    : {
        agent: {
          sessionId: String(exec.agent.id),
          ...(exec.agent.session.header.cwd === undefined
            ? {}
            : { session: { meta: { cwd: exec.agent.session.header.cwd } } }),
        },
      }),
});

export const apply = (
  ctx: Context,
  configInput: unknown = defaultConfig,
): (() => void) => {
  const config = parseConfig(configInput);
  const resolveWorkspace = async (exec: ToolRunContext) =>
    resolveActiveWorkspace(toWorkspaceContext(ctx, exec));
  const disposers: Array<() => void> = [];

  try {
    const tools = [
      ...createResumeTools(resolveWorkspace as ResumeWorkspaceResolver),
      ...createJobTools(resolveWorkspace as JobWorkspaceResolver),
      createBrowserJobTool(resolveWorkspace as JobWorkspaceResolver, config),
      ...createSiteTools(resolveWorkspace as SiteWorkspaceResolver, config.outputDir),
      createStatusTool(resolveWorkspace as StatusWorkspaceResolver, config),
    ];

    for (const tool of tools) {
      disposers.push(ctx.tools.register(tool));
    }
    disposers.push(ctx.skills.register(jobHuntingSkill));
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose();
    throw error;
  }

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
};
