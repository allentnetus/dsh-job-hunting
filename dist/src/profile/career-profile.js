import { UNKNOWN_VALUE } from '../domain/llm-contracts.js';
const unique = (values) => {
    const normalized = new Set();
    const result = [];
    for (const value of values) {
        const trimmed = value.trim();
        if (trimmed === '') {
            continue;
        }
        const key = trimmed.toLowerCase();
        if (normalized.has(key)) {
            continue;
        }
        normalized.add(key);
        result.push(trimmed);
    }
    return result;
};
const toArray = (values) => unique(values ?? []);
const withoutAssessment = (feedback) => {
    const { assessment: _assessment, ...userFeedback } = feedback;
    return userFeedback;
};
const collectUnknowns = (feedback) => {
    const facts = feedback.assessment?.extractedFacts;
    if (!facts) {
        return [];
    }
    const unknowns = [];
    if (facts.currentRole === UNKNOWN_VALUE) {
        unknowns.push('currentRole');
    }
    if (facts.preferredLocation === UNKNOWN_VALUE) {
        unknowns.push('preferredLocation');
    }
    if (facts.education === UNKNOWN_VALUE) {
        unknowns.push('education');
    }
    if (facts.skills === UNKNOWN_VALUE) {
        unknowns.push('skills');
    }
    return unique(unknowns);
};
const resolveTargetRoles = (feedback) => {
    const explicit = toArray(feedback.targetRoles);
    if (explicit.length > 0) {
        return explicit;
    }
    const currentRole = feedback.assessment?.extractedFacts.currentRole;
    return typeof currentRole === 'string' && currentRole !== UNKNOWN_VALUE ? [currentRole] : [];
};
const resolvePreferredLocations = (feedback) => {
    const explicit = toArray(feedback.preferredLocations);
    if (explicit.length > 0) {
        return explicit;
    }
    const preferredLocation = feedback.assessment?.extractedFacts.preferredLocation;
    return typeof preferredLocation === 'string' && preferredLocation !== UNKNOWN_VALUE
        ? [preferredLocation]
        : [];
};
const resolveKeywords = (feedback) => {
    const explicit = toArray(feedback.keywords);
    const skills = feedback.assessment?.extractedFacts.skills;
    const extracted = Array.isArray(skills) ? skills : [];
    return unique([...explicit, ...extracted]);
};
export const createDraftProfile = (input) => ({
    state: 'profile-draft',
    targetRoles: resolveTargetRoles(input),
    targetIndustries: toArray(input.targetIndustries),
    targetCompanies: toArray(input.targetCompanies),
    preferredLocations: resolvePreferredLocations(input),
    excludedLocations: toArray(input.excludedLocations),
    keywords: resolveKeywords(input),
    avoid: toArray(input.avoid),
    notes: toArray(input.notes),
    unknowns: collectUnknowns(input),
    userFeedback: withoutAssessment(input),
    modelSuggestions: input.assessment?.suggestions.map((suggestion) => ({
        ...suggestion,
        evidence: { ...suggestion.evidence },
    })) ?? [],
    proposedVersion: 1,
    ...(input.shareIndustriesAcrossCities !== undefined
        ? { shareIndustriesAcrossCities: input.shareIndustriesAcrossCities }
        : {}),
    ...(input.industriesByCity
        ? {
            industriesByCity: Object.fromEntries(Object.entries(input.industriesByCity).map(([city, industries]) => [city, unique(industries)])),
        }
        : {}),
});
export const confirmProfile = (draft) => ({
    state: 'profile-confirmed',
    targetRoles: [...draft.targetRoles],
    targetIndustries: [...draft.targetIndustries],
    targetCompanies: [...draft.targetCompanies],
    preferredLocations: [...draft.preferredLocations],
    excludedLocations: [...draft.excludedLocations],
    keywords: [...draft.keywords],
    avoid: [...draft.avoid],
    notes: [...draft.notes],
    unknowns: [...draft.unknowns],
    modelSuggestions: draft.modelSuggestions.map((suggestion) => ({
        ...suggestion,
        evidence: { ...suggestion.evidence },
    })),
    userFeedbackHistory: [...(draft.previousFeedbackHistory ?? []), { ...draft.userFeedback }],
    version: draft.proposedVersion,
    confirmedAt: new Date().toISOString(),
    ...(draft.shareIndustriesAcrossCities !== undefined
        ? { shareIndustriesAcrossCities: draft.shareIndustriesAcrossCities }
        : {}),
    ...(draft.industriesByCity ? { industriesByCity: { ...draft.industriesByCity } } : {}),
});
export const updateProfile = (profile, feedback) => {
    const draftInput = feedback.assessment
        ? {
            ...feedback,
            assessment: feedback.assessment,
        }
        : { ...feedback };
    const draft = createDraftProfile(draftInput);
    return {
        ...draft,
        targetRoles: draft.targetRoles.length > 0 ? draft.targetRoles : [...profile.targetRoles],
        targetIndustries: draft.targetIndustries.length > 0 ? draft.targetIndustries : [...profile.targetIndustries],
        targetCompanies: draft.targetCompanies.length > 0 ? draft.targetCompanies : [...profile.targetCompanies],
        preferredLocations: draft.preferredLocations.length > 0
            ? draft.preferredLocations
            : [...profile.preferredLocations],
        excludedLocations: draft.excludedLocations.length > 0
            ? draft.excludedLocations
            : [...profile.excludedLocations],
        keywords: draft.keywords.length > 0 ? draft.keywords : [...profile.keywords],
        avoid: draft.avoid.length > 0 ? draft.avoid : [...profile.avoid],
        notes: unique([...(profile.notes ?? []), ...draft.notes]),
        unknowns: unique([...(profile.unknowns ?? []), ...draft.unknowns]),
        modelSuggestions: draft.modelSuggestions.length > 0
            ? draft.modelSuggestions
            : [...(profile.modelSuggestions ?? [])],
        baseProfileVersion: profile.version,
        proposedVersion: profile.version + 1,
        previousFeedbackHistory: [...(profile.userFeedbackHistory ?? [])],
        ...(draft.shareIndustriesAcrossCities !== undefined
            ? { shareIndustriesAcrossCities: draft.shareIndustriesAcrossCities }
            : profile.shareIndustriesAcrossCities !== undefined
                ? { shareIndustriesAcrossCities: profile.shareIndustriesAcrossCities }
                : {}),
        ...(draft.industriesByCity
            ? { industriesByCity: { ...draft.industriesByCity } }
            : profile.industriesByCity
                ? { industriesByCity: { ...profile.industriesByCity } }
                : {}),
    };
};
//# sourceMappingURL=career-profile.js.map