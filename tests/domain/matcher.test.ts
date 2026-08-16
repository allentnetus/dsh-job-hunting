import { describe, expect, it } from 'vitest';

import { normalizeJob } from '../../src/domain/job-ledger.js';
import { matchJob } from '../../src/domain/matcher.js';
import type { CareerProfile, JobInput } from '../../src/domain/types.js';

const profile: CareerProfile = {
  targetRoles: ['Data Analyst'],
  targetIndustries: ['Fintech'],
  targetCompanies: ['Acme'],
  preferredLocations: ['Shanghai'],
  excludedLocations: ['Remote'],
  keywords: ['SQL', 'Python'],
  avoid: ['sales', 'door-to-door'],
  version: 2,
  confirmedAt: '2026-08-15T00:00:00.000Z',
};

const createJob = (overrides: Partial<JobInput> = {}) =>
  normalizeJob({
    source: 'boss',
    title: 'Data Analyst',
    company: 'Acme Fintech',
    location: 'Shanghai',
    description: 'Build data workflows with SQL and Python.',
    requirements: ['SQL', 'Python'],
    url: 'https://jobs.example.com/role',
    collectedAt: '2026-08-16T00:00:00.000Z',
    ...overrides,
  });

describe('matcher', () => {
  it('为命中目标角色、公司、地点和关键词的岗位给出较高分和可解释原因', () => {
    const job = createJob();

    const result = matchJob(job, profile);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('目标角色'),
        expect.stringContaining('目标公司'),
        expect.stringContaining('优先地点'),
        expect.stringContaining('关键词'),
      ]),
    );
  });

  it('为排斥地点和规避关键词降低分数并说明原因', () => {
    const strongMatch = createJob();
    const riskyJob = createJob({
      title: 'Sales Representative',
      company: 'Generic Commerce',
      location: 'Remote',
      description: 'Door-to-door sales role with weekly outreach targets.',
      requirements: ['Sales'],
      url: 'https://jobs.example.com/risky-role',
    });

    const strongResult = matchJob(strongMatch, profile);
    const riskyResult = matchJob(riskyJob, profile);

    expect(riskyResult.score).toBeLessThan(strongResult.score);
    expect(riskyResult.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('排斥地点'),
        expect.stringContaining('规避关键词'),
      ]),
    );
  });
});
