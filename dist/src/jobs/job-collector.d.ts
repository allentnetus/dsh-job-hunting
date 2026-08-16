import type { JobRecord } from '../domain/types.js';
export type LocalJobFormat = 'json' | 'markdown';
export type LocalCollectionStatus = 'complete' | 'partial' | 'failed';
interface LocalFileJobSource {
    source: string;
    format: LocalJobFormat;
    filePaths: readonly string[];
}
interface LocalDirectoryJobSource {
    source: string;
    format: LocalJobFormat;
    directory: string;
    configuredDirectories: readonly string[];
}
export type LocalJobSourceEntry = LocalFileJobSource | LocalDirectoryJobSource;
export interface LocalJobSource {
    sources: readonly LocalJobSourceEntry[];
    existingJobs?: readonly JobRecord[];
}
export interface LocalCollectionFailure {
    source: string;
    filePath: string;
    message: string;
}
export interface LocalCollectionSourceStatus {
    source: string;
    status: LocalCollectionStatus;
    fileCount: number;
    jobCount: number;
    collectedAt: string[];
    errors: string[];
}
export interface LocalCollectionMeta {
    newJobIds: string[];
    sourceStatuses: LocalCollectionSourceStatus[];
    failures: LocalCollectionFailure[];
}
export declare const LOCAL_COLLECTION_META: unique symbol;
export declare const readLocalCollectionMeta: (jobs: readonly JobRecord[]) => LocalCollectionMeta | undefined;
export declare const collectLocalJobs: (input: LocalJobSource) => Promise<JobRecord[]>;
export {};
