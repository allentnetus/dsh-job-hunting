import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { dedupeJobs } from '../domain/job-ledger.js';
import type { JobRecord } from '../domain/types.js';
import { readLocalJsonFile } from './local-json-adapter.js';
import { readLocalMarkdownFile } from './local-markdown-adapter.js';

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

export const LOCAL_COLLECTION_META = Symbol('job-hunting.local-collection-meta');

type JobCollectionWithMeta = JobRecord[] & {
  [LOCAL_COLLECTION_META]?: LocalCollectionMeta;
};

interface SourceAccumulator {
  source: string;
  fileCount: number;
  successFileCount: number;
  errorFileCount: number;
  jobCount: number;
  collectedAt: Set<string>;
  errors: string[];
}

const createAccumulator = (source: string): SourceAccumulator => ({
  source,
  fileCount: 0,
  successFileCount: 0,
  errorFileCount: 0,
  jobCount: 0,
  collectedAt: new Set<string>(),
  errors: [],
});

const toResolvedPath = (value: string): string => path.resolve(value);

const hasAllowedDirectory = (
  directory: string,
  configuredDirectories: readonly string[],
): boolean => {
  const resolvedDirectory = toResolvedPath(directory);
  return configuredDirectories.some(
    (configuredDirectory) => toResolvedPath(configuredDirectory) === resolvedDirectory,
  );
};

const listConfiguredDirectoryFiles = async (
  entry: LocalDirectoryJobSource,
): Promise<string[]> => {
  if (!hasAllowedDirectory(entry.directory, entry.configuredDirectories)) {
    throw new TypeError(
      `directory must be explicitly listed in configuredDirectories: ${entry.directory}`,
    );
  }

  const extensionPattern = entry.format === 'json' ? /\.json$/i : /\.(md|markdown)$/i;
  const fileNames = await readdir(entry.directory, { withFileTypes: true });

  return fileNames
    .filter((entryResult) => entryResult.isFile() && extensionPattern.test(entryResult.name))
    .map((entryResult) => path.join(entry.directory, entryResult.name))
    .sort((left, right) => left.localeCompare(right));
};

const resolveEntryFiles = async (entry: LocalJobSourceEntry): Promise<string[]> => {
  if ('filePaths' in entry) {
    return [...entry.filePaths].map(toResolvedPath);
  }

  return listConfiguredDirectoryFiles(entry);
};

const readEntryFile = async (
  source: string,
  format: LocalJobFormat,
  filePath: string,
): Promise<ReturnType<typeof readLocalJsonFile>> => {
  if (format === 'json') {
    return readLocalJsonFile(source, filePath);
  }

  return readLocalMarkdownFile(source, filePath);
};

const toSourceStatus = (accumulator: SourceAccumulator): LocalCollectionSourceStatus => ({
  source: accumulator.source,
  status:
    accumulator.errorFileCount === 0
      ? 'complete'
      : accumulator.successFileCount > 0
        ? 'partial'
        : 'failed',
  fileCount: accumulator.fileCount,
  jobCount: accumulator.jobCount,
  collectedAt: [...accumulator.collectedAt].sort((left, right) => left.localeCompare(right)),
  errors: [...accumulator.errors],
});

const buildNewJobIds = (
  existingJobs: readonly JobRecord[],
  dedupedJobs: readonly JobRecord[],
): string[] => {
  const existingSectionLength = dedupeJobs(existingJobs, []).length;

  return dedupedJobs.slice(existingSectionLength).map((job) => job.id);
};

export const readLocalCollectionMeta = (
  jobs: readonly JobRecord[],
): LocalCollectionMeta | undefined => (jobs as JobCollectionWithMeta)[LOCAL_COLLECTION_META];

export const collectLocalJobs = async (input: LocalJobSource): Promise<JobRecord[]> => {
  const incomingJobs: JobRecord[] = [];
  const failures: LocalCollectionFailure[] = [];
  const sourceAccumulators = new Map<string, SourceAccumulator>();

  for (const entry of input.sources) {
    const accumulator = sourceAccumulators.get(entry.source) ?? createAccumulator(entry.source);
    sourceAccumulators.set(entry.source, accumulator);

    const filePaths = await resolveEntryFiles(entry);
    accumulator.fileCount += filePaths.length;

    if (filePaths.length === 0) {
      accumulator.errorFileCount += 1;
      accumulator.errors.push(`no matching ${entry.format} files found`);
      failures.push({
        source: entry.source,
        filePath: 'N/A',
        message: `no matching ${entry.format} files found`,
      });
      continue;
    }

    for (const filePath of filePaths) {
      let result: Awaited<ReturnType<typeof readEntryFile>>;

      try {
        result = await readEntryFile(entry.source, entry.format, filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        accumulator.errorFileCount += 1;
        accumulator.errors.push(message);
        failures.push({
          source: entry.source,
          filePath,
          message,
        });
        continue;
      }

      if (result.jobs.length > 0) {
        accumulator.successFileCount += 1;
      }

      accumulator.jobCount += result.jobs.length;
      for (const job of result.jobs) {
        accumulator.collectedAt.add(job.collectedAt);
        incomingJobs.push(job);
      }

      if (result.errors.length > 0) {
        accumulator.errorFileCount += 1;
        const message = result.errors.map((error) => error.message).join('; ');
        accumulator.errors.push(message);
        failures.push({
          source: entry.source,
          filePath,
          message,
        });
      }
    }
  }

  const dedupedJobs = dedupeJobs(input.existingJobs ?? [], incomingJobs) as JobCollectionWithMeta;
  dedupedJobs[LOCAL_COLLECTION_META] = {
    newJobIds: buildNewJobIds(input.existingJobs ?? [], dedupedJobs),
    sourceStatuses: [...sourceAccumulators.values()]
      .map(toSourceStatus)
      .sort((left, right) => left.source.localeCompare(right.source)),
    failures,
  };

  return dedupedJobs;
};
