const normalizeNote = (note) => note.replace(/\s+/g, ' ').trim();
export const markInterest = (state, jobId, mark) => {
    const marks = { ...state.marks };
    if (mark === 'none') {
        delete marks[jobId];
    }
    else {
        marks[jobId] = mark;
    }
    return {
        ...state,
        marks,
    };
};
export const setInterestNote = (state, jobId, note) => {
    const notes = { ...state.notes };
    const normalizedNote = normalizeNote(note);
    if (normalizedNote === '') {
        delete notes[jobId];
    }
    else {
        notes[jobId] = normalizedNote;
    }
    return {
        ...state,
        notes,
    };
};
export const getInterestPool = (jobs, state) => jobs.filter((job) => state.marks[job.id] === 'interested');
//# sourceMappingURL=interest-ledger.js.map