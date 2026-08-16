export class ResumeParseError extends Error {
    code;
    format;
    guidance;
    constructor(init) {
        super(init.message);
        this.name = 'ResumeParseError';
        this.code = init.code;
        this.format = init.format;
        this.guidance = [...init.guidance];
    }
}
export const createResumeParseError = (init) => new ResumeParseError(init);
export const getResumeDocumentState = (document) => document.state ?? 'parsed';
//# sourceMappingURL=resume-document.js.map