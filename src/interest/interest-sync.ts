import { markInterest, setInterestNote } from '../domain/interest-ledger.js';
import type { InterestMark, InterestState, JobRecord } from '../domain/types.js';
import type { InterestExport, InterestExportRecord } from '../site/interest-export.js';

const interestMarks = new Set<InterestMark>(['none', 'favorite', 'interested', 'excluded']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class InvalidInterestExportError extends Error {
  readonly code = 'INVALID_INTEREST_EXPORT';
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid interest export: ${issues.join('; ')}`);
    this.name = 'InvalidInterestExportError';
    this.issues = [...issues];
  }
}

export class UnknownInterestJobError extends Error {
  readonly code = 'UNKNOWN_INTEREST_JOB_IDS';
  readonly unknownIds: readonly string[];

  constructor(unknownIds: readonly string[]) {
    const uniqueIds = [...new Set(unknownIds)].sort((left, right) => left.localeCompare(right));
    super(`Interest export contains unknown job IDs: ${uniqueIds.join(', ')}`);
    this.name = 'UnknownInterestJobError';
    this.unknownIds = uniqueIds;
  }
}

const applyExportRecord = (state: InterestState, record: {
  jobId: string;
  mark: InterestMark;
  note: string;
}): InterestState => {
  const withMark = markInterest(state, record.jobId, record.mark);
  return setInterestNote(withMark, record.jobId, record.note);
};

const validateInterestExport = (value: InterestExport): InterestExport => {
  const candidate: unknown = value;
  if (!isObject(candidate)) {
    throw new InvalidInterestExportError(['export must be an object']);
  }

  const issues: string[] = [];
  if (!Array.isArray(candidate.records)) issues.push('records must be an array');
  if (!Array.isArray(candidate.knownJobIds) || candidate.knownJobIds.some((id) => typeof id !== 'string')) {
    issues.push('knownJobIds must be an array of strings');
  }
  if (!Array.isArray(candidate.unknownIds) || candidate.unknownIds.some((id) => typeof id !== 'string')) {
    issues.push('unknownIds must be an array of strings');
  }
  if (typeof candidate.updatedAt !== 'string') issues.push('updatedAt must be a string');

  const records: InterestExportRecord[] = [];
  if (Array.isArray(candidate.records)) {
    candidate.records.forEach((record, index) => {
      if (!isObject(record)) {
        issues.push(`records[${index}] must be an object`);
        return;
      }

      if (typeof record.jobId !== 'string' || record.jobId.trim() === '') {
        issues.push(`records[${index}].jobId must be a non-empty string`);
      }
      if (typeof record.mark !== 'string' || !interestMarks.has(record.mark as InterestMark)) {
        issues.push(`records[${index}].mark is invalid`);
      }
      if (typeof record.note !== 'string') issues.push(`records[${index}].note must be a string`);
      if (typeof record.timestamp !== 'string') issues.push(`records[${index}].timestamp must be a string`);

      if (
        typeof record.jobId === 'string' &&
        typeof record.mark === 'string' &&
        interestMarks.has(record.mark as InterestMark) &&
        typeof record.note === 'string' &&
        typeof record.timestamp === 'string'
      ) {
        records.push(record as unknown as InterestExportRecord);
      }
    });
  }

  if (issues.length > 0) throw new InvalidInterestExportError(issues);
  return { ...value, records };
};

const markPriority: Record<InterestMark, number> = {
  none: 0,
  favorite: 1,
  interested: 2,
  excluded: 3,
};

const compareCanonicalRecords = (
  left: InterestExportRecord,
  right: InterestExportRecord,
): number => {
  const timestampOrder = right.timestamp.localeCompare(left.timestamp);
  if (timestampOrder !== 0) return timestampOrder;

  const noteOrder = left.note.localeCompare(right.note);
  if (noteOrder !== 0) return noteOrder;

  const markOrder = left.mark.localeCompare(right.mark);
  if (markOrder !== 0) return markOrder;

  return left.jobId.localeCompare(right.jobId);
};

export const syncInterestExport = (
  exported: InterestExport,
  ledger: InterestState,
): InterestState => {
  const validExport = validateInterestExport(exported);
  const knownJobIds = new Set(validExport.knownJobIds);
  const unknownRecordIds = validExport.records
    .filter((record) => !knownJobIds.has(record.jobId))
    .map((record) => record.jobId);
  const unknownIds = [...validExport.unknownIds, ...unknownRecordIds];
  if (unknownIds.length > 0) throw new UnknownInterestJobError(unknownIds);

  const recordsByJobId = new Map<string, InterestExportRecord>();
  for (const record of validExport.records) {
    const existing = recordsByJobId.get(record.jobId);
    if (
      !existing ||
      markPriority[record.mark] > markPriority[existing.mark] ||
      (markPriority[record.mark] === markPriority[existing.mark] &&
        compareCanonicalRecords(record, existing) < 0)
    ) {
      recordsByJobId.set(record.jobId, record);
    }
  }

  let next = {
    ...ledger,
    marks: { ...ledger.marks },
    notes: { ...ledger.notes },
  };

  for (const record of [...recordsByJobId.values()].sort((left, right) =>
    left.jobId.localeCompare(right.jobId))) {
    next = applyExportRecord(next, record);
  }

  return {
    ...next,
    updatedAt: validExport.updatedAt,
  };
};

export const getInterestPool = (
  jobs: readonly JobRecord[],
  state: InterestState,
): JobRecord[] => jobs.filter((job) => state.marks[job.id] === 'interested');
