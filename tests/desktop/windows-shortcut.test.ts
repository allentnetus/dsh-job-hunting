import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fsPromisesMock = vi.hoisted(() => ({
  lstat: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  fsPromisesMock.lstat.mockImplementation((...args: Parameters<typeof actual.lstat>) =>
    actual.lstat(...args),
  );
  fsPromisesMock.rename.mockImplementation((...args: Parameters<typeof actual.rename>) =>
    actual.rename(...args),
  );
  fsPromisesMock.stat.mockImplementation((...args: Parameters<typeof actual.stat>) =>
    actual.stat(...args),
  );
  return {
    ...actual,
    lstat: fsPromisesMock.lstat,
    rename: fsPromisesMock.rename,
    stat: fsPromisesMock.stat,
  };
});

import {
  createOrUpdateShortcut,
  ShortcutOwnershipError,
  validateShortcutTarget,
  type ShortcutManifest,
  type ShortcutRequest,
  type ShortcutShell,
} from '../../src/desktop/desktop-shortcut.js';
import { WindowsShortcutShell } from '../../src/desktop/windows-shortcut.js';

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-shortcut-'));
  tempDirs.push(directory);
  return directory;
};

const makeShell = (overrides: Partial<ShortcutShell> = {}): ShortcutShell => ({
  getKnownDesktopPath: vi.fn(async () => path.win32.join('C:', 'Users', 'test', 'Desktop')),
  pathExists: vi.fn(async () => false),
  readManifest: vi.fn(async () => undefined),
  createShortcut: vi.fn(async () => undefined),
  updateShortcut: vi.fn(async () => undefined),
  writeManifestAtomically: vi.fn(async () => undefined),
  ...overrides,
});

const makeRequest = (siteRoot: string, overrides: Partial<ShortcutRequest> = {}): ShortcutRequest => ({
  siteRoot,
  name: 'Job Hunting',
  approved: true,
  requireApproval: true,
  ...overrides,
});

