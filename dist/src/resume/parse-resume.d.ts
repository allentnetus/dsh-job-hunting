import { type ResumeDocument, type ResumeFile, type ResumeParseError } from './resume-document.js';
export declare const unsupportedFormatError: (format: string) => ResumeParseError;
export declare const parseResume: (file: ResumeFile) => Promise<ResumeDocument>;
