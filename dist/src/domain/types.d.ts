import type { ResumeAssessment, ResumeAssessmentSuggestion } from './llm-contracts.js';
export type InterestMark = 'none' | 'favorite' | 'interested' | 'excluded';
export interface JobRecord {
    id: string;
    source: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description?: string;
    requirements: string[];
    url: string;
    postedAt?: string;
    deadline?: string;
    collectedAt: string;
    matchScore?: number;
    matchReasons?: string[];
}
export interface JobInput {
    source: string;
    title: string;
    company: string;
    location: string;
    salary?: string;
    description?: string;
    requirements?: readonly string[];
    url?: string;
    postedAt?: string;
    deadline?: string;
    collectedAt: string;
    matchScore?: number;
    matchReasons?: readonly string[];
}
export interface CareerProfile {
    /** Persisted profile schema version; missing means a legacy pre-versioned profile. */
    schemaVersion?: number;
    targetRoles: string[];
    targetIndustries: string[];
    targetCompanies: string[];
    preferredLocations: string[];
    excludedLocations: string[];
    keywords: string[];
    avoid: string[];
    version: number;
    state?: 'profile-confirmed';
    confirmedAt?: string;
    userFeedbackHistory?: ProfileFeedback[];
    modelSuggestions?: ResumeAssessmentSuggestion[];
    notes?: string[];
    unknowns?: string[];
    /** Defaults to true; set false only after the user explicitly requests per-city taxonomies. */
    shareIndustriesAcrossCities?: boolean;
    industriesByCity?: Record<string, string[]>;
}
export interface ProfileFeedback {
    assessment?: ResumeAssessment;
    targetRoles?: readonly string[];
    targetIndustries?: readonly string[];
    targetCompanies?: readonly string[];
    preferredLocations?: readonly string[];
    excludedLocations?: readonly string[];
    keywords?: readonly string[];
    avoid?: readonly string[];
    notes?: readonly string[];
    shareIndustriesAcrossCities?: boolean;
    industriesByCity?: Readonly<Record<string, readonly string[]>>;
}
export interface CareerProfileDraft {
    state: 'profile-draft';
    targetRoles: string[];
    targetIndustries: string[];
    targetCompanies: string[];
    preferredLocations: string[];
    excludedLocations: string[];
    keywords: string[];
    avoid: string[];
    notes: string[];
    unknowns: string[];
    userFeedback: Omit<ProfileFeedback, 'assessment'>;
    modelSuggestions: ResumeAssessmentSuggestion[];
    baseProfileVersion?: number;
    proposedVersion: number;
    previousFeedbackHistory?: ProfileFeedback[];
    shareIndustriesAcrossCities?: boolean;
    industriesByCity?: Record<string, string[]>;
}
export interface InterestState {
    marks: Record<string, InterestMark>;
    notes: Record<string, string>;
    updatedAt: string;
}
export interface MatchResult {
    score: number;
    reasons: string[];
}
