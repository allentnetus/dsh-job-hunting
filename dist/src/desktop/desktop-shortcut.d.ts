export declare const JOB_HUNTING_MANIFEST = ".job-hunting-manifest.json";
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
export declare class ShortcutOwnershipError extends Error {
    constructor(message: string);
}
export declare const validateShortcutTarget: (siteRoot: string) => Promise<string>;
export declare const createOrUpdateShortcut: (request: ShortcutRequest, shell: ShortcutShell) => Promise<ShortcutResult>;
