import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { normalizeJob } from '../../src/domain/job-ledger.js';
import type { JobRecord } from '../../src/domain/types.js';

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-task-6-jobs-'));
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

describe('local job adapters', () => {
  it('从 JSON 文件标准化岗位，保留 source/url/collectedAt，并跳过格式错误记录', async () => {
    const root = await makeTempDir();
    const jsonPath = path.join(root, 'boss-jobs.json');

    await writeFile(
      jsonPath,
      JSON.stringify(
        [
          {
            source: 'boss',
            title: '  Senior Data Analyst  ',
            company: '  Acme  ',
            location: ' Shanghai ',
            salary: ' 20k-30k ',
            description: ' Build dashboards with SQL. ',
            requirements: [' SQL ', 'Python', 'SQL'],
            url: 'https://jobs.example.com/roles/123?b=2&a=1#fragment',
            postedAt: '2026-08-15',
            deadline: '2026-08-18',
            collectedAt: '2026-08-16T08:00:00.000Z',
          },
          {
            source: 'boss',
            title: 'ML Engineer',
            company: 'Beta',
            location: 'Beijing',
            url: 'https://jobs.example.com/roles/456',
            collectedAt: '2026-08-16T09:00:00.000Z',
          },
          {
            source: 'boss',
            title: 'Broken Record',
            company: 'Gamma',
            location: 'Shenzhen',
            requirements: 'SQL',
            url: 'https://jobs.example.com/roles/789',
            collectedAt: '2026-08-16T10:00:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    await expect(loadCollectorModule()).resolves.toHaveProperty('collectLocalJobs');

    const { collectLocalJobs } = await loadCollectorModule();
    const jobs = await collectLocalJobs({
      sources: [
        {
          source: 'boss',
          format: 'json',
          filePaths: [jsonPath],
        },
      ],
    });

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      source: 'boss',
      title: 'Senior Data Analyst',
      company: 'Acme',
      location: 'Shanghai',
      salary: '20k-30k',
      description: 'Build dashboards with SQL.',
      requirements: ['SQL', 'Python'],
      url: 'https://jobs.example.com/roles/123?a=1&b=2',
      postedAt: '2026-08-15',
      deadline: '2026-08-18',
      collectedAt: '2026-08-16T08:00:00.000Z',
    });
    expect(jobs[1]).toMatchObject({
      source: 'boss',
      title: 'ML Engineer',
      company: 'Beta',
      location: 'Beijing',
      requirements: [],
      url: 'https://jobs.example.com/roles/456',
      collectedAt: '2026-08-16T09:00:00.000Z',
    });
  });

  it('从明确文件和已配置目录收集 Markdown/JSON 岗位，并复用 dedupeJobs 保留 existing 历史对象', async () => {
    const root = await makeTempDir();
    const markdownPath = path.join(root, 'jobs.md');
    const configuredDirectory = path.join(root, 'configured');
    const jsonPath = path.join(configuredDirectory, 'lagou-jobs.json');
    const existingJob: JobRecord = {
      id: 'legacy-job-id',
      source: 'boss',
      title: 'Senior Data Analyst',
      company: 'Acme',
      location: 'Shanghai',
      requirements: ['SQL'],
      url: 'https://jobs.example.com/roles/123?a=1&b=2',
      collectedAt: '2026-08-15T08:00:00.000Z',
      matchScore: 88,
      matchReasons: ['历史已确认'],
    };

    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(configuredDirectory, { recursive: true }),
    );

    await writeFile(
      markdownPath,
      [
        '## Senior Data Analyst',
        '- Source: boss',
        '- Company: Acme',
        '- Location: Shanghai',
        '- URL: https://jobs.example.com/roles/123?b=2&a=1#details',
        '- Collected At: 2026-08-16T08:00:00.000Z',
        '- Salary: 25k-35k',
        '- Requirements:',
        '  - SQL',
        '  - Python',
        '- Description:',
        '  Build reliable analytics products.',
        '',
        '## Platform Engineer',
        '- Company: Delta',
        '- Location: Hangzhou',
        '- URL: https://jobs.example.com/roles/999',
        '- Collected At: 2026-08-16T11:00:00.000Z',
        '- Requirements:',
        '  - Go',
        '  - Kubernetes',
      ].join('\n'),
      'utf8',
    );

    await writeFile(
      jsonPath,
      JSON.stringify(
        [
          {
            source: 'lagou',
            title: 'AI Product Manager',
            company: 'Zeta',
            location: 'Shanghai',
            requirements: ['A/B Testing'],
            url: 'https://jobs.example.com/roles/888',
            collectedAt: '2026-08-16T12:00:00.000Z',
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    await expect(loadCollectorModule()).resolves.toHaveProperty('collectLocalJobs');

    const { collectLocalJobs } = await loadCollectorModule();
    const jobs = await collectLocalJobs({
      existingJobs: [existingJob],
      sources: [
        {
          source: 'boss',
          format: 'markdown',
          filePaths: [markdownPath],
        },
        {
          source: 'lagou',
          format: 'json',
          directory: configuredDirectory,
          configuredDirectories: [configuredDirectory],
        },
      ],
    });

    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toBe(existingJob);
    expect(jobs.map((job) => job.title)).toEqual([
      'Senior Data Analyst',
      'Platform Engineer',
      'AI Product Manager',
    ]);
    expect(jobs[1]).toMatchObject({
      source: 'boss',
      title: 'Platform Engineer',
      company: 'Delta',
      location: 'Hangzhou',
      requirements: ['Go', 'Kubernetes'],
    });
    expect(jobs[2]).toMatchObject({
      source: 'lagou',
      title: 'AI Product Manager',
      company: 'Zeta',
      location: 'Shanghai',
      url: 'https://jobs.example.com/roles/888',
      collectedAt: '2026-08-16T12:00:00.000Z',
    });
  });

  it('拒绝扫描未在 configuredDirectories 中声明的目录', async () => {
    const root = await makeTempDir();
    const directory = path.join(root, 'unconfigured');

    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(directory, { recursive: true }),
    );

    await expect(loadCollectorModule()).resolves.toHaveProperty('collectLocalJobs');

    const { collectLocalJobs } = await loadCollectorModule();

    await expect(
      collectLocalJobs({
        sources: [
          {
            source: 'boss',
            format: 'markdown',
            directory,
            configuredDirectories: [path.join(root, 'configured')],
          },
        ],
      }),
    ).rejects.toThrow(/configuredDirectories/i);
  });

  it('显式文件缺失时保留有效岗位并记录 partial 来源状态和失败信息', async () => {
    const root = await makeTempDir();
    const validPath = path.join(root, 'valid-jobs.json');
    const missingPath = path.join(root, 'missing-jobs.json');

    await writeFile(
      validPath,
      JSON.stringify([
        {
          source: 'boss',
          title: 'Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          requirements: ['SQL'],
          url: 'https://jobs.example.com/roles/valid',
          collectedAt: '2026-08-16T08:00:00.000Z',
        },
      ]),
      'utf8',
    );

    const { collectLocalJobs, readLocalCollectionMeta } = await loadCollectorModule();
    const jobs = await collectLocalJobs({
      sources: [
        {
          source: 'boss',
          format: 'json',
          filePaths: [validPath, missingPath],
        },
      ],
    });
    const metadata = readLocalCollectionMeta(jobs);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ title: 'Data Analyst' });
    expect(metadata?.sourceStatuses).toEqual([
      expect.objectContaining({
        source: 'boss',
        status: 'partial',
        fileCount: 2,
        jobCount: 1,
        errors: expect.arrayContaining([expect.stringMatching(/ENOENT|no such file/i)]),
      }),
    ]);
    expect(metadata?.failures).toEqual([
      expect.objectContaining({
        source: 'boss',
        filePath: missingPath,
        message: expect.stringMatching(/ENOENT|no such file/i),
      }),
    ]);
  });
});
