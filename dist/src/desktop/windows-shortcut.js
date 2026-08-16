import { lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
const isMissing = (error) => error.code === 'ENOENT';
const assertSafeDirectOverwriteTarget = async (filePath) => {
    let linkStats;
    try {
        linkStats = await lstat(filePath);
    }
    catch (error) {
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
    }
    catch (error) {
        if (isMissing(error)) {
            throw new Error(`Refusing direct overwrite of missing manifest destination: ${filePath}`);
        }
        throw error;
    }
    if (!destinationStats.isFile()) {
        throw new Error(`Refusing direct overwrite of non-regular manifest destination: ${filePath}`);
    }
};
export class WindowsShortcutShell {
    executor;
    constructor(executor) {
        this.executor = executor;
    }
    async getKnownDesktopPath() {
        const desktopPath = (await this.executor.execute(GET_DESKTOP_SCRIPT)).trim();
        if (desktopPath.length === 0) {
            throw new Error('Windows did not return a known Desktop path');
        }
        return desktopPath;
    }
    async pathExists(filePath) {
        try {
            await stat(filePath);
            return true;
        }
        catch (error) {
            if (isMissing(error)) {
                return false;
            }
            throw error;
        }
    }
    async readManifest(filePath) {
        try {
            const content = await readFile(filePath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            if (isMissing(error)) {
                return undefined;
            }
            throw error;
        }
    }
    async createShortcut(shortcut) {
        await this.writeShortcut(shortcut);
    }
    async updateShortcut(shortcut) {
        await this.writeShortcut(shortcut);
    }
    async writeManifestAtomically(filePath, manifest) {
        const directory = path.dirname(filePath);
        const tempFile = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
        const content = `${JSON.stringify(manifest, null, 2)}\n`;
        await mkdir(directory, { recursive: true });
        try {
            await writeFile(tempFile, content, 'utf8');
            await rename(tempFile, filePath);
        }
        catch (error) {
            const errno = error;
            if (errno.code !== 'EEXIST' && errno.code !== 'EPERM') {
                throw error;
            }
            await assertSafeDirectOverwriteTarget(filePath);
            await writeFile(filePath, content, 'utf8');
        }
        finally {
            await rm(tempFile, { force: true }).catch(() => undefined);
        }
    }
    async writeShortcut(shortcut) {
        await this.executor.execute(WRITE_SHORTCUT_SCRIPT, [
            shortcut.shortcutPath,
            shortcut.target,
            shortcut.iconPath ?? '',
        ]);
    }
}
export const createWindowsShortcutShell = (executor) => new WindowsShortcutShell(executor);
//# sourceMappingURL=windows-shortcut.js.map