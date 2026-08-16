import type { JobHuntingConfig } from '../config/default-config.js';
import { type BskRunner } from '../browser/browser-skill-runner.js';
import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { type WorkspaceContext } from '../workspace/workspace-output.js';
export type BrowserJobWorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;
export declare const createBrowserJobTool: (resolveWorkspace: BrowserJobWorkspaceResolver, config: JobHuntingConfig, runner?: BskRunner) => ToolDefinition;
