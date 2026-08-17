import { describe, expect, it } from 'vitest';

import type { ResumeDocument } from '../../src/resume/resume-document.js';

const loadResumeAssessorModule = async () =>
  import('../../src/resume/resume-assessor.js').catch(() => undefined);

const createParsedResume = (overrides: Partial<ResumeDocument> = {}): ResumeDocument =>
  ({
    fileName: 'jane-doe-resume.md',
    format: 'markdown',
    extractedText: [
      'Jane Doe',
      'Data Analyst',
      '',
      'Experience',
      'Acme Analytics',
      'Built dashboards with SQL.',
      '',
      'Skills',
      'SQL, Python',
      '',
      'Education',
      'BSc Statistics',
    ].join('\n'),
    normalizedText: [
      'Jane Doe',
      'Data Analyst',
      '',
      'Experience',
      'Acme Analytics',
      'Built dashboards with SQL.',
      '',
      'Skills',
      'SQL, Python',
      '',
      'Education',
      'BSc Statistics',
    ].join('\n'),
    warnings: [],
    ...overrides,
  }) as ResumeDocument;

describe('resume assessor', () => {
  it('拒绝未确认简历进入评估', async () => {
    const assessorModule = await loadResumeAssessorModule();

    expect(assessorModule).toBeDefined();
    if (!assessorModule) {
      return;
    }

    await expect(assessorModule.assessResume(createParsedResume())).rejects.toMatchObject({
      name: 'ProfileStateTransitionError',
      code: 'INVALID_STATE_TRANSITION',
      from: 'parsed',
      to: 'assessed',
      allowed: ['user-confirmed'],
    });
  });

  it('用户确认的 correction 会覆盖评估事实与证据，但不改写 extractedText', async () => {
    const assessorModule = await loadResumeAssessorModule();

    expect(assessorModule).toBeDefined();
    if (!assessorModule) {
      return;
    }

    const originalText = [
      'Jane Doe',
      'Data Analyst',
      'Location: Beijing',
      '',
      'Experience',
      'Acme Analytics',
      'Built dashboards with Excel.',
      '',
      'Skills',
      'Excel',
      '',
      'Education',
      'BSc Mathematics',
    ].join('\n');

    const confirmedDocument = createParsedResume({
      extractedText: originalText,
      normalizedText: originalText,
      state: 'user-confirmed',
      confirmation: {
        confirmedAt: '2026-08-16T08:30:00.000Z',
        corrections: [
          {
            section: 'experience',
            field: 'company',
            originalValue: 'Acme Analytics',
            correctedValue: 'Delta Analytics',
          },
          {
            section: 'header',
            field: 'currentRole',
            originalValue: 'Data Analyst',
            correctedValue: 'Senior Data Analyst',
          },
          {
            section: 'header',
            field: 'preferredLocation',
            originalValue: 'Beijing',
            correctedValue: 'Shanghai',
          },
          {
            section: 'education',
            field: 'education',
            originalValue: 'BSc Mathematics',
            correctedValue: 'MSc Statistics',
          },
          {
            section: 'skills',
            field: 'skills',
            originalValue: 'Excel',
            correctedValue: 'SQL, Python',
          },
          {
            section: 'header',
            field: 'portfolio',
            originalValue: 'unknown',
            correctedValue: 'janedoe.dev',
          },
        ],
      },
    });

    const assessment = await assessorModule.assessResume(confirmedDocument, {
      role: 'Senior Data Analyst',
      location: 'Shanghai',
    });

    expect(assessment.extractedFacts).toEqual({
      candidateName: 'Jane Doe',
      currentRole: 'Senior Data Analyst',
      recentCompany: 'Delta Analytics',
      preferredLocation: 'Shanghai',
      education: 'MSc Statistics',
      skills: ['SQL', 'Python'],
    });
    expect(assessment.summary).toContain('role=Senior Data Analyst');
    expect(assessment.summary).toContain('recentCompany=Delta Analytics');
    expect(assessment.summary).toContain('skills=SQL, Python');
    expect(assessment.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'experience',
          evidence: expect.objectContaining({
            fact: 'recentCompany',
            quote: 'Delta Analytics',
          }),
        }),
        expect.objectContaining({
          category: 'skills',
          evidence: expect.objectContaining({
            fact: 'skills',
            quote: 'SQL, Python',
          }),
        }),
        expect.objectContaining({
          category: 'education',
          evidence: expect.objectContaining({
            fact: 'education',
            quote: 'MSc Statistics',
          }),
        }),
        expect.objectContaining({
          category: 'targeting',
          evidence: expect.objectContaining({
            fact: 'currentRole',
            quote: 'Senior Data Analyst',
          }),
        }),
        expect.objectContaining({
          category: 'gap',
          evidence: expect.objectContaining({
            fact: 'preferredLocation',
            quote: 'Shanghai',
          }),
        }),
      ]),
    );
    expect(assessment.summary).not.toContain('janedoe.dev');
    expect(confirmedDocument.extractedText).toBe(originalText);
    expect(confirmedDocument.normalizedText).toBe(originalText);
  });

  it('仅为确认后的简历生成带证据和置信度的评估，并对信息不足标记 unknown', async () => {
    const assessorModule = await loadResumeAssessorModule();

    expect(assessorModule).toBeDefined();
    if (!assessorModule) {
      return;
    }

    const confirmedDocument = createParsedResume({
      state: 'user-confirmed',
      confirmation: {
        confirmedAt: '2026-08-16T08:00:00.000Z',
        corrections: [
          {
            section: 'experience',
            field: 'dates',
            originalValue: '2024',
            correctedValue: '2023',
            note: 'User corrected the start date.',
          },
        ],
      },
    });

    const assessment = await assessorModule.assessResume(confirmedDocument, {
      role: 'Senior Data Analyst',
      location: 'Shanghai',
    });

    expect(assessment).toMatchObject({
      schemaVersion: 'resume-assessment/v1',
      assessor: 'baseline-deterministic',
      extractedFacts: {
        currentRole: 'Data Analyst',
        recentCompany: 'Acme Analytics',
        preferredLocation: 'unknown',
      },
    });
    expect(assessment.suggestions.length).toBeGreaterThan(0);

    for (const suggestion of assessment.suggestions) {
      expect(suggestion.confidence).toMatch(/^(high|medium|low|unknown)$/);
      expect(suggestion.evidence).toEqual({
        section: expect.any(String),
        fact: expect.any(String),
        quote: expect.any(String),
      });
    }

    expect(assessment.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({
            section: 'skills',
            quote: expect.stringContaining('SQL'),
          }),
        }),
        expect.objectContaining({
          evidence: expect.objectContaining({
            section: 'unknown',
            fact: 'preferredLocation',
            quote: 'unknown',
          }),
          confidence: 'unknown',
        }),
      ]),
    );
  });

  it('拒绝对已 assessed 的简历再次评估', async () => {
    const assessorModule = await loadResumeAssessorModule();

    expect(assessorModule).toBeDefined();
    if (!assessorModule) {
      return;
    }

    await expect(
      assessorModule.assessResume(
        createParsedResume({
          state: 'assessed',
          assessment: {
            schemaVersion: 'resume-assessment/v1',
            assessor: 'baseline-deterministic',
            generatedAt: '2026-08-16T08:00:00.000Z',
            summary: 'Existing assessment.',
            target: 'unknown',
            extractedFacts: {
              candidateName: 'Jane Doe',
              currentRole: 'Data Analyst',
              recentCompany: 'Acme Analytics',
              preferredLocation: 'unknown',
              education: 'BSc Statistics',
              skills: ['SQL', 'Python'],
            },
            suggestions: [],
          },
        }),
      ),
    ).rejects.toMatchObject({
      name: 'ProfileStateTransitionError',
      code: 'INVALID_STATE_TRANSITION',
      from: 'assessed',
      to: 'assessed',
      allowed: ['profile-draft'],
    });
  });
});
