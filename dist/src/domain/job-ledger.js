const normalizeWhitespace = (value) => value?.replace(/\s+/g, ' ').trim() ?? '';
const normalizeOptionalText = (value) => {
    const normalized = normalizeWhitespace(value);
    return normalized === '' ? undefined : normalized;
};
const normalizeStringList = (values) => {
    if (values === undefined) {
        return [];
    }
    const normalizedValues = [];
    const seen = new Set();
    for (const value of values) {
        const normalized = normalizeWhitespace(value);
        if (normalized === '' || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        normalizedValues.push(normalized);
    }
    return normalizedValues;
};
const normalizeLookupKey = (value) => normalizeWhitespace(value).toLowerCase();
const normalizeUrl = (value) => {
    const normalized = normalizeWhitespace(value);
    if (normalized === '') {
        return '';
    }
    try {
        const url = new URL(normalized);
        url.hash = '';
        if (url.pathname.length > 1) {
            url.pathname = url.pathname.replace(/\/+$/, '');
        }
        url.searchParams.sort();
        return url.toString();
    }
    catch {
        return normalized;
    }
};
const buildFallbackIdentity = (job) => [
    normalizeLookupKey(job.company),
    normalizeLookupKey(job.title),
    normalizeLookupKey(job.location),
].join('|');
const buildIdentityKey = (job) => {
    const normalizedUrl = normalizeUrl(job.url);
    if (normalizedUrl !== '') {
        return `url:${normalizedUrl}`;
    }
    return `fallback:${buildFallbackIdentity(job)}`;
};
const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};
const toOptionalList = (values) => values === undefined ? undefined : normalizeStringList(values);
export const normalizeJob = (input) => {
    const title = normalizeWhitespace(input.title);
    const company = normalizeWhitespace(input.company);
    const location = normalizeWhitespace(input.location);
    const url = normalizeUrl(input.url);
    const requirements = normalizeStringList(input.requirements);
    const matchReasons = toOptionalList(input.matchReasons);
    const identityKey = buildIdentityKey({
        url,
        company,
        title,
        location,
    });
    return {
        id: `job-${hashString(identityKey)}`,
        source: normalizeWhitespace(input.source),
        title,
        company,
        location,
        requirements,
        url,
        collectedAt: normalizeWhitespace(input.collectedAt),
        ...(normalizeOptionalText(input.salary) === undefined
            ? {}
            : { salary: normalizeOptionalText(input.salary) }),
        ...(normalizeOptionalText(input.description) === undefined
            ? {}
            : { description: normalizeOptionalText(input.description) }),
        ...(normalizeOptionalText(input.postedAt) === undefined
            ? {}
            : { postedAt: normalizeOptionalText(input.postedAt) }),
        ...(normalizeOptionalText(input.deadline) === undefined
            ? {}
            : { deadline: normalizeOptionalText(input.deadline) }),
        ...(input.matchScore === undefined ? {} : { matchScore: input.matchScore }),
        ...(matchReasons === undefined ? {} : { matchReasons }),
    };
};
export const dedupeJobs = (existing, incoming) => {
    const deduped = [];
    const seenKeys = new Set();
    for (const job of existing) {
        const key = buildIdentityKey(job);
        if (seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);
        deduped.push(job);
    }
    for (const job of incoming) {
        const normalized = normalizeJob(job);
        const key = buildIdentityKey(normalized);
        if (seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);
        deduped.push(normalized);
    }
    return deduped;
};
//# sourceMappingURL=job-ledger.js.map