/**
 * Version of the persisted `profile/profile.json` contract.
 *
 * This is deliberately separate from `CareerProfile.version`, which is the
 * user's confirmed-profile revision. `schemaVersion` only changes when the
 * shape or interpretation of the persisted document changes.
 */
export declare const CURRENT_PROFILE_SCHEMA_VERSION: 1;
export type ProfileSchemaVersion = typeof CURRENT_PROFILE_SCHEMA_VERSION;
