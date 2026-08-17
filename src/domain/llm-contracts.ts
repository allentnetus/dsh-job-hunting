export type UnknownValue = 'unknown';

export type AssessmentConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface AssessmentTarget {
  role?: string;
  company?: string;
  industry?: string;
  location?: string;
}

export interface EvidenceReference {
  section: string | UnknownValue;
  fact: string | UnknownValue;
  quote: string | UnknownValue;
}

export interface ResumeAssessmentSuggestion {
  category:
    | 'contact'
    | 'education'
    | 'experience'
    | 'format'
    | 'gap'
    | 'skills'
    | 'targeting';
  message: string;
  confidence: AssessmentConfidence;
  evidence: EvidenceReference;
}

export interface ResumeAssessmentFacts {
  candidateName: string | UnknownValue;
  currentRole: string | UnknownValue;
  recentCompany: string | UnknownValue;
  preferredLocation: string | UnknownValue;
  education: string | UnknownValue;
  skills: string[] | UnknownValue;
}

export interface ResumeAssessment {
  schemaVersion: 'resume-assessment/v1';
  assessor: 'baseline-deterministic';
  generatedAt: string;
  summary: string;
  target: AssessmentTarget | UnknownValue;
  extractedFacts: ResumeAssessmentFacts;
  suggestions: ResumeAssessmentSuggestion[];
}

export const UNKNOWN_VALUE: UnknownValue = 'unknown';

export const unknownEvidence = (fact: string = UNKNOWN_VALUE): EvidenceReference => ({
  section: UNKNOWN_VALUE,
  fact,
  quote: UNKNOWN_VALUE,
});
