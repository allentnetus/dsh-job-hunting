import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { CareerProfile } from '../../src/domain/types.js';

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-task-6-reports-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

const loadCollectorModule = async () => import('../../src/jobs/job-collector.js');
const loadReportModule = async () => import('../../src/reports/daily-report.js');

const confirmedProfile: CareerProfile = {
  targetRoles: ['Data Analyst', 'AI Product Manager'],
  targetIndustries: ['Fintech'],
  targetCompanies: ['Acme'],
  preferredLocations: ['Shanghai'],
  excludedLocations: ['Remote'],
  keywords: ['SQL', 'Python', 'A/B Testing'],
  avoid: ['sales', 'door-to-door'],
  version: 3,
  state: 'profile-confirmed',
  confirmedAt: '2026-08-15T08:00:00.000Z',
};

describe('daily report', () => {
  it('拒绝使用未确认的 CareerProfile 构建日报', async () => {
    await expect(loadReportModule()).resolves.toHaveProperty('buildDailyReport');

    const { buildDailyReport } = await loadReportModule();
    const { state: _state, ...unconfirmedProfile } = confirmedProfile;

    expect(() =>
      buildDailyReport(
        [],
        unconfirmedProfile,
        '2026-08-16',
      ),
    ).toThrow(/profile-confirmed/i);
  });

  it('拒绝不存在的日历日期构建日报', async () => {
    const { buildDailyReport } = await loadReportModule();

    expect(() => buildDailyReport([], confirmedProfile, '2026-02-31')).toThrow(
      /invalid report date/i,
    );
  });

  it('生成包含新增、推荐、截止提醒、来源状态、失败和异常的可解释日报', async () => {
    const root = await makeTempDir();
    const jsonPath = path.join(root, 'boss-jobs.json');
    const markdownPath = path.join(root, 'broken-jobs.md');

    await writeFile(
      jsonPath,
      JSON.stringify(
        [
          {
            source: 'boss',
            title: 'Senior Data Analyst',
            company: 'Acme Fintech',
            location: 'Shanghai',
            description: 'Build data workflows with SQL and Python.',
            requirements: ['SQL', 'Python'],
            url: 'https://jobs.example.com/roles/123',
            deadline: '2026-08-18',
            collectedAt: '2026-08-16T08:00:00.000Z',
          },
          {
            source: 'boss',
            title: 'Data Operations Specialist',
            company: 'Omega',
            location: 'Remote',
            description: 'Door-to-door sales enablement and pipeline follow-up.',
            requirements: ['Sales'],
            url: 'https://jobs.example.com/roles/234',
            deadline: 'not-a-date',
            collectedAt: '2026-08-16T09:00:00.000Z',
          },
          {
            source: 'boss',
            title: 'Broken Record',
            company: 'Gamma',
            location: 'Shenzhen',
            requirements: 'SQL',
            url: 'https://jobs.example.com/roles/999',
            collectedAt: '2026-08-16T10:00:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    await writeFile(
      markdownPath,
      [
        '## Broken Markdown Job',
        '- Company: Missing CollectedAt',
        '- Location: Shanghai',
        '- URL: https://jobs.example.com/roles/555',
      ].join('\n'),
      'utf8',
    );

    await expect(loadCollectorModule()).resolves.toHaveProperty('collectLocalJobs');
    await expect(loadReportModule()).resolves.toHaveProperty('buildDailyReport');

    const { collectLocalJobs } = await loadCollectorModule();
    const { buildDailyReport } = await loadReportModule();

    const jobs = await collectLocalJobs({
      sources: [
        {
          source: 'boss',
          format: 'json',
          filePaths: [jsonPath],
        },
        {
          source: 'notes',
          format: 'markdown',
          filePaths: [markdownPath],
        },
      ],
    });

    const report = buildDailyReport(jobs, confirmedProfile, '2026-08-16');

    expect(report.date).toBe('2026-08-16');
    expect(report.generatedAt).toMatch(/^2026-08-16T/);
    expect(report.collectedAt).toEqual([
      '2026-08-16T08:00:00.000Z',
      '2026-08-16T09:00:00.000Z',
    ]);
    expect(report.newJobs).toHaveLength(2);
    expect(report.newJobs[0]).toMatchObject({
      title: 'Senior Data Analyst',
      matchScore: expect.any(Number),
      matchReasons: expect.arrayContaining([expect.stringContaining('目标角色')]),
    });
    expect(report.recommendedJobs.map((job) => job.title)).toEqual(['Senior Data Analyst']);
    expect(report.deadlineReminders).toEqual([
      expect.objectContaining({
        title: 'Senior Data Analyst',
        daysUntilDeadline: 2,
      }),
    ]);
    expect(report.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'boss',
          status: 'partial',
        }),
        expect.objectContaining({
          source: 'notes',
          status: 'failed',
        }),
      ]),
    );
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'boss',
          filePath: jsonPath,
        }),
        expect.objectContaining({
          source: 'notes',
          filePath: markdownPath,
        }),
      ]),
    );
    expect(report.anomalies).toEqual(
      expect.arrayContaining([expect.stringContaining('not-a-date')]),
    );
  });

  it('写出 date.json、date.md、date.html，且 HTML 不依赖网络资源', async () => {
    const root = await makeTempDir();
    const outputRoot = path.join(root, 'reports');

    await writeFile(
      path.join(root, 'jobs.json'),
      JSON.stringify(
        [
          {
            source: 'boss',
            title: 'AI Product Manager',
            company: 'Acme',
            location: 'Shanghai',
            description: 'Lead experimentation with A/B Testing.',
            requirements: ['A/B Testing'],
            url: 'https://jobs.example.com/roles/888',
            deadline: '2026-08-20',
            collectedAt: '2026-08-16T12:00:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    await expect(loadCollectorModule()).resolves.toHaveProperty('collectLocalJobs');
    await expect(loadReportModule()).resolves.toHaveProperty('writeReportBundle');

    const { collectLocalJobs } = await loadCollectorModule();
    const { buildDailyReport, writeReportBundle } = await loadReportModule();

    const jobs = await collectLocalJobs({
      sources: [
        {
          source: 'boss',
          format: 'json',
          filePaths: [path.join(root, 'jobs.json')],
        },
      ],
    });

    const report = buildDailyReport(jobs, confirmedProfile, '2026-08-16');

    await writeReportBundle(report, outputRoot);

    const jsonContent = JSON.parse(
      await readFile(path.join(outputRoot, '2026-08-16.json'), 'utf8'),
    ) as {
      date: string;
      failures: unknown[];
    };
    const markdownContent = await readFile(path.join(outputRoot, '2026-08-16.md'), 'utf8');
    const htmlContent = await readFile(path.join(outputRoot, '2026-08-16.html'), 'utf8');

    expect(jsonContent.date).toBe('2026-08-16');
    expect(jsonContent.failures).toEqual([]);
    expect(markdownContent).toContain('# Daily Job Report - 2026-08-16');
    expect(markdownContent).toContain('## Source Statuses');
    expect(markdownContent).toContain('AI Product Manager');
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('<style>');
    expect(htmlContent).not.toMatch(/<link[^>]+https?:\/\//i);
    expect(htmlContent).not.toMatch(/<script[^>]+https?:\/\//i);
    expect(htmlContent).toContain('AI Product Manager');
  });

  it('拒绝不安全的报告日期，且不会在 outputRoot 外写文件', async () => {
    const root = await makeTempDir();
    const outputRoot = path.join(root, 'reports');
    const escapedJsonPath = path.join(root, 'escaped.json');
    const unsafeDate = `..${path.sep}escaped`;

    const { writeReportBundle } = await loadReportModule();

    await expect(
      writeReportBundle(
        {
          date: unsafeDate,
          generatedAt: '2026-08-16T12:00:00.000Z',
          collectedAt: [],
          profileVersion: confirmedProfile.version,
          newJobs: [],
          recommendedJobs: [],
          deadlineReminders: [],
          sourceStatuses: [],
          failures: [],
          anomalies: [],
        },
        outputRoot,
      ),
    ).rejects.toThrow(/date|safe|invalid/i);
    await expect(readFile(escapedJsonPath)).rejects.toThrow();
  });

  it('将 javascript 岗位链接渲染为不可点击文本并保留安全 HTTPS 链接', async () => {
    const root = await makeTempDir();
    const outputRoot = path.join(root, 'reports');
    const { buildDailyReport, writeReportBundle } = await loadReportModule();

    const report = buildDailyReport(
      [
        {
          id: 'unsafe-url-job',
          source: 'test',
          title: 'Unsafe URL Job',
          company: 'Acme',
          location: 'Shanghai',
          requirements: [],
          url: 'javascript:alert(1)',
          collectedAt: '2026-08-16T08:00:00.000Z',
        },
        {
          id: 'safe-url-job',
          source: 'test',
          title: 'Safe URL Job',
          company: 'Acme',
          location: 'Shanghai',
          requirements: [],
          url: 'https://jobs.example.com/roles/safe',
          collectedAt: '2026-08-16T08:00:00.000Z',
        },
      ],
      confirmedProfile,
      '2026-08-16',
    );

    await writeReportBundle(report, outputRoot);

    const htmlContent = await readFile(path.join(outputRoot, '2026-08-16.html'), 'utf8');

    expect(htmlContent).toContain('URL: javascript:alert(1)');
    expect(htmlContent).not.toMatch(/href\s*=\s*["']javascript:/i);
    expect(htmlContent).toContain(
      '<a href="https://jobs.example.com/roles/safe">https://jobs.example.com/roles/safe</a>',
    );
  });
});
