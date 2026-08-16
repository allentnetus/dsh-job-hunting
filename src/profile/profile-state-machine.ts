import type { ResumeAssessment } from '../domain/llm-contracts.js';
import type { CareerProfile, CareerProfileDraft, ProfileFeedback } from '../domain/types.js';
import { confirmProfile, createDraftProfile } from './career-profile.js';
import {
  getResumeDocumentState,
  type ResumeConfirmation,
  type ResumeDocument,
  type ResumeDocumentState,
} from '../resume/resume-document.js';

type WorkflowState =
  | ResumeDocumentState
  | CareerProfileDraft['state']
  | NonNullable<CareerProfile['state']>;

export interface StructuredTransitionError {
  name: 'ProfileStateTransitionError';
  code: 'INVALID_STATE_TRANSITION' | 'MISSING_ASSESSMENT';
  from: WorkflowState;
  to: WorkflowState;
  allowed: WorkflowState[];
}

export type TransitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StructuredTransitionError };

export class ProfileStateTransitionError extends Error {
  readonly code: StructuredTransitionError['code'];
  readonly from: WorkflowState;
  readonly to: WorkflowState;
  readonly allowed: WorkflowState[];

  constructor(
    details: {
      from: WorkflowState;
      to: WorkflowState;
      allowed: WorkflowState[];
      code?: StructuredTransitionError['code'];
      message?: string;
    },
  ) {
    super(details.message ?? `Cannot transition from ${details.from} to ${details.to}`);
    this.name = 'ProfileStateTransitionError';
    this.code = details.code ?? 'INVALID_STATE_TRANSITION';
    this.from = details.from;
    this.to = details.to;
    this.allowed = [...details.allowed];
  }
}

const allowedTransitions: Record<WorkflowState, WorkflowState[]> = {
  parsed: ['user-confirmed'],
  'user-confirmed': ['assessed'],
  assessed: ['profile-draft'],
  'profile-draft': ['profile-confirmed'],
  'profile-confirmed': [],
};

const invalidTransition = (from: WorkflowState, to: WorkflowState): StructuredTransitionError => ({
  name: 'ProfileStateTransitionError',
  code: 'INVALID_STATE_TRANSITION',
  from,
  to,
  allowed: [...allowedTransitions[from]],
});

const missingAssessment = (from: WorkflowState, to: WorkflowState): StructuredTransitionError => ({
  name: 'ProfileStateTransitionError',
  code: 'MISSING_ASSESSMENT',
  from,
  to,
  allowed: [...allowedTransitions[from]],
});

export const ensureTransition = (
  from: WorkflowState,
  to: WorkflowState,
): StructuredTransitionError | undefined => {
  if (allowedTransitions[from].includes(to)) {
    return undefined;
  }

  return invalidTransition(from, to);
};

export const confirmResumeDocument = (
  document: ResumeDocument,
  confirmation: ResumeConfirmation,
): TransitionResult<ResumeDocument> => {
  const currentState = getResumeDocumentState(document);
  const error = ensureTransition(currentState, 'user-confirmed');
  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    value: {
      ...document,
      state: 'user-confirmed',
      confirmation: {
        confirmedAt: confirmation.confirmedAt,
        corrections: confirmation.corrections.map((correction) => ({ ...correction })),
      },
    },
  };
};

export const applyResumeAssessment = (
  document: ResumeDocument,
  assessment: ResumeAssessment,
): TransitionResult<ResumeDocument> => {
  const currentState = getResumeDocumentState(document);
  const error = ensureTransition(currentState, 'assessed');
  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    value: {
      ...document,
      state: 'assessed',
      assessment,
    },
  };
};

export const createProfileDraftState = (
  document: ResumeDocument,
  feedback: Omit<ProfileFeedback, 'assessment'>,
): TransitionResult<CareerProfileDraft> => {
  const currentState = getResumeDocumentState(document);
  const error = ensureTransition(currentState, 'profile-draft');
  if (error) {
    return { ok: false, error };
  }

  if (!document.assessment) {
    return {
      ok: false,
      error: missingAssessment(currentState, 'profile-draft'),
    };
  }

  const draftInput: ProfileFeedback = {
    ...feedback,
    assessment: document.assessment,
  };

  return {
    ok: true,
    value: createDraftProfile(draftInput),
  };
};

export const confirmProfileState = (
  draft: CareerProfileDraft,
): TransitionResult<CareerProfile> => {
  const error = ensureTransition(draft.state, 'profile-confirmed');
  if (error) {
    return { ok: false, error };
  }

  return {
    ok: true,
    value: confirmProfile(draft),
  };
};
