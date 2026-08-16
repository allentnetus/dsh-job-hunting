import { readFile } from 'node:fs/promises';
import { normalizeJob } from '../domain/job-ledger.js';
const createDraft = () => ({
    requirements: [],
    descriptionLines: [],
});
const toOptionalText = (value) => {
    const normalized = value?.trim() ?? '';
    return normalized === '' ? undefined : normalized;
};
const finalizeDraft = (draft, fallbackSource, recordIndex) => {
    if (toOptionalText(draft.title) === undefined ||
        toOptionalText(draft.company) === undefined ||
        toOptionalText(draft.location) === undefined ||
        toOptionalText(draft.collectedAt) === undefined) {
        return {
            message: `record ${recordIndex + 1} is missing one of required fields: title, company, location, collectedAt`,
        };
    }
    return {
        source: toOptionalText(draft.source) ?? fallbackSource,
        title: toOptionalText(draft.title),
        company: toOptionalText(draft.company),
        location: toOptionalText(draft.location),
        requirements: draft.requirements,
        collectedAt: toOptionalText(draft.collectedAt),
        ...(toOptionalText(draft.salary) === undefined
            ? {}
            : { salary: toOptionalText(draft.salary) }),
        ...(toOptionalText(draft.url) === undefined ? {} : { url: toOptionalText(draft.url) }),
        ...(toOptionalText(draft.postedAt) === undefined
            ? {}
            : { postedAt: toOptionalText(draft.postedAt) }),
        ...(toOptionalText(draft.deadline) === undefined
            ? {}
            : { deadline: toOptionalText(draft.deadline) }),
        ...(toOptionalText(draft.descriptionLines.join('\n')) === undefined
            ? {}
            : { description: toOptionalText(draft.descriptionLines.join('\n')) }),
    };
};
const assignScalarField = (draft, key, value) => {
    switch (key) {
        case 'source':
            draft.source = value;
            return true;
        case 'company':
            draft.company = value;
            return true;
        case 'location':
            draft.location = value;
            return true;
        case 'salary':
            draft.salary = value;
            return true;
        case 'url':
            draft.url = value;
            return true;
        case 'posted at':
            draft.postedAt = value;
            return true;
        case 'deadline':
            draft.deadline = value;
            return true;
        case 'collected at':
            draft.collectedAt = value;
            return true;
        default:
            return false;
    }
};
export const readLocalMarkdownFile = async (source, filePath) => {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const jobs = [];
    const errors = [];
    let draft;
    let inRequirements = false;
    let inDescription = false;
    const flushDraft = () => {
        if (!draft) {
            return;
        }
        const jobInput = finalizeDraft(draft, source, jobs.length + errors.length);
        if ('message' in jobInput) {
            errors.push(jobInput);
        }
        else {
            jobs.push(normalizeJob(jobInput));
        }
    };
    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.startsWith('## ')) {
            flushDraft();
            draft = createDraft();
            draft.title = line.slice(3).trim();
            inRequirements = false;
            inDescription = false;
            continue;
        }
        if (!draft) {
            continue;
        }
        if (line === '') {
            inRequirements = false;
            if (!inDescription) {
                continue;
            }
        }
        if (inRequirements) {
            const requirementMatch = line.match(/^\s*-\s+(.+?)\s*$/);
            const requirementValue = requirementMatch?.[1];
            if (requirementValue !== undefined) {
                draft.requirements.push(requirementValue);
                continue;
            }
            inRequirements = false;
        }
        if (inDescription) {
            if (line.startsWith('- ') || line.startsWith('## ')) {
                inDescription = false;
            }
            else if (line.trim() !== '') {
                draft.descriptionLines.push(line.trim());
                continue;
            }
        }
        const fieldMatch = line.match(/^- ([^:]+):\s*(.*)$/);
        if (!fieldMatch) {
            continue;
        }
        const fieldName = fieldMatch[1]?.trim().toLowerCase();
        const fieldValue = fieldMatch[2];
        if (fieldName === undefined || fieldValue === undefined) {
            continue;
        }
        if (fieldName === 'requirements') {
            inRequirements = true;
            inDescription = false;
            continue;
        }
        if (fieldName === 'description') {
            inDescription = true;
            inRequirements = false;
            if (fieldValue.trim() !== '') {
                draft.descriptionLines.push(fieldValue.trim());
            }
            continue;
        }
        inRequirements = false;
        inDescription = false;
        assignScalarField(draft, fieldName, fieldValue);
    }
    flushDraft();
    return {
        jobs,
        errors,
    };
};
//# sourceMappingURL=local-markdown-adapter.js.map