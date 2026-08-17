import { access, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ensureOutputTree,
  readWorkspaceJson,
  resolveActiveWorkspace,
  resolveOutputRoot,
  writeWorkspaceJson,
} from '../../src/workspace/workspace-output.js';
import type {
  DshContext,
  WorkspaceContext,
  WorkspaceRegistryLike,
} from '../../src/workspace/workspace-output.js';

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-workspace-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      await import('node:fs/promises').then(({ rm }) => rm(dir, { recursive: true, force: true }));
    }),
  );
});

const createWorkspace = (
  overrides: Partial<WorkspaceContext> & Pick<WorkspaceContext, 'id' | 'path'>,
): WorkspaceContext => ({
  id: overrides.id,
  path: overrides.path,
  sessionIds: overrides.sessionIds ?? [],
  status: overrides.status ?? 'ok',
});

const createRegistry = (
  workspaces: readonly WorkspaceContext[],
  resolveByPath?: (cwd: string) => Promise<WorkspaceContext | undefined>,
): WorkspaceRegistryLike => ({
  get: vi.fn((id: string) => workspaces.find((workspace) => workspace.id === id)),
  list: vi.fn(() => [...workspaces]),
  resolveByPath: vi.fn(
    resolveByPath ??
      (async (cwd: string) => workspaces.find((workspace) => workspace.path === cwd)),
  ),
});

describe('workspace-output', () => {
  it('优先按 agent.sessionId 解析当前 workspace', async () => {
    const workspace = createWorkspace({
      id: 'ws-1',
      path: 'G:\\Users\\jobs',
      sessionIds: ['session-1'],
    });
    const registry = createRegistry([workspace]);
    const ctx: DshContext = {
      agent: {
        sessionId: 'session-1',
        session: {
          meta: {
            cwd: 'G:\\Users\\fallback',
          },
        },
      },
      workspaceRegistry: registry,
    };

    const result = await resolveActiveWorkspace(ctx);

    expect(result).toEqual(workspace);
    expect(registry.list).toHaveBeenCalledTimes(1);
    expect(registry.resolveByPath).not.toHaveBeenCalled();
  });

  it('当 sessionId 找不到时，回退到 session.meta.cwd + resolveByPath', async () => {
    const workspace = createWorkspace({
      id: 'ws-2',
      path: 'G:\\Users\\jobs',
      sessionIds: [],
    });
    const registry = createRegistry([workspace], async (cwd) =>
      cwd === workspace.path ? workspace : undefined,
    );
    const ctx: DshContext = {
      agent: {
        sessionId: 'missing-session',
        session: {
          meta: {
            cwd: workspace.path,
          },
        },
      },
      workspaceRegistry: registry,
    };

    const result = await resolveActiveWorkspace(ctx);

    expect(result).toEqual(workspace);
    expect(registry.resolveByPath).toHaveBeenCalledWith(workspace.path);
  });

  it('在没有匹配 workspace 时抛出结构化 WS_NOT_FOUND 错误', async () => {
    const ctx: DshContext = {
      agent: {
        sessionId: 'missing-session',
        session: {
          meta: {
            cwd: 'G:\\Users\\missing',
          },
        },
      },
      workspaceRegistry: createRegistry([]),
    };

    await expect(resolveActiveWorkspace(ctx)).rejects.toMatchObject({
      name: 'WorkspaceNotFoundError',
      code: 'WS_NOT_FOUND',
      sessionId: 'missing-session',
      cwd: 'G:\\Users\\missing',
    });
  });

  it('只允许在 workspace 内安全拼接相对输出路径', () => {
    const workspace = createWorkspace({
      id: 'ws-safe',
      path: 'G:\\Users\\jobs',
    });

    expect(resolveOutputRoot(workspace, 'job-hunting-site/reports')).toBe(
      path.resolve(workspace.path, 'job-hunting-site', 'reports'),
    );
    expect(() => resolveOutputRoot(workspace, 'C:\\absolute')).toThrow(/absolute/i);
    expect(() => resolveOutputRoot(workspace, '..\\escape')).toThrow(/\.\./i);
  });

  it('创建 task brief 要求的输出目录树', async () => {
    const root = await makeTempDir();

    await ensureOutputTree(root);

    await expect(access(path.join(root, 'input', 'resumes'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'profile'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'data'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'reports'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'assets'))).resolves.toBeUndefined();
    await expect(access(path.join(root, 'config'))).resolves.toBeUndefined();
  });

  it('用同目录临时文件写入 JSON，并能安全读回', async () => {
    const root = await makeTempDir();

    await ensureOutputTree(root);

    const payload = {
      id: 'profile-1',
      roles: ['Data Analyst'],
    };

    await writeWorkspaceJson(root, 'config/profile.json', payload);

    await expect(readWorkspaceJson<typeof payload>(root, 'config/profile.json')).resolves.toEqual(
      payload,
    );

    const files = await readdir(path.join(root, 'config'));
    expect(files).toContain('profile.json');
    expect(files.some((file) => file.includes('.tmp'))).toBe(false);
  });

  it('读取不存在的 JSON 文件时返回 undefined', async () => {
    const root = await makeTempDir();

    await ensureOutputTree(root);

    await expect(readWorkspaceJson(root, 'data/missing.json')).resolves.toBeUndefined();
  });

  it('EEXIST/EPERM fallback never deletes the existing target before replacement', async () => {
    const sourcePath = fileURLToPath(new URL('../../src/workspace/workspace-output.ts', import.meta.url));
    const source = await readFile(sourcePath, 'utf8');

    expect(source).not.toContain('await rm(filePath');
    expect(source).toContain('await writeFile(filePath, content');
  });
});
