import { describe, expect, it } from 'vitest';
import { exportInterestMarks } from '../../src/site/interest-export.js';
const jobs = [
    {
        id: 'job-b',
        source: 'local',
        title: 'Backend Engineer',
        company: 'Beta',
        location: 'Beijing',
        requirements: [],
        url: 'https://jobs.example.test/b',
        collectedAt: '2026-08-16T08:00:00.000Z',
    },
    {
        id: 'job-a',
        source: 'local',
        title: 'Data Analyst',
        company: 'Acme',
        location: 'Shanghai',
        requirements: [],
        url: 'https://jobs.example.test/a',
        collectedAt: '2026-08-16T08:00:00.000Z',
    },
];
describe('interest export', () => {
    it('只导出已知岗位，按岗位 ID 稳定排序并保留标记、备注和时间戳', () => {
        const state = {
            marks: {
                'unknown-job': 'favorite',
                'job-b': 'excluded',
                'job-a': 'interested',
            },
            notes: {
                'job-b': '不考虑通勤',
                'job-a': '优先联系',
            },
            updatedAt: '2026-08-16T09:00:00.000Z',
        };
        const result = exportInterestMarks(state, jobs);
        expect(result).toEqual({
            records: [
                {
                    jobId: 'job-a',
                    mark: 'interested',
                    note: '优先联系',
                    timestamp: '2026-08-16T09:00:00.000Z',
                },
                {
                    jobId: 'job-b',
                    mark: 'excluded',
                    note: '不考虑通勤',
                    timestamp: '2026-08-16T09:00:00.000Z',
                },
            ],
            knownJobIds: ['job-a', 'job-b'],
            unknownIds: ['unknown-job'],
            updatedAt: '2026-08-16T09:00:00.000Z',
        });
    });
    it('对清除标记但仍保留的已知岗位备注安全导出 none 状态', () => {
        const state = {
            marks: {},
            notes: { 'job-a': '稍后复核' },
            updatedAt: '2026-08-16T10:00:00.000Z',
        };
        expect(exportInterestMarks(state, jobs)).toEqual({
            records: [
                {
                    jobId: 'job-a',
                    mark: 'none',
                    note: '稍后复核',
                    timestamp: '2026-08-16T10:00:00.000Z',
                },
            ],
            knownJobIds: ['job-a', 'job-b'],
            unknownIds: [],
            updatedAt: '2026-08-16T10:00:00.000Z',
        });
    });
});
//# sourceMappingURL=interest-export.test.js.map