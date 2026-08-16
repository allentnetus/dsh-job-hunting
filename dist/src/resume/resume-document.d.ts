export type ResumeFormat = 'docx' | 'pdf' | 'text' | 'markdown';
import type { ResumeAssessment } from '../domain/llm-contracts.js';
export type ResumeDocumentState = 'parsed' | 'user-confirmed' | 'assessed';
export interface ResumeUserCorrection {
    section: string;
    field: string;
    originalValue: string;
    correctedValue: string;
    note?: string;
}
export interface ResumeConfirmation {
    confirmedAt: string;
    corrections: readonly ResumeUserCorrection[];
}
export type ResumeParseErrorCode = 'INVALID_PDF' | 'UNSUPPORTED_ENCRYPTED_PDF' | 'UNSUPPORTED_FORMAT' | 'UNSUPPORTED_IMAGE_FORMAT' | 'UNSUPPORTED_SCANNED_PDF';
export interface ResumeFile {
    name: string;
    buffer: Uint8Array;
    mediaType?: string;
}
export interface ResumeDocument {
    fileName: string;
    format: ResumeFormat;
    extractedText: string;
    normalizedText: string;
    warnings: string[];
    mediaType?: string;
    state?: ResumeDocumentState;
    confirmation?: ResumeConfirmation;
    assessment?: ResumeAssessment;
}
export interface ResumeParseErrorInit {
    code: ResumeParseErrorCode;
    format: string;
    message: string;
    guidance: readonly string[];
}
export declare class ResumeParseError extends Error {
    readonly code: ResumeParseErrorCode;
    readonly format: string;
    readonly guidance: readonly string[];
    constructor(init: ResumeParseErrorInit);
}
export declare const createResumeParseError: (init: ResumeParseErrorInit) => ResumeParseError;
export declare const getResumeDocumentState: (document: ResumeDocument) => ResumeDocumentState;
