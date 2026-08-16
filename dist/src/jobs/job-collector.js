import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { dedupeJobs } from '../domain/job-ledger.js';
import { readLocalJsonFile } from './local-json-adapter.js';
import { readLocalMarkdownFile } from './local-markdown-adapter.js';
export const LOCAL_COLLECTION_META = Symbol('job-hunting.local-collection-meta');
const createAccumulator = (source) => ({
    source,
    fileCount: 0,
    successFileCount: 0,
    errorFileCount: 0,
    jobCount: 0,
    collectedAt: new Set(),
    errors: [],
});
const toResolvedPath = (value) => path.resolve(value);
const hasAllowedDirectory = (directory, configuredDirectories) => {
    const resolvedDirectory = toResolvedPath(directory);
    return configuredDirectories.some((configuredDirectory) => toResolvedPath(configuredDirectory) === resolvedDirectory);
};
const listConfiguredDirectoryFiles = async (entry) => {
    if (!hasAllowedDirectory(entry.directory, entry.configuredDirectories)) {
        throw new TypeError(`directory must be explicitly listed in configuredDirectories: ${entry.directory}`);
    }
    const extensionPattern = entry.format === 'json' ? /\.json$/i : /\.(md|markdown)$/i;
    const fileNames = await readdir(entry.directory, { withFileTypes: true });
    return fileNames
        .filter((entryResult) => entryResult.isFile() && extensionPattern.test(entryResult.name))
        .map((entryResult) => path.join(entry.directory, entryResult.name))
        .sort((left, right) => left.localeCompare(right));
};
const resolveEntryFiles = async (entry) => {
    if ('filePaths' in entry) {
        return [...entry.filePaths].map(toResolvedPath);
    }
    return listConfiguredDirectoryFiles(entry);
};
const readEntryFile = async (source, format, filePath) => {
    if (format === 'json') {
        return readLocalJsonFile(source, filePath);
    }
    return readLocalMarkdownFile(source, filePath);
};
const toSourceStatus = (accumulator) => ({
    source: accumulator.source,
    status: accumulator.errorFileCount === 0
        ? 'complete'
        : accumulator.successFileCount > 0
            ? 'partial'
            : 'failed',
    fileCount: accumulator.fileCount,
    jobCount: accumulator.jobCount,
    collectedAt: [...accumulator.collectedAt].sort((left, right) => left.localeCompare(right)),
    errors: [...accumulator.errors],
});
const buildNewJobIds = (existingJobs, dedupedJobs) => {
    const existingSectionLength = dedupeJobs(existingJobs, []).length;
    return dedupedJobs.slice(existingSectionLength).map((job) => job.id);
};
export const readLocalCollectionMeta = (jobs) => jobs[LOCAL_COLLECTION_META];
export const collectLocalJobs = async (input) => {
    const incomingJobs = [];
    const failures = [];
    const sourceAccumulators = new Map();
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
            let result;
            try {
                result = await readEntryFile(entry.source, entry.format, filePath);
            }
            catch (error) {
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
    const dedupedJobs = dedupeJobs(input.existingJobs ?? [], incomingJobs);
    dedupedJobs[LOCAL_COLLECTION_META] = {
        newJobIds: buildNewJobIds(input.existingJobs ?? [], dedupedJobs),
        sourceStatuses: [...sourceAccumulators.values()]
            .map(toSourceStatus)
            .sort((left, right) => left.source.localeCompare(right.source)),
        failures,
    };
    return dedupedJobs;
};
//# sourceMappingURL=job-collector.js.map