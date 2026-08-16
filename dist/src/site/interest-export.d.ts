import type { InterestMark, InterestState, JobRecord } from '../domain/types.js';
export interface InterestExportRecord {
    jobId: string;
    mark: InterestMark;
    note: string;
    timestamp: string;
}
export interface InterestExport {
    records: InterestExportRecord[];
    knownJobIds: string[];
    unknownIds: string[];
    updatedAt: string;
}
export declare const exportInterestMarks: (state: InterestState, jobs: readonly JobRecord[]) => InterestExport;
