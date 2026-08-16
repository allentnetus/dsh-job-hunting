import type { InterestState, JobRecord } from '../domain/types.js';
import type { InterestExport } from '../site/interest-export.js';
export declare class InvalidInterestExportError extends Error {
    readonly code = "INVALID_INTEREST_EXPORT";
    readonly issues: readonly string[];
    constructor(issues: readonly string[]);
}
export declare class UnknownInterestJobError extends Error {
    readonly code = "UNKNOWN_INTEREST_JOB_IDS";
    readonly unknownIds: readonly string[];
    constructor(unknownIds: readonly string[]);
}
export declare const syncInterestExport: (exported: InterestExport, ledger: InterestState) => InterestState;
export declare const getInterestPool: (jobs: readonly JobRecord[], state: InterestState) => JobRecord[];
