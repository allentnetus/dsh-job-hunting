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