afterEach(async () => {
  fsPromisesMock.lstat.mockClear();
  fsPromisesMock.rename.mockClear();
  fsPromisesMock.stat.mockClear();
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('windows shortcut target validation', () => {
  it('resolves an existing siteRoot/index.html file', async () => {
    const siteRoot = await makeTempDir();
    const indexPath = path.join(siteRoot, 'index.html');
    await writeFile(indexPath, '<!doctype html>');

    await expect(validateShortcutTarget(siteRoot)).resolves.toBe(path.resolve(indexPath));
  });

  it.each([
    ['missing site root', 'missing'],
    ['missing index file', undefined],
    ['index path is a directory', 'directory'],
  ])('rejects %s', async (_label, fixture) => {
    const siteRoot = await makeTempDir();

    if (fixture === 'missing') {
      await expect(validateShortcutTarget(path.join(siteRoot, 'missing'))).rejects.toThrow();
      return;
    }

    if (fixture === 'directory') {
      await mkdir(path.join(siteRoot, 'index.html'));
    }

    await expect(validateShortcutTarget(siteRoot)).rejects.toThrow();
  });
});

describe('windows shortcut ownership and approval', () => {
  it('creates the requested shortcut and records its ownership in the Desktop manifest', async () => {
    const siteRoot = await makeTempDir();
    await writeFile(path.join(siteRoot, 'index.html'), '<!doctype html>');
    const shell = makeShell();

    await expect(createOrUpdateShortcut(makeRequest(siteRoot), shell)).resolves.toMatchObject({
      status: 'created',
      shortcutPath: path.win32.join('C:', 'Users', 'test', 'Desktop', 'Job Hunting.lnk'),
    });

    expect(shell.createShortcut).toHaveBeenCalledTimes(1);
    expect(shell.updateShortcut).not.toHaveBeenCalled();
    expect(shell.writeManifestAtomically).toHaveBeenCalledWith(
      path.win32.join('C:', 'Users', 'test', 'Desktop', '.job-hunting-manifest.json'),
      expect.objectContaining({
        shortcutName: 'Job Hunting',
        shortcutPath: path.win32.join('C:', 'Users', 'test', 'Desktop', 'Job Hunting.lnk'),
        target: path.resolve(siteRoot, 'index.html'),
      }),
    );
  });

  it('updates an existing shortcut only when the manifest owns its path and name', async () => {
    const siteRoot = await makeTempDir();
    await writeFile(path.join(siteRoot, 'index.html'), '<!doctype html>');
    const desktopPath = path.win32.join('C:', 'Users', 'test', 'Desktop');
    const shortcutPath = path.win32.join(desktopPath, 'Job Hunting.lnk');
    const manifest: ShortcutManifest = {
      version: 1,
      shortcutName: 'Job Hunting',
      shortcutPath,
      target: path.win32.join(desktopPath, 'old-site', 'index.html'),
    };
    const shell = makeShell({
      pathExists: vi.fn(async () => true),
      readManifest: vi.fn(async () => manifest),
    });

    await expect(createOrUpdateShortcut(makeRequest(siteRoot), shell)).resolves.toMatchObject({
      status: 'updated',
      shortcutPath,
    });

    expect(shell.updateShortcut).toHaveBeenCalledTimes(1);
    expect(shell.createShortcut).not.toHaveBeenCalled();
    expect(shell.writeManifestAtomically).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['target is an object with a string-like length', { target: { length: 1 } }],
    ['shortcutName is not a string', { shortcutName: { length: 12 } }],
    ['shortcutPath is not a string', { shortcutPath: { length: 12 } }],
    ['version is not the number 1', { version: '1' }],
  ])('rejects a manifest when %s', async (_label, changes) => {
    const siteRoot = await makeTempDir();
    await writeFile(path.join(siteRoot, 'index.html'), '<!doctype html>');
    const desktopPath = path.win32.join('C:', 'Users', 'test', 'Desktop');
    const shortcutPath = path.win32.join(desktopPath, 'Job Hunting.lnk');
    const manifest = {
      version: 1,
      shortcutName: 'Job Hunting',
      shortcutPath,
      target: path.win32.join(desktopPath, 'old-site', 'index.html'),
      ...changes,
    } as unknown as ShortcutManifest;
    const shell = makeShell({
      pathExists: vi.fn(async () => true),
      readManifest: vi.fn(async () => manifest),
    });

    await expect(createOrUpdateShortcut(makeRequest(siteRoot), shell)).rejects.toBeInstanceOf(
      ShortcutOwnershipError,
    );
    expect(shell.createShortcut).not.toHaveBeenCalled();
    expect(shell.updateShortcut).not.toHaveBeenCalled();
    expect(shell.writeManifestAtomically).not.toHaveBeenCalled();
  });

  it('rejects an unrelated same-name existing shortcut without overwriting it', async () => {
    const siteRoot = await makeTempDir();
    await writeFile(path.join(siteRoot, 'index.html'), '<!doctype html>');
    const shell = makeShell({
      pathExists: vi.fn(async () => true),
    });

    await expect(createOrUpdateShortcut(makeRequest(siteRoot), shell)).rejects.toThrow(/owned/i);

    expect(shell.createShortcut).not.toHaveBeenCalled();
    expect(shell.updateShortcut).not.toHaveBeenCalled();
    expect(shell.writeManifestAtomically).not.toHaveBeenCalled();
  });

  it('performs zero shell writes when approval is false', async () => {
    const siteRoot = await makeTempDir();
    await writeFile(path.join(siteRoot, 'index.html'), '<!doctype html>');
    const shell = makeShell({
      pathExists: vi.fn(async () => true),
    });

    await expect(
      createOrUpdateShortcut(makeRequest(siteRoot, { approved: false }), shell),
    ).resolves.toMatchObject({ status: 'approval-required' });

    expect(shell.createShortcut).not.toHaveBeenCalled();
    expect(shell.updateShortcut).not.toHaveBeenCalled();
    expect(shell.writeManifestAtomically).not.toHaveBeenCalled();
  });
});

describe('Windows manifest atomic-write fallback', () => {
  const manifest: ShortcutManifest = {
    version: 1,
    shortcutName: 'Job Hunting',
    shortcutPath: 'C:\\Users\\test\\Desktop\\Job Hunting.lnk',
    target: 'C:\\site\\index.html',
  };

  it('refuses to direct-overwrite a symlink destination when atomic rename is unavailable', async () => {
    const directory = await makeTempDir();
    const manifestPath = path.join(directory, '.job-hunting-manifest.json');
    await writeFile(manifestPath, 'original\n');
    fsPromisesMock.lstat.mockResolvedValueOnce({
      isSymbolicLink: () => true,
    });
    fsPromisesMock.rename.mockRejectedValueOnce(
      Object.assign(new Error('atomic replace unavailable'), { code: 'EPERM' }),
    );

    const shell = new WindowsShortcutShell({ execute: vi.fn(async () => '') });

    await expect(shell.writeManifestAtomically(manifestPath, manifest)).rejects.toThrow(/unsafe|symlink/i);
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe('original\n');
  });

  it('refuses to direct-overwrite a non-regular destination when atomic rename is unavailable', async () => {
    const directory = await makeTempDir();
    const manifestPath = path.join(directory, '.job-hunting-manifest.json');
    await writeFile(manifestPath, 'original\n');
    fsPromisesMock.lstat.mockResolvedValueOnce({
      isSymbolicLink: () => false,
    });
    fsPromisesMock.stat.mockResolvedValueOnce({
      isFile: () => false,
    });
    fsPromisesMock.rename.mockRejectedValueOnce(
      Object.assign(new Error('atomic replace unavailable'), { code: 'EPERM' }),
    );

    const shell = new WindowsShortcutShell({ execute: vi.fn(async () => '') });

    await expect(shell.writeManifestAtomically(manifestPath, manifest)).rejects.toThrow(/regular|unsafe/i);
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe('original\n');
  });
});
