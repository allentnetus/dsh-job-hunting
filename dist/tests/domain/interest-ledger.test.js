import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../../src/domain/job-ledger.js';
import { getInterestPool, markInterest, setInterestNote, } from '../../src/domain/interest-ledger.js';
const baseState = {
    marks: {},
    notes: {},
    updatedAt: '2026-08-16T00:00:00.000Z',
};
const createJob = (overrides = {}) => normalizeJob({
    source: 'boss',
    title: 'Data Analyst',
    company: 'Acme',
    location: 'Shanghai',
    requirements: ['SQL'],
    url: 'https://jobs.example.com/role',
    collectedAt: '2026-08-16T00:00:00.000Z',
    ...overrides,
});
describe('interest ledger', () => {
    it('支持 favorite、interested、excluded 和清除标记的生命周期', () => {
        const favoriteState = markInterest(baseState, 'job-1', 'favorite');
        const interestedState = markInterest(favoriteState, 'job-1', 'interested');
        const excludedState = markInterest(interestedState, 'job-1', 'excluded');
        const clearedState = markInterest(excludedState, 'job-1', 'none');
        expect(favoriteState.marks['job-1']).toBe('favorite');
        expect(interestedState.marks['job-1']).toBe('interested');
        expect(excludedState.marks['job-1']).toBe('excluded');
        expect(clearedState.marks['job-1']).toBeUndefined();
    });
    it('允许为岗位添加和清除备注，且清除标记时保留备注', () => {
        const withMark = markInterest(baseState, 'job-1', 'interested');
        const withNote = setInterestNote(withMark, 'job-1', '优先推进，等待二面');
        const clearedMark = markInterest(withNote, 'job-1', 'none');
        const clearedNote = setInterestNote(clearedMark, 'job-1', '   ');
        expect(withNote.notes['job-1']).toBe('优先推进，等待二面');
        expect(clearedMark.notes['job-1']).toBe('优先推进，等待二面');
        expect(clearedNote.notes['job-1']).toBeUndefined();
    });
    it('只从 interested 标记中推导意向岗位池', () => {
        const job1 = createJob({ url: 'https://jobs.example.com/1' });
        const job2 = createJob({ url: 'https://jobs.example.com/2', title: 'ML Engineer' });
        const job3 = createJob({ url: 'https://jobs.example.com/3', title: 'Sales Manager' });
        const jobs = [job1, job2, job3];
        const state = {
            marks: {
                [job1.id]: 'interested',
                [job2.id]: 'favorite',
                [job3.id]: 'excluded',
            },
            notes: {},
            updatedAt: '2026-08-16T00:00:00.000Z',
        };
        const pool = getInterestPool(jobs, state);
        expect(pool.map((job) => job.id)).toEqual([job1.id]);
    });
});
//# sourceMappingURL=interest-ledger.test.js.map