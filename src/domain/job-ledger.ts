import type { JobInput, JobRecord } from './types.js';

const normalizeWhitespace = (value: string | undefined): string =>
  value?.replace(/\s+/g, ' ').trim() ?? '';

const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const normalized = normalizeWhitespace(value);

  return normalized === '' ? undefined : normalized;
};

const normalizeStringList = (values: readonly string[] | undefined): string[] => {
  if (values === undefined) {
    return [];
  }

  const normalizedValues: string[] = [];
  const seen = new Set<string>();

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

const normalizeLookupKey = (value: string): string => normalizeWhitespace(value).toLowerCase();

const normalizeUrl = (value: string | undefined): string => {
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
  } catch {
    return normalized;
  }
};

const buildFallbackIdentity = (job: Pick<JobRecord, 'company' | 'title' | 'location'>): string =>
  [
    normalizeLookupKey(job.company),
    normalizeLookupKey(job.title),
    normalizeLookupKey(job.location),
  ].join('|');

const buildIdentityKey = (job: Pick<JobRecord, 'url' | 'company' | 'title' | 'location'>): string => {
  const normalizedUrl = normalizeUrl(job.url);

  if (normalizedUrl !== '') {
    return `url:${normalizedUrl}`;
  }

  return `fallback:${buildFallbackIdentity(job)}`;
};

const hashString = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const toOptionalList = (values: readonly string[] | undefined): string[] | undefined =>
  values === undefined ? undefined : normalizeStringList(values);

export const normalizeJob = (input: JobInput): JobRecord => {
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
      : { salary: normalizeOptionalText(input.salary)! }),
    ...(normalizeOptionalText(input.description) === undefined
      ? {}
      : { description: normalizeOptionalText(input.description)! }),
    ...(normalizeOptionalText(input.postedAt) === undefined
      ? {}
      : { postedAt: normalizeOptionalText(input.postedAt)! }),
    ...(normalizeOptionalText(input.deadline) === undefined
      ? {}
      : { deadline: normalizeOptionalText(input.deadline)! }),
    ...(input.matchScore === undefined ? {} : { matchScore: input.matchScore }),
    ...(matchReasons === undefined ? {} : { matchReasons }),
  };
};

export const dedupeJobs = (
  existing: readonly JobRecord[],
  incoming: readonly JobRecord[],
): JobRecord[] => {
  const deduped: JobRecord[] = [];
  const seenKeys = new Set<string>();

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
