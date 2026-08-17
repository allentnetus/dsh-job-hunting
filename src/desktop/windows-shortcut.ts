import { lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  ShortcutManifest,
  ShortcutShell,
  ShortcutWrite,
} from './desktop-shortcut.js';

export interface WindowsShellExecutor {
  execute(script: string, args?: readonly string[]): Promise<string>;
}

const GET_DESKTOP_SCRIPT = '[Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)';

const WRITE_SHORTCUT_SCRIPT = `
$shortcutPath = $args[0]
$targetPath = $args[1]
$iconPath = $args[2]
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
if (-not [string]::IsNullOrWhiteSpace($iconPath)) {
  $shortcut.IconLocation = $iconPath
}
$shortcut.Save()
`;

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

const assertSafeDirectOverwriteTarget = async (filePath: string): Promise<void> => {
  let linkStats;
  try {
    linkStats = await lstat(filePath);
  } catch (error) {
    if (isMissing(error)) {
      throw new Error(`Refusing direct overwrite of missing manifest destination: ${filePath}`);
    }

    throw error;
  }

  if (linkStats.isSymbolicLink()) {
    throw new Error(`Refusing direct overwrite of symlink manifest destination: ${filePath}`);
  }

  let destinationStats;
  try {
    destinationStats = await stat(filePath);
  } catch (error) {
    if (isMissing(error)) {
      throw new Error(`Refusing direct overwrite of missing manifest destination: ${filePath}`);
    }

    throw error;
  }

  if (!destinationStats.isFile()) {
    throw new Error(`Refusing direct overwrite of non-regular manifest destination: ${filePath}`);
  }
};

export class WindowsShortcutShell implements ShortcutShell {
  public constructor(private readonly executor: WindowsShellExecutor) {}

  public async getKnownDesktopPath(): Promise<string> {
    const desktopPath = (await this.executor.execute(GET_DESKTOP_SCRIPT)).trim();
    if (desktopPath.length === 0) {
      throw new Error('Windows did not return a known Desktop path');
    }

    return desktopPath;
  }

  public async pathExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch (error) {
      if (isMissing(error)) {
        return false;
      }

      throw error;
    }
  }

  public async readManifest(filePath: string): Promise<ShortcutManifest | undefined> {
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as ShortcutManifest;
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }

      throw error;
    }
  }

  public async createShortcut(shortcut: ShortcutWrite): Promise<void> {
    await this.writeShortcut(shortcut);
  }

  public async updateShortcut(shortcut: ShortcutWrite): Promise<void> {
    await this.writeShortcut(shortcut);
  }

  public async writeManifestAtomically(
    filePath: string,
    manifest: ShortcutManifest,
  ): Promise<void> {
    const directory = path.dirname(filePath);
    const tempFile = path.join(
      directory,
      `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
    );
    const content = `${JSON.stringify(manifest, null, 2)}\n`;

    await mkdir(directory, { recursive: true });

    try {
      await writeFile(tempFile, content, 'utf8');
      await rename(tempFile, filePath);
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code !== 'EEXIST' && errno.code !== 'EPERM') {
        throw error;
      }

      await assertSafeDirectOverwriteTarget(filePath);
      await writeFile(filePath, content, 'utf8');
    } finally {
      await rm(tempFile, { force: true }).catch(() => undefined);
    }
  }

  private async writeShortcut(shortcut: ShortcutWrite): Promise<void> {
    await this.executor.execute(WRITE_SHORTCUT_SCRIPT, [
      shortcut.shortcutPath,
      shortcut.target,
      shortcut.iconPath ?? '',
    ]);
  }
}

export const createWindowsShortcutShell = (
  executor: WindowsShellExecutor,
): ShortcutShell => new WindowsShortcutShell(executor);
