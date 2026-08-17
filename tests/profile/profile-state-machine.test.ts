import { describe, expect, it, vi } from 'vitest';

import type { CareerProfile } from '../../src/domain/types.js';
import type { ResumeDocument } from '../../src/resume/resume-document.js';

const loadResumeAssessorModule = async () =>
  import('../../src/resume/resume-assessor.js').catch(() => undefined);

const loadProfileStateMachineModule = async () =>
  import('../../src/profile/profile-state-machine.js').catch(() => undefined);

const loadCareerProfileModule = async () =>
  import('../../src/profile/career-profile.js').catch(() => undefined);

const createParsedResume = (overrides: Partial<ResumeDocument> = {}): ResumeDocument =>
  ({
    fileName: 'candidate.md',
    format: 'markdown',
    extractedText: [
      'Jane Doe',
      'Data Analyst',
      '',
      'Experience',
      'Acme Analytics',
      'Built dashboards with SQL and Python.',
      '',
      'Skills',
      'SQL, Python',
    ].join('\n'),
    normalizedText: [
      'Jane Doe',
      'Data Analyst',
      '',
      'Experience',
      'Acme Analytics',
      'Built dashboards with SQL and Python.',
      '',
      'Skills',
      'SQL, Python',
    ].join('\n'),
    warnings: [],
    ...overrides,
  }) as ResumeDocument;

