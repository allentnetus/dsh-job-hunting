import { describe, expect, it } from 'vitest';

import { dedupeJobs, normalizeJob } from '../../src/domain/job-ledger.js';
import type { JobInput, JobRecord } from '../../src/domain/types.js';

const createJobInput = (overrides: Partial<JobInput> = {}): JobInput => ({
  source: 'boss',
  title: 'Data Analyst',
  company: 'Acme',
  location: 'Shanghai',
  salary: '20k-30k',
  description: 'Build reliable data products with SQL and Python.',
  requirements: ['SQL', 'Python'],
  url: 'https://jobs.example.com/roles/123',
  collectedAt: '2026-08-16T00:00:00.000Z',
  ...overrides,
});

describe('job ledger', () => {
  it('标准化岗位字段并为同一 URL 生成确定性身份', () => {
    const normalized = normalizeJob(
      createJobInput({
        title: '  Senior   Data Analyst  ',
        company: '  ACME  ',
        location: '  Shanghai  ',
        requirements: [' SQL ', '', 'Python', 'SQL'],
        url: 'https://JOBS.example.com/roles/123?b=2&a=1#detail',
      }),
    );
    const sameJob = normalizeJob(
      createJobInput({
        title: 'Senior Data Analyst',
        company: 'ACME',
        location: 'Shanghai',
        requirements: ['SQL', 'Python'],
        url: 'https://jobs.example.com/roles/123?a=1&b=2',
      }),
    );

    expect(normalized).toMatchObject({
      title: 'Senior Data Analyst',
      company: 'ACME',
      location: 'Shanghai',
      requirements: ['SQL', 'Python'],
      url: 'https://jobs.example.com/roles/123?a=1&b=2',
    });
    expect(normalized.id).toBe(sameJob.id);
  });

  it('优先按标准化 URL 去重，并保留历史岗位与首次来源', () => {
    const existing = [
      normalizeJob(
        createJobInput({
          source: 'boss',
          title: 'Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          url: 'https://jobs.example.com/roles/123?a=1&b=2',
        }),
      ),
      normalizeJob(
        createJobInput({
          source: 'liepin',
          title: 'ML Engineer',
          company: 'Beta',
          location: 'Beijing',
          url: 'https://jobs.example.com/roles/456',
        }),
      ),
    ];
    const incoming = [
      normalizeJob(
        createJobInput({
          source: 'lagou',
          title: 'Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          url: 'https://jobs.example.com/roles/123?b=2&a=1#fragment',
        }),
      ),
      normalizeJob(
        createJobInput({
          source: 'lagou',
          title: 'Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          url: 'https://jobs.example.com/roles/789',
        }),
      ),
    ];

    const deduped = dedupeJobs(existing, incoming);

    expect(deduped).toHaveLength(3);
    expect(deduped.map((job) => job.url)).toEqual([
      'https://jobs.example.com/roles/123?a=1&b=2',
      'https://jobs.example.com/roles/456',
      'https://jobs.example.com/roles/789',
    ]);
    expect(deduped[0]!).toMatchObject({
      source: 'boss',
      title: 'Data Analyst',
      company: 'Acme',
      location: 'Shanghai',
    });
    expect(deduped[2]!.source).toBe('lagou');
  });

  it('在没有 URL 时回退到 company、title、location 作为备用身份', () => {
    const existing = [
      normalizeJob(
        createJobInput({
          source: 'boss',
          title: 'Backend Engineer',
          company: 'Gamma',
          location: 'Shenzhen',
          url: '',
        }),
      ),
    ];
    const incoming = [
      normalizeJob(
        createJobInput({
          source: 'lagou',
          title: '  backend   engineer ',
          company: '  gamma  ',
          location: ' shenzhen ',
          url: '',
        }),
      ),
      normalizeJob(
        createJobInput({
          source: 'zhilian',
          title: 'Backend Engineer',
          company: 'Gamma',
          location: 'Guangzhou',
          url: '',
        }),
      ),
    ];

    const deduped = dedupeJobs(existing, incoming);

    expect(deduped).toHaveLength(2);
    expect(deduped[0]!.source).toBe('boss');
    expect(deduped[1]!).toMatchObject({
      source: 'zhilian',
      title: 'Backend Engineer',
      company: 'Gamma',
      location: 'Guangzhou',
    });
  });

  it('保留 existing 历史记录的原对象原字段原 id，并跳过重复 incoming', () => {
    const existingJob: JobRecord = {
      id: 'legacy-custom-id',
      source: 'boss',
      title: '  Senior Data Analyst  ',
      company: '  Acme  ',
      location: '  Shanghai  ',
      salary: ' 20k-30k ',
      description: '   ',
      requirements: [' SQL ', 'Python '],
      url: ' https://jobs.example.com/roles/123?b=2&a=1#history ',
      postedAt: ' 2026-08-01 ',
      deadline: '   ',
      collectedAt: ' 2026-08-16T00:00:00.000Z ',
      matchScore: 87,
      matchReasons: ['已关联语义', '  保留原值  '],
    };
    const existing = [existingJob];
    const incoming = [
      normalizeJob(
        createJobInput({
          source: 'lagou',
          title: 'Senior Data Analyst',
          company: 'Acme',
          location: 'Shanghai',
          requirements: ['SQL', 'Python'],
          url: 'https://jobs.example.com/roles/123?a=1&b=2',
          postedAt: '2026-08-01',
          deadline: '2026-09-01',
          matchScore: 92,
          matchReasons: ['新抓取语义'],
        }),
      ),
    ];

    const deduped = dedupeJobs(existing, incoming);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toBe(existingJob);
    expect(deduped[0]).toMatchObject({
      id: 'legacy-custom-id',
      title: '  Senior Data Analyst  ',
      company: '  Acme  ',
      location: '  Shanghai  ',
      salary: ' 20k-30k ',
      description: '   ',
      url: ' https://jobs.example.com/roles/123?b=2&a=1#history ',
      postedAt: ' 2026-08-01 ',
      deadline: '   ',
      collectedAt: ' 2026-08-16T00:00:00.000Z ',
      matchScore: 87,
      matchReasons: ['已关联语义', '  保留原值  '],
    });
  });
});
