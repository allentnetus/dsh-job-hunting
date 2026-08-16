import { extractDocx } from './docx-parser.js';
import { parseTextPdf } from './pdf-parser.js';
import { createResumeParseError, } from './resume-document.js';
import { normalizeResumeText, parseText } from './text-parser.js';
const supportedResumeGuidance = [
    'Upload a DOCX, text-based PDF, TXT, or Markdown resume file.',
    'For PDFs, export the resume with selectable text instead of a scan or image-only printout.',
];
const extensionFromName = (name) => {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex < 0 || lastDotIndex === name.length - 1) {
        return undefined;
    }
    return name.slice(lastDotIndex + 1).toLowerCase();
};
const labelFromMediaType = (mediaType) => {
    if (!mediaType) {
        return undefined;
    }
    const normalizedMediaType = mediaType.toLowerCase();
    if (normalizedMediaType.startsWith('image/')) {
        return normalizedMediaType.slice('image/'.length);
    }
    return normalizedMediaType;
};
const detectResumeKind = (file) => {
    const extension = extensionFromName(file.name);
    const mediaType = file.mediaType?.toLowerCase();
    if (extension === 'docx' ||
        mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return { kind: 'docx' };
    }
    if (extension === 'pdf' || mediaType === 'application/pdf') {
        return { kind: 'pdf' };
    }
    if (extension === 'txt' || mediaType === 'text/plain') {
        return { kind: 'text' };
    }
    if (extension === 'md' ||
        extension === 'markdown' ||
        mediaType === 'text/markdown' ||
        mediaType === 'text/x-markdown') {
        return { kind: 'markdown' };
    }
    if (mediaType?.startsWith('image/')) {
        return { kind: 'image', label: labelFromMediaType(mediaType) ?? extension ?? 'image' };
    }
    if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
        return { kind: 'image', label: extension };
    }
    return {
        kind: 'unknown',
        label: extension ?? labelFromMediaType(mediaType) ?? 'unknown',
    };
};
const imageFormatError = (format) => createResumeParseError({
    code: 'UNSUPPORTED_IMAGE_FORMAT',
    format,
    message: 'Image resumes are not supported in v0.1. Please upload a DOCX or text-based PDF instead.',
    guidance: [
        'Export the resume from Word, Google Docs, or your resume builder as DOCX or text PDF.',
        'Do not upload screenshots or photographed pages.',
    ],
});
export const unsupportedFormatError = (format) => createResumeParseError({
    code: 'UNSUPPORTED_FORMAT',
    format,
    message: `Unsupported resume format "${format}". Please upload a DOCX, PDF, TXT, or Markdown file.`,
    guidance: supportedResumeGuidance,
});
const buildResumeDocument = (file, format, extractedText, warnings) => {
    const document = {
        fileName: file.name,
        format,
        extractedText,
        normalizedText: normalizeResumeText(extractedText),
        warnings,
    };
    if (file.mediaType) {
        document.mediaType = file.mediaType;
    }
    return document;
};
export const parseResume = async (file) => {
    const detected = detectResumeKind(file);
    switch (detected.kind) {
        case 'docx': {
            const result = await extractDocx(file.buffer);
            return buildResumeDocument(file, 'docx', result.text, result.warnings);
        }
        case 'pdf':
            return buildResumeDocument(file, 'pdf', await parseTextPdf(file.buffer), []);
        case 'text':
            return buildResumeDocument(file, 'text', parseText(file.buffer), []);
        case 'markdown':
            return buildResumeDocument(file, 'markdown', parseText(file.buffer), []);
        case 'image':
            throw imageFormatError(detected.label);
        case 'unknown':
            throw unsupportedFormatError(detected.label);
    }
};
//# sourceMappingURL=parse-resume.js.map