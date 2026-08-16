import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

export class WorkspaceNotFoundError extends Error {
  readonly code = 'WS_NOT_FOUND';
  readonly sessionId: string | undefined;
  readonly cwd: string | undefined;

  constructor(details: { sessionId: string | undefined; cwd: string | undefined }) {
    super('Unable to resolve an active workspace from sessionId or session.meta.cwd');
    this.name = 'WorkspaceNotFoundError';
    this.sessionId = details.sessionId;
    this.cwd = details.cwd;
  }
}

const normalizeWorkspace = async (workspace: WorkspaceRecordLike): Promise<WorkspaceContext> => ({
  id: workspace.id,
  path: workspace.path,
  sessionIds: [...workspace.sessionIds],
  status:
    typeof workspace.status === 'function'
      ? await workspace.status()
      : workspace.status ?? 'ok',
});

const requireWorkspaceRegistry = (ctx: DshContext): WorkspaceRegistryLike => {
  if (!ctx.workspaceRegistry) {
    throw new WorkspaceNotFoundError({
      sessionId: ctx.agent?.sessionId,
      cwd: ctx.agent?.session?.meta?.cwd,
    });
  }

  return ctx.workspaceRegistry;
};

const resolveRelativePath = (root: string, relativePath: string): string => {
  if (
    path.isAbsolute(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    throw new TypeError(`Path must be relative, received absolute path: ${relativePath}`);
  }

  const resolvedRoot = path.resolve(root);
  const hostRelativePath = process.platform === 'win32'
    ? relativePath
    : relativePath.replaceAll('\\', '/');
  const resolvedPath = path.resolve(resolvedRoot, hostRelativePath);
  const relativeToRoot = path.relative(resolvedRoot, resolvedPath);

  if (
    relativeToRoot === '..' ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new TypeError(`Path must stay within the workspace root and must not contain "..": ${relativePath}`);
  }

  return resolvedPath;
};

export const resolveActiveWorkspace = async (ctx: DshContext): Promise<WorkspaceContext> => {
  const registry = requireWorkspaceRegistry(ctx);
  const sessionId = ctx.agent?.sessionId;
  const cwd = ctx.agent?.session?.meta?.cwd;

  if (sessionId) {
    const bySessionId = registry.list().find((workspace) => workspace.sessionIds.includes(sessionId));
    if (bySessionId) {
      return normalizeWorkspace(bySessionId);
    }
  }

  if (cwd) {
    const byPath = await registry.resolveByPath(cwd);
    if (byPath) {
      return normalizeWorkspace(byPath);
    }
  }

  throw new WorkspaceNotFoundError({ sessionId, cwd });
};

export const resolveOutputRoot = (workspace: WorkspaceContext, relativePath: string): string =>
  resolveRelativePath(workspace.path, relativePath);

export const ensureOutputTree = async (root: string): Promise<void> => {
  const directories = [
    path.join(root, 'input', 'resumes'),
    path.join(root, 'profile'),
    path.join(root, 'data'),
    path.join(root, 'reports'),
    path.join(root, 'assets'),
    path.join(root, 'config'),
  ];

  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
};

export const readWorkspaceJson = async <T>(
  root: string,
  relativePath: string,
): Promise<T | undefined> => {
  const filePath = resolveRelativePath(root, relativePath);

  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
};

export const writeWorkspaceJson = async <T>(
  root: string,
  relativePath: string,
  value: T,
): Promise<void> => {
  const filePath = resolveRelativePath(root, relativePath);
  const directory = path.dirname(filePath);
  const tempFile = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const content = `${JSON.stringify(value, null, 2)}\n`;

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(tempFile, content, 'utf8');
    await rename(tempFile, filePath);
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;

    if (errno.code === 'EEXIST' || errno.code === 'EPERM') {
      // Windows may reject rename when the target exists; keep it until direct replacement is attempted.
      await writeFile(filePath, content, 'utf8');
      return;
    }

    throw error;
  } finally {
    await rm(tempFile, { force: true }).catch(() => undefined);
  }
};
