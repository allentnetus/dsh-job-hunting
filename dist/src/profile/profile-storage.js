import { copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { readWorkspaceJson, writeWorkspaceJson, } from '../workspace/workspace-output.js';
import { CURRENT_PROFILE_SCHEMA_VERSION } from './profile-schema.js';
export const PROFILE_PATH = 'profile/profile.json';
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const readSchemaVersion = (value) => {
    const version = value.schemaVersion;
    if (version === undefined)
        return 0;
    if (typeof version !== 'number' ||
        !Number.isInteger(version) ||
        version < 0) {
        throw new TypeError('PROFILE_SCHEMA_INVALID: schemaVersion must be a non-negative integer');
    }
    return version;
};
/**
 * Normalize a profile loaded from disk without dropping unknown future fields.
 *
 * Version 1 only adds the schema marker. Keeping this as an explicit function
 * gives future releases one place to add non-destructive migrations.
 */
export const migrateCareerProfile = (input) => {
    if (!isRecord(input)) {
        throw new TypeError('PROFILE_INVALID: profile/profile.json must contain a JSON object');
    }
    const fromVersion = readSchemaVersion(input);
    if (fromVersion > CURRENT_PROFILE_SCHEMA_VERSION) {
        throw new Error(`PROFILE_SCHEMA_UNSUPPORTED: profile schema ${fromVersion} is newer than supported schema ${CURRENT_PROFILE_SCHEMA_VERSION}`);
    }
    if (fromVersion === CURRENT_PROFILE_SCHEMA_VERSION) {
        return {
            profile: input,
            migrated: false,
            fromVersion,
            toVersion: CURRENT_PROFILE_SCHEMA_VERSION,
        };
    }
    return {
        profile: {
            ...input,
            schemaVersion: CURRENT_PROFILE_SCHEMA_VERSION,
        },
        migrated: true,
        fromVersion,
        toVersion: CURRENT_PROFILE_SCHEMA_VERSION,
    };
};
const backupPathFor = (workspaceRoot) => path.join(workspaceRoot, `${PROFILE_PATH}.pre-schema-${CURRENT_PROFILE_SCHEMA_VERSION}.bak`);
const backupLegacyProfile = async (workspaceRoot) => {
    const sourcePath = path.join(workspaceRoot, PROFILE_PATH);
    const backupPath = backupPathFor(workspaceRoot);
    try {
        await access(backupPath);
    }
    catch {
        await copyFile(sourcePath, backupPath);
    }
    return backupPath;
};
/**
 * Read and, when necessary, migrate the confirmed profile in place.
 *
 * The first migration keeps a copy beside the original profile and writes the
 * migrated JSON through the workspace's atomic writer. Subsequent reads are
 * side-effect free because the schema marker is already present.
 */
export const readCareerProfile = async (workspaceRoot) => {
    const stored = await readWorkspaceJson(workspaceRoot, PROFILE_PATH);
    if (stored === undefined)
        return undefined;
    const result = migrateCareerProfile(stored);
    if (result.migrated) {
        await backupLegacyProfile(workspaceRoot);
        await writeWorkspaceJson(workspaceRoot, PROFILE_PATH, result.profile);
    }
    return result.profile;
};
/** Persist a current-schema confirmed profile without changing its user revision. */
export const writeCareerProfile = async (workspaceRoot, profile) => {
    const result = migrateCareerProfile(profile);
    await writeWorkspaceJson(workspaceRoot, PROFILE_PATH, result.profile);
};
//# sourceMappingURL=profile-storage.js.map