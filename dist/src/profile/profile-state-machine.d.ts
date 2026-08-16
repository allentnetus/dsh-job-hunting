import type { ResumeAssessment } from '../domain/llm-contracts.js';
import type { CareerProfile, CareerProfileDraft, ProfileFeedback } from '../domain/types.js';
import { type ResumeConfirmation, type ResumeDocument, type ResumeDocumentState } from '../resume/resume-document.js';
type WorkflowState = ResumeDocumentState | CareerProfileDraft['state'] | NonNullable<CareerProfile['state']>;
export interface StructuredTransitionError {
    name: 'ProfileStateTransitionError';
    code: 'INVALID_STATE_TRANSITION' | 'MISSING_ASSESSMENT';
    from: WorkflowState;
    to: WorkflowState;
    allowed: WorkflowState[];
}
export type TransitionResult<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: StructuredTransitionError;
};
export declare class ProfileStateTransitionError extends Error {
    readonly code: StructuredTransitionError['code'];
    readonly from: WorkflowState;
    readonly to: WorkflowState;
    readonly allowed: WorkflowState[];
    constructor(details: {
        from: WorkflowState;
        to: WorkflowState;
        allowed: WorkflowState[];
        code?: StructuredTransitionError['code'];
        message?: string;
    });
}
export declare const ensureTransition: (from: WorkflowState, to: WorkflowState) => StructuredTransitionError | undefined;
export declare const confirmResumeDocument: (document: ResumeDocument, confirmation: ResumeConfirmation) => TransitionResult<ResumeDocument>;
export declare const applyResumeAssessment: (document: ResumeDocument, assessment: ResumeAssessment) => TransitionResult<ResumeDocument>;
export declare const createProfileDraftState: (document: ResumeDocument, feedback: Omit<ProfileFeedback, 'assessment'>) => TransitionResult<CareerProfileDraft>;
export declare const confirmProfileState: (draft: CareerProfileDraft) => TransitionResult<CareerProfile>;
export {};
