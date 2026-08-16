import type { JobInput, JobRecord } from './types.js';
export declare const normalizeJob: (input: JobInput) => JobRecord;
export declare const dedupeJobs: (existing: readonly JobRecord[], incoming: readonly JobRecord[]) => JobRecord[];
