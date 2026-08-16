import type { InterestMark, InterestState, JobRecord } from './types.js';

const normalizeNote = (note: string): string => note.replace(/\s+/g, ' ').trim();

export const markInterest = (
  state: InterestState,
  jobId: string,
  mark: InterestMark,
): InterestState => {
  const marks = { ...state.marks };

  if (mark === 'none') {
    delete marks[jobId];
  } else {
    marks[jobId] = mark;
  }

  return {
    ...state,
    marks,
  };
};

export const setInterestNote = (
  state: InterestState,
  jobId: string,
  note: string,
): InterestState => {
  const notes = { ...state.notes };
  const normalizedNote = normalizeNote(note);

  if (normalizedNote === '') {
    delete notes[jobId];
  } else {
    notes[jobId] = normalizedNote;
  }

  return {
    ...state,
    notes,
  };
};

export const getInterestPool = (jobs: JobRecord[], state: InterestState): JobRecord[] =>
  jobs.filter((job) => state.marks[job.id] === 'interested');
