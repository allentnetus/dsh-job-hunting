export const exportInterestMarks = (state, jobs) => {
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
//# sourceMappingURL=interest-export.js.map