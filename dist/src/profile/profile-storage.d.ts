import type { CareerProfile } from '../domain/types.js';
import { CURRENT_PROFILE_SCHEMA_VERSION } from './profile-schema.js';
export declare const PROFILE_PATH: 'profile/profile.json';
export interface ProfileMigrationResult {
    profile: CareerProfile;
    migrated: boolean;
    fromVersion: number;
    toVersion: typeof CURRENT_PROFILE_SCHEMA_VERSION;
}
/**
 * Normalize a profile loaded from disk without dropping unknown future fields.
 *
 * Version 1 only adds the schema marker. Keeping this as an explicit function
 * gives future releases one place to add non-destructive migrations.
 */
export declare const migrateCareerProfile: (input: unknown) => ProfileMigrationResult;
/**
 * Read and, when necessary, migrate the confirmed profile in place.
 *
 * The first migration keeps a copy beside the original profile and writes the
 * migrated JSON through the workspace's atomic writer. Subsequent reads are
 * side-effect free because the schema marker is already present.
 */
export declare const readCareerProfile: (workspaceRoot: string) => Promise<CareerProfile | undefined>;
/** Persist a current-schema confirmed profile without changing its user revision. */
export declare const writeCareerProfile: (workspaceRoot: string, profile: CareerProfile) => Promise<void>;
