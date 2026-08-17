import type { CareerProfile, JobRecord, MatchResult } from './types.js';

const normalizeText = (value: string | undefined): string =>
  value?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';

const includesAny = (haystack: string, needles: readonly string[]): string[] =>
  needles.filter((needle) => {
    const normalizedNeedle = normalizeText(needle);

    return normalizedNeedle !== '' && haystack.includes(normalizedNeedle);
  });

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const clampScore = (score: number): number => Math.max(0, Math.min(100, score));

export const matchJob = (job: JobRecord, profile: CareerProfile): MatchResult => {
  const titleText = normalizeText(job.title);
  const companyText = normalizeText(job.company);
  const locationText = normalizeText(job.location);
  const detailText = normalizeText(
    [job.description ?? '', ...job.requirements].join(' '),
  );
  const combinedText = [titleText, companyText, locationText, detailText].join(' ');

  let score = 0;
  const reasons: string[] = [];

  const matchedRoles = includesAny([titleText, detailText].join(' '), profile.targetRoles);
  if (matchedRoles.length > 0) {
    score += 35;
    reasons.push(`目标角色命中: ${matchedRoles.join('、')}`);
  }

  const matchedCompanies = includesAny(companyText, profile.targetCompanies);
  if (matchedCompanies.length > 0) {
    score += 20;
    reasons.push(`目标公司命中: ${matchedCompanies.join('、')}`);
  }

  const matchedIndustries = includesAny([companyText, detailText].join(' '), profile.targetIndustries);
  if (matchedIndustries.length > 0) {
    score += 10;
    reasons.push(`目标行业命中: ${matchedIndustries.join('、')}`);
  }

  const preferredLocations = includesAny(locationText, profile.preferredLocations);
  if (preferredLocations.length > 0) {
    score += 15;
    reasons.push(`优先地点命中: ${preferredLocations.join('、')}`);
  }

  const excludedLocations = includesAny(locationText, profile.excludedLocations);
  if (excludedLocations.length > 0) {
    score -= 45;
    reasons.push(`排斥地点命中: ${excludedLocations.join('、')}`);
  }

  const matchedKeywords = unique(includesAny(combinedText, profile.keywords));
  if (matchedKeywords.length > 0) {
    score += Math.min(10 + matchedKeywords.length * 5, 20);
    reasons.push(`关键词命中: ${matchedKeywords.join('、')}`);
  }

  const avoidTerms = unique(includesAny(combinedText, profile.avoid));
  if (avoidTerms.length > 0) {
    score -= Math.min(20 + avoidTerms.length * 5, 30);
    reasons.push(`规避关键词命中: ${avoidTerms.join('、')}`);
  }

  return {
    score: clampScore(score),
    reasons,
  };
};
