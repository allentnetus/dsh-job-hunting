import { readFile } from 'node:fs/promises';

import { normalizeJob } from '../domain/job-ledger.js';
import type { JobInput, JobRecord } from '../domain/types.js';

export interface LocalAdapterError {
  message: string;
}

export interface LocalAdapterResult {
  jobs: JobRecord[];
  errors: LocalAdapterError[];
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readOptionalString = (value: JsonValue | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

const readOptionalStringArray = (
  value: JsonValue | undefined,
  fieldName: string,
): string[] | LocalAdapterError => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return {
      message: `${fieldName} must be an array of strings`,
    };
  }

  return value.map((item) => item as string);
};

const buildJobInput = (
  raw: JsonValue,
  fallbackSource: string,
  recordIndex: number,
  fileDefaults: JsonObject | undefined,
): JobInput | LocalAdapterError => {
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
  const collectedAt =
    readOptionalString(raw.collectedAt) ?? readOptionalString(fileDefaults?.collectedAt);

  if (title === undefined || company === undefined || location === undefined || collectedAt === undefined) {
    return {
      message: `record ${recordIndex + 1} is missing one of required fields: title, company, location, collectedAt`,
    };
  }

  const source =
    readOptionalString(raw.source) ??
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

const readJsonRecords = (
  parsed: JsonValue,
): { records: JsonValue[]; fileDefaults: JsonObject | undefined } | LocalAdapterError => {
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

export const readLocalJsonFile = async (
  source: string,
  filePath: string,
): Promise<LocalAdapterResult> => {
  const content = await readFile(filePath, 'utf8');

  let parsed: JsonValue;

  try {
    parsed = JSON.parse(content) as JsonValue;
  } catch (error) {
    return {
      jobs: [],
      errors: [
        {
          message: `invalid JSON: ${(error as Error).message}`,
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

  const jobs: JobRecord[] = [];
  const errors: LocalAdapterError[] = [];

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
