import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export const JOB_HUNTING_MANIFEST = '.job-hunting-manifest.json';

export interface ShortcutRequest {
  siteRoot: string;
  name: string;
  approved: boolean;
  requireApproval: boolean;
  iconPath?: string;
}

export interface ShortcutManifest {
  version: 1;
  shortcutName: string;
  shortcutPath: string;
  target: string;
}

export interface ShortcutWrite {
  name: string;
  shortcutPath: string;
  target: string;
  iconPath?: string;
}

export interface ShortcutShell {
  getKnownDesktopPath(): Promise<string>;
  pathExists(filePath: string): Promise<boolean>;
  readManifest(filePath: string): Promise<ShortcutManifest | undefined>;
  createShortcut(shortcut: ShortcutWrite): Promise<void>;
  updateShortcut(shortcut: ShortcutWrite): Promise<void>;
  writeManifestAtomically(filePath: string, manifest: ShortcutManifest): Promise<void>;
}

export type ShortcutResultStatus = 'created' | 'updated' | 'approval-required';

export interface ShortcutResult {
  status: ShortcutResultStatus;
  shortcutPath: string;
  manifestPath: string;
  target: string;
}

export class ShortcutOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShortcutOwnershipError';
  }
}

const isPathWithin = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

const normalizeComparablePath = (value: string): string => path.win32.normalize(value).toLowerCase();

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidShortcutManifest = (manifest: unknown): manifest is ShortcutManifest => {
  if (typeof manifest !== 'object' || manifest === null) {
    return false;
  }

  const candidate = manifest as Partial<Record<keyof ShortcutManifest, unknown>>;
  return candidate.version === 1 &&
    isNonEmptyString(candidate.shortcutName) &&
    isNonEmptyString(candidate.shortcutPath) &&
    isNonEmptyString(candidate.target);
};

const isOwnedByManifest = (
  manifest: unknown,
  shortcutName: string,
  shortcutPath: string,
): boolean => isValidShortcutManifest(manifest) &&
  manifest.shortcutName === shortcutName &&
  normalizeComparablePath(manifest.shortcutPath) === normalizeComparablePath(shortcutPath);

const resolveShortcutName = (name: string): string => {
  const resolved = name.trim();
  if (resolved.length === 0 || resolved === '.' || resolved === '..') {
    throw new TypeError('Shortcut name must be non-empty');
  }

  if (path.win32.basename(resolved) !== resolved || resolved.includes('/') || resolved.includes('\\')) {
    throw new TypeError('Shortcut name must not contain path separators');
  }

  return resolved;
};

const resolveDesktopPath = async (shell: ShortcutShell): Promise<string> => {
  const desktopPath = (await shell.getKnownDesktopPath()).trim();
  if (desktopPath.length === 0 || !path.win32.isAbsolute(desktopPath)) {
    throw new TypeError('Windows known Desktop path must be absolute');
  }

  return path.win32.resolve(desktopPath);
};

export const validateShortcutTarget = async (siteRoot: string): Promise<string> => {
  if (typeof siteRoot !== 'string' || siteRoot.trim().length === 0) {
    throw new TypeError('siteRoot must be a non-empty path');
  }

  const resolvedRoot = await realpath(siteRoot);
  const rootStats = await stat(resolvedRoot);
  if (!rootStats.isDirectory()) {
    throw new TypeError('siteRoot must resolve to a directory');
  }

  const candidate = path.resolve(resolvedRoot, 'index.html');
  const resolvedTarget = await realpath(candidate);
  if (!isPathWithin(resolvedRoot, resolvedTarget)) {
    throw new TypeError('Shortcut target must stay inside siteRoot');
  }

  const targetStats = await stat(resolvedTarget);
  if (!targetStats.isFile()) {
    throw new TypeError('Shortcut target must resolve to a file');
  }

  return resolvedTarget;
};

export const createOrUpdateShortcut = async (
  request: ShortcutRequest,
  shell: ShortcutShell,
): Promise<ShortcutResult> => {
  const shortcutName = resolveShortcutName(request.name);
  const target = await validateShortcutTarget(request.siteRoot);
  const desktopPath = await resolveDesktopPath(shell);
  const shortcutPath = path.win32.resolve(desktopPath, `${shortcutName}.lnk`);
  const manifestPath = path.win32.resolve(desktopPath, JOB_HUNTING_MANIFEST);
  const existingShortcut = await shell.pathExists(shortcutPath);
  const manifest = await shell.readManifest(manifestPath);

  // requireApproval controls whether an upstream caller must prompt; an explicit
  // approval is still a hard write gate for both settings, including the safe default.
  const approvedForWrite = request.approved === true;
  if (!approvedForWrite) {
    return {
      status: 'approval-required',
      shortcutPath,
      manifestPath,
      target,
    };
  }

  if (manifest !== undefined && !isOwnedByManifest(manifest, shortcutName, shortcutPath)) {
    throw new ShortcutOwnershipError(
      `Manifest does not own the requested shortcut: ${shortcutPath}`,
    );
  }

  if (existingShortcut && !isOwnedByManifest(manifest, shortcutName, shortcutPath)) {
    throw new ShortcutOwnershipError(
      `Refusing to overwrite an unowned shortcut: ${shortcutPath}`,
    );
  }

  const shortcut: ShortcutWrite = {
    name: shortcutName,
    shortcutPath,
    target,
    ...(request.iconPath === undefined ? {} : { iconPath: request.iconPath }),
  };

  if (existingShortcut) {
    await shell.updateShortcut(shortcut);
  } else {
    await shell.createShortcut(shortcut);
  }

  await shell.writeManifestAtomically(manifestPath, {
    version: 1,
    shortcutName,
    shortcutPath,
    target,
  });

  return {
    status: existingShortcut ? 'updated' : 'created',
    shortcutPath,
    manifestPath,
    target,
  };
};
