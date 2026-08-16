import { readFile } from 'node:fs/promises';
import { normalizeJob } from '../domain/job-ledger.js';
const isJsonObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const readOptionalString = (value) => typeof value === 'string' ? value : undefined;
const readOptionalStringArray = (value, fieldName) => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        return {
            message: `${fieldName} must be an array of strings`,
        };
    }
    return value.map((item) => item);
};
const buildJobInput = (raw, fallbackSource, recordIndex, fileDefaults) => {
    if (!isJsonObject(raw)) {
        return {
            message: `record ${recordIndex + 1} must be an object`,
        };
    }
    const requirements = readOptionalStringArray(raw.requirements, 'requirements');
    if ('message' in requirements) {
        return {
            message: `record ${recordIndex + 1}: ${requirements.message}`,
        };
    }
    const title = readOptionalString(raw.title);
    const company = readOptionalString(raw.company);
    const location = readOptionalString(raw.location);
    const collectedAt = readOptionalString(raw.collectedAt) ?? readOptionalString(fileDefaults?.collectedAt);
    if (title === undefined || company === undefined || location === undefined || collectedAt === undefined) {
        return {
            message: `record ${recordIndex + 1} is missing one of required fields: title, company, location, collectedAt`,
        };
    }
    const source = readOptionalString(raw.source) ??
        readOptionalString(fileDefaults?.source) ??
        fallbackSource;
    const url = readOptionalString(raw.url);
    const salary = readOptionalString(raw.salary);
    const description = readOptionalString(raw.description);
    const postedAt = readOptionalString(raw.postedAt);
    const deadline = readOptionalString(raw.deadline);
    return {
        source,
        title,
        company,
        location,
        requirements,
        collectedAt,
        ...(url === undefined ? {} : { url }),
        ...(salary === undefined ? {} : { salary }),
        ...(description === undefined ? {} : { description }),
        ...(postedAt === undefined ? {} : { postedAt }),
        ...(deadline === undefined ? {} : { deadline }),
    };
};
const readJsonRecords = (parsed) => {
    if (Array.isArray(parsed)) {
        return {
            records: parsed,
            fileDefaults: undefined,
        };
    }
    if (isJsonObject(parsed) && Array.isArray(parsed.jobs)) {
        return {
            records: parsed.jobs,
            fileDefaults: parsed,
        };
    }
    return {
        message: 'top-level JSON must be an array or an object with a jobs array',
    };
};
export const readLocalJsonFile = async (source, filePath) => {
    const content = await readFile(filePath, 'utf8');
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (error) {
        return {
            jobs: [],
            errors: [
                {
                    message: `invalid JSON: ${error.message}`,
                },
            ],
        };
    }
    const recordsResult = readJsonRecords(parsed);
    if ('message' in recordsResult) {
        return {
            jobs: [],
            errors: [recordsResult],
        };
    }
    const jobs = [];
    const errors = [];
    for (const [recordIndex, record] of recordsResult.records.entries()) {
        const input = buildJobInput(record, source, recordIndex, recordsResult.fileDefaults);
        if ('message' in input) {
            errors.push(input);
            continue;
        }
        jobs.push(normalizeJob(input));
    }
    return {
        jobs,
        errors,
    };
};
//# sourceMappingURL=local-json-adapter.js.map