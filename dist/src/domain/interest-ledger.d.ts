import type { InterestMark, InterestState, JobRecord } from './types.js';
export declare const markInterest: (state: InterestState, jobId: string, mark: InterestMark) => InterestState;
export declare const setInterestNote: (state: InterestState, jobId: string, note: string) => InterestState;
export declare const getInterestPool: (jobs: JobRecord[], state: InterestState) => JobRecord[];
