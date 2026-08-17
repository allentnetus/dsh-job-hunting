import type { InterestMark, InterestState, JobRecord } from '../domain/types.js';

export interface InterestExportRecord {
  jobId: string;
  mark: InterestMark;
  note: string;
  timestamp: string;
}

export interface InterestExport {
  records: InterestExportRecord[];
  knownJobIds: string[];
  unknownIds: string[];
  updatedAt: string;
}

export const exportInterestMarks = (
  state: InterestState,
  jobs: readonly JobRecord[],
): InterestExport => {
  const knownIds = new Set(jobs.map((job) => job.id));
  const stateIds = new Set([...Object.keys(state.marks), ...Object.keys(state.notes)]);
  const records = [...stateIds]
    .filter((jobId) => knownIds.has(jobId))
    .sort((left, right) => left.localeCompare(right))
    .map((jobId) => ({
      jobId,
      mark: state.marks[jobId] ?? 'none',
      note: state.notes[jobId] ?? '',
      timestamp: state.updatedAt,
    }));

  return {
    records,
    knownJobIds: [...knownIds].sort((left, right) => left.localeCompare(right)),
    unknownIds: [...stateIds]
      .filter((jobId) => !knownIds.has(jobId))
      .sort((left, right) => left.localeCompare(right)),
    updatedAt: state.updatedAt,
  };
};
