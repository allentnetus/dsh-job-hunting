import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { JobHuntingConfig } from '../config/default-config.js';
import { type WorkspaceContext } from '../workspace/workspace-output.js';
export type WorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;
export declare const createStatusTool: (resolveWorkspace: WorkspaceResolver, config: JobHuntingConfig) => ToolDefinition;
