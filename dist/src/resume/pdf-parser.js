import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createResumeParseError, ResumeParseError } from './resume-document.js';
const encryptedPdfMarker = Buffer.from('/Encrypt', 'utf8');
const scannedPdfError = () => createResumeParseError({
    code: 'UNSUPPORTED_SCANNED_PDF',
    format: 'pdf',
    message: 'This PDF appears to be scanned or image-only. Please upload a text-based PDF or DOCX file.',
    guidance: [
        'Upload a text-based PDF exported from Word or your resume builder.',
        'If you only have scans, convert the resume back to DOCX or export a text PDF before uploading.',
    ],
});
const encryptedPdfError = () => createResumeParseError({
    code: 'UNSUPPORTED_ENCRYPTED_PDF',
    format: 'pdf',
    message: 'This PDF is encrypted or password-protected. Please remove the password and upload an unencrypted text PDF or DOCX file.',
    guidance: [
        'Open the PDF, remove the password or access restrictions, then export it again.',
        'If you can edit the source resume, upload the DOCX version instead.',
    ],
});
const invalidPdfError = () => createResumeParseError({
    code: 'INVALID_PDF',
    format: 'pdf',
    message: 'The PDF could not be read. Please upload a valid text-based PDF or DOCX file.',
    guidance: [
        'Re-export the PDF from the original editor instead of printing through an image-only workflow.',
        'If the problem persists, upload the DOCX version.',
    ],
});
const isEncryptedPdfBuffer = (buffer) => Buffer.from(buffer).includes(encryptedPdfMarker);
const extractPageText = async (documentProxy) => {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
        const page = await documentProxy.getPage(pageNumber);
        try {
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
                .join('')
                .trim();
            pages.push(pageText);
        }
        finally {
            page.cleanup();
        }
    }
    return pages.filter((page) => page.length > 0).join('\n\n');
};
export const parseTextPdf = async (buffer) => {
    if (isEncryptedPdfBuffer(buffer)) {
        throw encryptedPdfError();
    }
    const loadingTask = getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        disableFontFace: true,
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
        useSystemFonts: true,
    });
    try {
        const documentProxy = await loadingTask.promise;
        const extractedText = await extractPageText(documentProxy);
        if (extractedText.trim().length === 0) {
            throw scannedPdfError();
        }
        return extractedText;
    }
    catch (error) {
        if (error instanceof ResumeParseError) {
            throw error;
        }
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'PasswordException' || isEncryptedPdfBuffer(buffer)) {
            throw encryptedPdfError();
        }
        if (errorName === 'InvalidPDFException' || errorName === 'UnknownErrorException') {
            throw invalidPdfError();
        }
        throw error;
    }
    finally {
        await loadingTask.destroy();
    }
};
//# sourceMappingURL=pdf-parser.js.map