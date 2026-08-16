import type { CareerProfile, JobRecord } from '../domain/types.js';
export interface DailyReportJob extends JobRecord {
    matchScore: number;
    matchReasons: string[];
}
export interface DeadlineReminder extends DailyReportJob {
    daysUntilDeadline: number;
}
export interface DailyReportSourceStatus {
    source: string;
    status: 'complete' | 'partial' | 'failed';
    fileCount: number;
    jobCount: number;
    collectedAt: string[];
    errors: string[];
}
export interface DailyReportFailure {
    source: string;
    filePath: string;
    message: string;
}
export interface DailyReport {
    date: string;
    generatedAt: string;
    collectedAt: string[];
    profileVersion: number;
    newJobs: DailyReportJob[];
    recommendedJobs: DailyReportJob[];
    deadlineReminders: DeadlineReminder[];
    sourceStatuses: DailyReportSourceStatus[];
    failures: DailyReportFailure[];
    anomalies: string[];
}
export declare const buildDailyReport: (jobs: JobRecord[], profile: CareerProfile, date: string) => DailyReport;
export declare const writeReportBundle: (report: DailyReport, outputRoot: string) => Promise<void>;
