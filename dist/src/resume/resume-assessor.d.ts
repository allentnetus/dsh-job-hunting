import { type AssessmentTarget, type ResumeAssessment } from '../domain/llm-contracts.js';
import { type ResumeDocument } from './resume-document.js';
export declare const assessResume: (document: ResumeDocument, target?: AssessmentTarget) => Promise<ResumeAssessment>;
