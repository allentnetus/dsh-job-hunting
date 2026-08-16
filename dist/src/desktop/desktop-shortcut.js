import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
export const JOB_HUNTING_MANIFEST = '.job-hunting-manifest.json';
export class ShortcutOwnershipError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ShortcutOwnershipError';
    }
}
const isPathWithin = (root, candidate) => {
    const relative = path.relative(root, candidate);
    return relative === '' || (relative !== '..' &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative));
};
const normalizeComparablePath = (value) => path.normalize(value).toLowerCase();
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isValidShortcutManifest = (manifest) => {
    if (typeof manifest !== 'object' || manifest === null) {
        return false;
    }
    const candidate = manifest;
    return candidate.version === 1 &&
        isNonEmptyString(candidate.shortcutName) &&
        isNonEmptyString(candidate.shortcutPath) &&
        isNonEmptyString(candidate.target);
};
const isOwnedByManifest = (manifest, shortcutName, shortcutPath) => isValidShortcutManifest(manifest) &&
    manifest.shortcutName === shortcutName &&
    normalizeComparablePath(manifest.shortcutPath) === normalizeComparablePath(shortcutPath);
const resolveShortcutName = (name) => {
    const resolved = name.trim();
    if (resolved.length === 0 || resolved === '.' || resolved === '..') {
        throw new TypeError('Shortcut name must be non-empty');
    }
    if (path.basename(resolved) !== resolved || resolved.includes('/') || resolved.includes('\\')) {
        throw new TypeError('Shortcut name must not contain path separators');
    }
    return resolved;
};
const resolveDesktopPath = async (shell) => {
    const desktopPath = (await shell.getKnownDesktopPath()).trim();
    if (desktopPath.length === 0 || !path.isAbsolute(desktopPath)) {
        throw new TypeError('Windows known Desktop path must be absolute');
    }
    return path.resolve(desktopPath);
};
export const validateShortcutTarget = async (siteRoot) => {
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
export const createOrUpdateShortcut = async (request, shell) => {
    const shortcutName = resolveShortcutName(request.name);
    const target = await validateShortcutTarget(request.siteRoot);
    const desktopPath = await resolveDesktopPath(shell);
    const shortcutPath = path.resolve(desktopPath, `${shortcutName}.lnk`);
    const manifestPath = path.resolve(desktopPath, JOB_HUNTING_MANIFEST);
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
        throw new ShortcutOwnershipError(`Manifest does not own the requested shortcut: ${shortcutPath}`);
    }
    if (existingShortcut && !isOwnedByManifest(manifest, shortcutName, shortcutPath)) {
        throw new ShortcutOwnershipError(`Refusing to overwrite an unowned shortcut: ${shortcutPath}`);
    }
    const shortcut = {
        name: shortcutName,
        shortcutPath,
        target,
        ...(request.iconPath === undefined ? {} : { iconPath: request.iconPath }),
    };
    if (existingShortcut) {
        await shell.updateShortcut(shortcut);
    }
    else {
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
//# sourceMappingURL=desktop-shortcut.js.map