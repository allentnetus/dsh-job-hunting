import type { JobRecord } from '../domain/types.js';
export interface LocalAdapterError {
    message: string;
}
export interface LocalAdapterResult {
    jobs: JobRecord[];
    errors: LocalAdapterError[];
}
export declare const readLocalJsonFile: (source: string, filePath: string) => Promise<LocalAdapterResult>;
