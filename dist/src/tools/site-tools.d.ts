import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { type WorkspaceContext } from '../workspace/workspace-output.js';
export type WorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;
export declare const createSiteTools: (resolveWorkspace: WorkspaceResolver, outputDir: string) => ToolDefinition[];
