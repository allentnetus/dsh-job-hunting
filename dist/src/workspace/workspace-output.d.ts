export type WorkspaceStatus = 'ok' | 'missing-dir';
export interface WorkspaceContext {
    id: string;
    path: string;
    sessionIds: readonly string[];
    status: WorkspaceStatus;
}
export interface WorkspaceRecordLike {
    id: string;
    path: string;
    sessionIds: readonly string[];
    status?: WorkspaceStatus | (() => Promise<WorkspaceStatus>) | (() => WorkspaceStatus);
}
export interface WorkspaceRegistryLike {
    get(id: string): WorkspaceRecordLike | undefined;
    list(): WorkspaceRecordLike[];
    resolveByPath(path: string): Promise<WorkspaceRecordLike | undefined>;
}
export interface DshContext {
    agent?: {
        sessionId?: string;
        session?: {
            meta?: {
                cwd?: string;
            };
        };
    };
    workspaceRegistry?: WorkspaceRegistryLike;
}
export declare class WorkspaceNotFoundError extends Error {
    readonly code = "WS_NOT_FOUND";
    readonly sessionId: string | undefined;
    readonly cwd: string | undefined;
    constructor(details: {
        sessionId: string | undefined;
        cwd: string | undefined;
    });
}
export declare const resolveActiveWorkspace: (ctx: DshContext) => Promise<WorkspaceContext>;
export declare const resolveOutputRoot: (workspace: WorkspaceContext, relativePath: string) => string;
export declare const ensureOutputTree: (root: string) => Promise<void>;
export declare const readWorkspaceJson: <T>(root: string, relativePath: string) => Promise<T | undefined>;
export declare const writeWorkspaceJson: <T>(root: string, relativePath: string, value: T) => Promise<void>;
