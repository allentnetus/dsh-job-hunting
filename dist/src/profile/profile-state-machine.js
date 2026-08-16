import { confirmProfile, createDraftProfile } from './career-profile.js';
import { getResumeDocumentState, } from '../resume/resume-document.js';
export class ProfileStateTransitionError extends Error {
    code;
    from;
    to;
    allowed;
    constructor(details) {
        super(details.message ?? `Cannot transition from ${details.from} to ${details.to}`);
        this.name = 'ProfileStateTransitionError';
        this.code = details.code ?? 'INVALID_STATE_TRANSITION';
        this.from = details.from;
        this.to = details.to;
        this.allowed = [...details.allowed];
    }
}
const allowedTransitions = {
    parsed: ['user-confirmed'],
    'user-confirmed': ['assessed'],
    assessed: ['profile-draft'],
    'profile-draft': ['profile-confirmed'],
    'profile-confirmed': [],
};
const invalidTransition = (from, to) => ({
    name: 'ProfileStateTransitionError',
    code: 'INVALID_STATE_TRANSITION',
    from,
    to,
    allowed: [...allowedTransitions[from]],
});
const missingAssessment = (from, to) => ({
    name: 'ProfileStateTransitionError',
    code: 'MISSING_ASSESSMENT',
    from,
    to,
    allowed: [...allowedTransitions[from]],
});
export const ensureTransition = (from, to) => {
    if (allowedTransitions[from].includes(to)) {
        return undefined;
    }
    return invalidTransition(from, to);
};
export const confirmResumeDocument = (document, confirmation) => {
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
export const applyResumeAssessment = (document, assessment) => {
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
export const createProfileDraftState = (document, feedback) => {
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
    const draftInput = {
        ...feedback,
        assessment: document.assessment,
    };
    return {
        ok: true,
        value: createDraftProfile(draftInput),
    };
};
export const confirmProfileState = (draft) => {
    const error = ensureTransition(draft.state, 'profile-confirmed');
    if (error) {
        return { ok: false, error };
    }
    return {
        ok: true,
        value: confirmProfile(draft),
    };
};
//# sourceMappingURL=profile-state-machine.js.map