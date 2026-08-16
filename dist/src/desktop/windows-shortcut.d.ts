import type { ShortcutManifest, ShortcutShell, ShortcutWrite } from './desktop-shortcut.js';
export interface WindowsShellExecutor {
    execute(script: string, args?: readonly string[]): Promise<string>;
}
export declare class WindowsShortcutShell implements ShortcutShell {
    private readonly executor;
    constructor(executor: WindowsShellExecutor);
    getKnownDesktopPath(): Promise<string>;
    pathExists(filePath: string): Promise<boolean>;
    readManifest(filePath: string): Promise<ShortcutManifest | undefined>;
    createShortcut(shortcut: ShortcutWrite): Promise<void>;
    updateShortcut(shortcut: ShortcutWrite): Promise<void>;
    writeManifestAtomically(filePath: string, manifest: ShortcutManifest): Promise<void>;
    private writeShortcut;
}
export declare const createWindowsShortcutShell: (executor: WindowsShellExecutor) => ShortcutShell;