describe('profile state machine', () => {
  it('按 parsed -> user-confirmed -> assessed -> profile-draft -> profile-confirmed 流转，并分开保存用户修正与模型建议', async () => {
    const stateMachineModule = await loadProfileStateMachineModule();
    const assessorModule = await loadResumeAssessorModule();
    const careerProfileModule = await loadCareerProfileModule();

    expect(stateMachineModule).toBeDefined();
    expect(assessorModule).toBeDefined();
    expect(careerProfileModule).toBeDefined();
    if (!stateMachineModule || !assessorModule || !careerProfileModule) {
      return;
    }

    const confirmedResult = stateMachineModule.confirmResumeDocument(createParsedResume(), {
      confirmedAt: '2026-08-16T09:00:00.000Z',
      corrections: [
        {
          section: 'experience',
          field: 'company',
          originalValue: 'Acme Analytic',
          correctedValue: 'Acme Analytics',
        },
      ],
    });

    expect(confirmedResult).toMatchObject({
      ok: true,
      value: {
        state: 'user-confirmed',
        confirmation: {
          corrections: [
            {
              correctedValue: 'Acme Analytics',
            },
          ],
        },
      },
    });
    if (!confirmedResult.ok) {
      return;
    }

    const assessment = await assessorModule.assessResume(confirmedResult.value, {
      role: 'Data Analyst',
    });
    const assessedResult = stateMachineModule.applyResumeAssessment(
      confirmedResult.value,
      assessment,
    );

    expect(assessedResult).toMatchObject({
      ok: true,
      value: {
        state: 'assessed',
        assessment: expect.objectContaining({
          schemaVersion: 'resume-assessment/v1',
        }),
      },
    });
    if (!assessedResult.ok) {
      return;
    }

    const draftResult = stateMachineModule.createProfileDraftState(assessedResult.value, {
      targetRoles: ['Senior Data Analyst'],
      preferredLocations: ['Shanghai'],
      notes: ['Prefer analytics platforms over generic ops roles.'],
    });

    expect(draftResult).toMatchObject({
      ok: true,
      value: {
        state: 'profile-draft',
        userFeedback: {
          targetRoles: ['Senior Data Analyst'],
          preferredLocations: ['Shanghai'],
        },
      },
    });
    if (!draftResult.ok) {
      return;
    }

    expect(draftResult.value.modelSuggestions).toEqual(assessment.suggestions);
    expect(draftResult.value.userFeedback).not.toHaveProperty('assessment');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T10:00:00.000Z'));
    const confirmedProfile = careerProfileModule.confirmProfile(draftResult.value);
    vi.useRealTimers();

    expect(confirmedProfile).toMatchObject({
      state: 'profile-confirmed',
      version: 1,
      confirmedAt: '2026-08-16T10:00:00.000Z',
      targetRoles: ['Senior Data Analyst'],
      preferredLocations: ['Shanghai'],
    });
  });

  it('非法状态转移返回结构化错误', async () => {
    const stateMachineModule = await loadProfileStateMachineModule();

    expect(stateMachineModule).toBeDefined();
    if (!stateMachineModule) {
      return;
    }

    const invalidDraftResult = stateMachineModule.createProfileDraftState(createParsedResume(), {
      targetRoles: ['Data Analyst'],
    });

    expect(invalidDraftResult).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'INVALID_STATE_TRANSITION',
        from: 'parsed',
        to: 'profile-draft',
        allowed: ['user-confirmed'],
      },
    });
  });

  it('user-confirmed 无 assessment 不能直接创建 profile draft', async () => {
    const stateMachineModule = await loadProfileStateMachineModule();

    expect(stateMachineModule).toBeDefined();
    if (!stateMachineModule) {
      return;
    }

    const invalidDraftResult = stateMachineModule.createProfileDraftState(
      createParsedResume({
        state: 'user-confirmed',
        confirmation: {
          confirmedAt: '2026-08-16T09:00:00.000Z',
          corrections: [],
        },
      }),
      {
        targetRoles: ['Data Analyst'],
      },
    );

    expect(invalidDraftResult).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'INVALID_STATE_TRANSITION',
        from: 'user-confirmed',
        to: 'profile-draft',
        allowed: ['assessed'],
      },
    });
  });

  it('state=assessed 但缺少 assessment 时返回结构化错误', async () => {
    const stateMachineModule = await loadProfileStateMachineModule();

    expect(stateMachineModule).toBeDefined();
    if (!stateMachineModule) {
      return;
    }

    const invalidDraftResult = stateMachineModule.createProfileDraftState(
      createParsedResume({
        state: 'assessed',
      }),
      {
        targetRoles: ['Senior Data Analyst'],
      },
    );

    expect(invalidDraftResult).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'MISSING_ASSESSMENT',
        from: 'assessed',
        to: 'profile-draft',
        allowed: ['profile-draft'],
      },
    });
  });

  it('拒绝重复确认简历与非法确认 profile draft', async () => {
    const stateMachineModule = await loadProfileStateMachineModule();

    expect(stateMachineModule).toBeDefined();
    if (!stateMachineModule) {
      return;
    }

    expect(
      stateMachineModule.confirmResumeDocument(
        createParsedResume({
          state: 'user-confirmed',
          confirmation: {
            confirmedAt: '2026-08-16T09:00:00.000Z',
            corrections: [],
          },
        }),
        {
          confirmedAt: '2026-08-16T09:05:00.000Z',
          corrections: [],
        },
      ),
    ).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'INVALID_STATE_TRANSITION',
        from: 'user-confirmed',
        to: 'user-confirmed',
        allowed: ['assessed'],
      },
    });

    expect(
      stateMachineModule.confirmResumeDocument(
        createParsedResume({
          state: 'assessed',
          assessment: {
            schemaVersion: 'resume-assessment/v1',
            assessor: 'baseline-deterministic',
            generatedAt: '2026-08-16T09:10:00.000Z',
            summary: 'Existing assessment.',
            target: 'unknown',
            extractedFacts: {
              candidateName: 'Jane Doe',
              currentRole: 'Data Analyst',
              recentCompany: 'Acme Analytics',
              preferredLocation: 'unknown',
              education: 'unknown',
              skills: ['SQL'],
            },
            suggestions: [],
          },
        }),
        {
          confirmedAt: '2026-08-16T09:15:00.000Z',
          corrections: [],
        },
      ),
    ).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'INVALID_STATE_TRANSITION',
        from: 'assessed',
        to: 'user-confirmed',
        allowed: ['profile-draft'],
      },
    });

    expect(
      stateMachineModule.confirmProfileState({
        state: 'assessed',
        targetRoles: [],
        targetIndustries: [],
        targetCompanies: [],
        preferredLocations: [],
        excludedLocations: [],
        keywords: [],
        avoid: [],
        notes: [],
        unknowns: [],
        userFeedback: {},
        modelSuggestions: [],
        proposedVersion: 1,
      } as never),
    ).toEqual({
      ok: false,
      error: {
        name: 'ProfileStateTransitionError',
        code: 'INVALID_STATE_TRANSITION',
        from: 'assessed',
        to: 'profile-confirmed',
        allowed: ['profile-draft'],
      },
    });
  });

  it('updateProfile 只返回草稿，不直接覆盖已确认画像', async () => {
    const careerProfileModule = await loadCareerProfileModule();

    expect(careerProfileModule).toBeDefined();
    if (!careerProfileModule) {
      return;
    }

    const confirmedProfile: CareerProfile = {
      state: 'profile-confirmed',
      targetRoles: ['Data Analyst'],
      targetIndustries: ['Fintech'],
      targetCompanies: ['Acme'],
      preferredLocations: ['Shanghai'],
      excludedLocations: ['Remote'],
      keywords: ['SQL'],
      avoid: ['door-to-door'],
      userFeedbackHistory: [
        {
          targetRoles: ['Data Analyst'],
        },
      ],
      modelSuggestions: [],
      notes: [],
      unknowns: [],
      version: 2,
      confirmedAt: '2026-08-15T08:00:00.000Z',
    };

    const draft = careerProfileModule.updateProfile(confirmedProfile, {
      targetRoles: ['Senior Data Analyst'],
      keywords: ['SQL', 'Python'],
      notes: ['Add Python-heavy analytics roles.'],
    });

    expect(draft).toMatchObject({
      state: 'profile-draft',
      baseProfileVersion: 2,
      proposedVersion: 3,
      targetRoles: ['Senior Data Analyst'],
      keywords: ['SQL', 'Python'],
    });
    expect(draft).not.toHaveProperty('confirmedAt');
    expect(confirmedProfile.targetRoles).toEqual(['Data Analyst']);
    expect(confirmedProfile.version).toBe(2);
  });
});
