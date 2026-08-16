import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UnknownInterestJobError, InvalidInterestExportError, getInterestPool, syncInterestExport, } from '../../src/interest/interest-sync.js';
import { InterestConfirmationRequiredError, InterestStoreNotConfiguredError, createInterestTools, createWorkspaceInterestLedgerStore, updateInterestFromConversation, } from '../../src/interest/interest-tools.js';
const baseLedger = {
    marks: {
        'job-a': 'interested',
    },
    notes: {
        'job-a': '原备注',
    },
    updatedAt: '2026-08-16T08:00:00.000Z',
};
const exported = {
    records: [
        {
            jobId: 'job-a',
            mark: 'excluded',
            note: '  不考虑   通勤\n',
            timestamp: '2026-08-16T09:00:00.000Z',
        },
        {
            jobId: 'job-b',
            mark: 'interested',
            note: '优先推进',
            timestamp: '2026-08-16T09:00:00.000Z',
        },
    ],
    knownJobIds: ['job-a', 'job-b'],
    unknownIds: [],
    updatedAt: '2026-08-16T09:00:00.000Z',
};
const jobs = [
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
];
describe('interest sync', () => {
    it('duplicate records resolve excluded over interested regardless of input order', () => {
        const interested = {
            jobId: 'job-a',
            mark: 'interested',
            note: '先感兴趣',
            timestamp: exported.updatedAt,
        };
        const excluded = {
            jobId: 'job-a',
            mark: 'excluded',
            note: '明确排除',
            timestamp: exported.updatedAt,
        };
        for (const records of [[interested, excluded], [excluded, interested]]) {
            const result = syncInterestExport({ ...exported, records }, { marks: {}, notes: {}, updatedAt: baseLedger.updatedAt });
            expect(result.marks['job-a']).toBe('excluded');
            expect(result.notes['job-a']).toBe('明确排除');
        }
    });
    it('same-priority records use the same canonical note regardless of input order', () => {
        const first = {
            jobId: 'job-a',
            mark: 'interested',
            note: 'Z 备注',
            timestamp: exported.updatedAt,
        };
        const second = {
            jobId: 'job-a',
            mark: 'interested',
            note: 'A 备注',
            timestamp: exported.updatedAt,
        };
        const results = [
            [first, second],
            [second, first],
        ].map((records) => syncInterestExport({ ...exported, records }, { marks: {}, notes: {}, updatedAt: baseLedger.updatedAt }));
        expect(results[0]).toEqual(results[1]);
        expect(results[0].notes['job-a']).toBe('A 备注');
    });
    it('重复导入同一个导出幂等，并让 excluded 覆盖此前的 interested', () => {
        const first = syncInterestExport(exported, baseLedger);
        const second = syncInterestExport(exported, first);
        expect(first).toEqual({
            marks: {
                'job-a': 'excluded',
                'job-b': 'interested',
            },
            notes: {
                'job-a': '不考虑 通勤',
                'job-b': '优先推进',
            },
            updatedAt: '2026-08-16T09:00:00.000Z',
        });
        expect(second).toEqual(first);
        expect(baseLedger).toEqual({
            marks: { 'job-a': 'interested' },
            notes: { 'job-a': '原备注' },
            updatedAt: '2026-08-16T08:00:00.000Z',
        });
    });
    it('报告未知岗位 ID，并且不创建虚假标记', () => {
        const invalidExport = {
            ...exported,
            records: [
                ...exported.records,
                {
                    jobId: 'job-unknown',
                    mark: 'interested',
                    note: '',
                    timestamp: exported.updatedAt,
                },
            ],
            unknownIds: ['job-unknown'],
        };
        expect(() => syncInterestExport(invalidExport, baseLedger)).toThrowError(UnknownInterestJobError);
        try {
            syncInterestExport(invalidExport, baseLedger);
        }
        catch (error) {
            expect(error).toMatchObject({
                code: 'UNKNOWN_INTEREST_JOB_IDS',
                unknownIds: ['job-unknown'],
            });
        }
        expect(baseLedger.marks).not.toHaveProperty('job-unknown');
    });
    it('拒绝 knownJobIds 之外的 record jobId', () => {
        const invalidExport = {
            ...exported,
            records: [
                ...exported.records,
                {
                    jobId: 'job-unknown',
                    mark: 'interested',
                    note: '',
                    timestamp: exported.updatedAt,
                },
            ],
        };
        expect(() => syncInterestExport(invalidExport, baseLedger)).toThrowError(UnknownInterestJobError);
    });
    it.each([
        ['jobId', { jobId: 42 }],
        ['mark', { mark: 'invalid-mark' }],
        ['note', { note: null }],
    ])('malformed %s throws InvalidInterestExportError before ledger mutation', (_, change) => {
        const malformed = {
            ...exported,
            records: [{
                    ...exported.records[0],
                    ...change,
                }],
        };
        expect(() => syncInterestExport(malformed, baseLedger)).toThrowError(InvalidInterestExportError);
        expect(baseLedger).toEqual({
            marks: { 'job-a': 'interested' },
            notes: { 'job-a': '原备注' },
            updatedAt: '2026-08-16T08:00:00.000Z',
        });
    });
    it('意向岗位池只返回 jobs 中已知且标记为 interested 的岗位', () => {
        const state = {
            marks: {
                'job-a': 'interested',
                'job-b': 'excluded',
                'job-not-present': 'interested',
            },
            notes: {},
            updatedAt: exported.updatedAt,
        };
        expect(getInterestPool(jobs, state)).toEqual([jobs[0]]);
    });
});
describe('conversation interest tools', () => {
    it('confirmed true permits markInterest without an injected confirmation callback', async () => {
        const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-interest-'));
        const store = createWorkspaceInterestLedgerStore({
            id: 'test-workspace',
            path: workspaceRoot,
            sessionIds: [],
            status: 'ok',
        });
        const tools = createInterestTools({
            store,
            now: () => '2026-08-16T10:00:00.000Z',
        });
        await tools.markInterest({ jobId: 'job-a', mark: 'interested', confirmed: true });
        await expect(store.read()).resolves.toEqual({
            marks: { 'job-a': 'interested' },
            notes: {},
            updatedAt: '2026-08-16T10:00:00.000Z',
        });
    });
    it('confirmed false still rejects markInterest without a confirmation callback', async () => {
        const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-interest-'));
        const store = createWorkspaceInterestLedgerStore({
            id: 'test-workspace',
            path: workspaceRoot,
            sessionIds: [],
            status: 'ok',
        });
        const tools = createInterestTools({ store });
        await expect(tools.markInterest({ jobId: 'job-a', mark: 'interested', confirmed: false })).rejects.toThrowError(InterestConfirmationRequiredError);
    });
    it.each([
        ['number one', 1],
        ['string true', 'true'],
        ['missing', undefined],
    ])('markInterest rejects non-literal-true confirmation (%s) without writing', async (_, confirmed) => {
        let writes = 0;
        const store = {
            read: async () => undefined,
            write: async () => {
                writes += 1;
            },
        };
        const tools = createInterestTools({ store });
        await expect(tools.markInterest({ confirmed })).rejects.toThrowError(InterestConfirmationRequiredError);
        expect(writes).toBe(0);
    });
    it.each([
        ['number one', 1],
        ['string true', 'true'],
        ['missing', undefined],
    ])('syncInterest rejects non-literal-true confirmation (%s) without writing', async (_, confirmed) => {
        let writes = 0;
        const store = {
            read: async () => undefined,
            write: async () => {
                writes += 1;
            },
        };
        const tools = createInterestTools({ store });
        await expect(tools.syncInterest({ exported, confirmed })).rejects.toThrowError(InterestConfirmationRequiredError);
        expect(writes).toBe(0);
    });
    it('通过显式 Workspace store 持久化并标准化备注与更新时间', async () => {
        const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-interest-'));
        const store = createWorkspaceInterestLedgerStore({
            id: 'test-workspace',
            path: workspaceRoot,
            sessionIds: [],
            status: 'ok',
        });
        const tools = createInterestTools({
            store,
            now: () => '2026-08-16T10:00:00.000Z',
            isConfirmed: () => true,
        });
        await tools.updateInterestFromConversation('job-a', 'interested', '  优先   推进\n');
        await expect(readFile(path.join(workspaceRoot, 'data', 'interest-ledger.json'), 'utf8')).resolves.toContain('优先 推进');
        await expect(store.read()).resolves.toEqual({
            marks: { 'job-a': 'interested' },
            notes: { 'job-a': '优先 推进' },
            updatedAt: '2026-08-16T10:00:00.000Z',
        });
    });
    it('没有确认时拒绝把普通对话变成永久兴趣标记', async () => {
        const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-interest-'));
        const store = createWorkspaceInterestLedgerStore({
            id: 'test-workspace',
            path: workspaceRoot,
            sessionIds: [],
            status: 'ok',
        });
        const tools = createInterestTools({ store, isConfirmed: () => false });
        await expect(tools.updateInterestFromConversation('job-a', 'interested')).rejects.toThrowError(InterestConfirmationRequiredError);
        await expect(store.read()).resolves.toBeUndefined();
    });
    it('三参数适配器在未配置 Workspace store 时明确失败', async () => {
        await expect(updateInterestFromConversation('job-a', 'interested')).rejects.toThrowError(InterestStoreNotConfiguredError);
    });
});
//# sourceMappingURL=interest-sync.test.js.map