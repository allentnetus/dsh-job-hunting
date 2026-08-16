import {
  UNKNOWN_VALUE,
  type AssessmentConfidence,
  type AssessmentTarget,
  type EvidenceReference,
  type ResumeAssessment,
  type ResumeAssessmentFacts,
  type ResumeAssessmentSuggestion,
  unknownEvidence,
} from '../domain/llm-contracts.js';
import { getResumeDocumentState, type ResumeDocument } from './resume-document.js';
import { ProfileStateTransitionError, ensureTransition } from '../profile/profile-state-machine.js';

type ParsedLine = {
  text: string;
  section: string;
};

type CorrectableFactField =
  | 'currentRole'
  | 'recentCompany'
  | 'preferredLocation'
  | 'education'
  | 'skills';

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const headingMatchers: Array<{ label: string; pattern: RegExp }> = [
  { label: 'summary', pattern: /^(summary|profile|about)$/i },
  { label: 'experience', pattern: /^(experience|work experience|employment|professional experience)$/i },
  { label: 'skills', pattern: /^(skills|technical skills|core skills)$/i },
  { label: 'education', pattern: /^(education|academic background)$/i },
];

const getSectionLabel = (line: string): string | undefined =>
  headingMatchers.find(({ pattern }) => pattern.test(line.trim()))?.label;

const parseLines = (text: string): ParsedLine[] => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const parsed: ParsedLine[] = [];
  let currentSection = 'header';

  for (const line of lines) {
    const detectedSection = getSectionLabel(line);
    if (detectedSection) {
      currentSection = detectedSection;
      continue;
    }

    parsed.push({
      text: line,
      section: currentSection,
    });
  }

  return parsed;
};

const firstLine = (lines: ParsedLine[], section: string): string | undefined =>
  lines.find((line) => line.section === section)?.text;

const secondHeaderLine = (lines: ParsedLine[]): string | undefined => {
  const headerLines = lines.filter((line) => line.section === 'header');
  return headerLines[1]?.text;
};

const parseSkills = (line: string | undefined): string[] | typeof UNKNOWN_VALUE => {
  if (!line) {
    return UNKNOWN_VALUE;
  }

  const skills = line
    .split(/[,/|·•]/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

  return skills.length > 0 ? [...new Set(skills)] : UNKNOWN_VALUE;
};

const detectLocation = (lines: ParsedLine[]): string | typeof UNKNOWN_VALUE => {
  const locationLine = lines.find((line) => /^location:/i.test(line.text));
  if (!locationLine) {
    return UNKNOWN_VALUE;
  }

  const value = locationLine.text.replace(/^location:/i, '').trim();
  return value === '' ? UNKNOWN_VALUE : value;
};

const buildEvidence = (
  section: string,
  fact: string,
  quote: string | undefined,
): EvidenceReference =>
  quote
    ? {
        section,
        fact,
        quote,
      }
    : unknownEvidence(fact);

const buildSuggestion = (
  category: ResumeAssessmentSuggestion['category'],
  message: string,
  confidence: AssessmentConfidence,
  evidence: EvidenceReference,
): ResumeAssessmentSuggestion => ({
  category,
  message,
  confidence,
  evidence,
});

const mapCorrectionField = (field: string): CorrectableFactField | undefined => {
  switch (field.trim().toLowerCase()) {
    case 'company':
    case 'recentcompany':
      return 'recentCompany';
    case 'currentrole':
    case 'role':
      return 'currentRole';
    case 'preferredlocation':
    case 'location':
      return 'preferredLocation';
    case 'education':
      return 'education';
    case 'skills':
      return 'skills';
    default:
      return undefined;
  }
};

const applyUserCorrections = (
  document: ResumeDocument,
  facts: ResumeAssessmentFacts,
): ResumeAssessmentFacts => {
  const corrections = document.confirmation?.corrections ?? [];
  const correctedFacts: ResumeAssessmentFacts = {
    ...facts,
    skills: Array.isArray(facts.skills) ? [...facts.skills] : facts.skills,
  };

  for (const correction of corrections) {
    const factField = mapCorrectionField(correction.field);
    const correctedValue = correction.correctedValue.trim();

    if (!factField || correctedValue === '') {
      continue;
    }

    switch (factField) {
      case 'currentRole':
        correctedFacts.currentRole = correctedValue;
        break;
      case 'recentCompany':
        correctedFacts.recentCompany = correctedValue;
        break;
      case 'preferredLocation':
        correctedFacts.preferredLocation = correctedValue;
        break;
      case 'education':
        correctedFacts.education = correctedValue;
        break;
      case 'skills':
        correctedFacts.skills = parseSkills(correctedValue);
        break;
    }
  }

  return correctedFacts;
};

const extractFacts = (document: ResumeDocument): ResumeAssessmentFacts => {
  const lines = parseLines(document.normalizedText);
  const headerLines = lines.filter((line) => line.section === 'header');
  const skillsLine = firstLine(lines, 'skills');

  const extractedFacts: ResumeAssessmentFacts = {
    candidateName: headerLines[0]?.text ?? UNKNOWN_VALUE,
    currentRole: secondHeaderLine(lines) ?? UNKNOWN_VALUE,
    recentCompany: firstLine(lines, 'experience') ?? UNKNOWN_VALUE,
    preferredLocation: detectLocation(lines),
    education: firstLine(lines, 'education') ?? UNKNOWN_VALUE,
    skills: parseSkills(skillsLine),
  };

  return applyUserCorrections(document, extractedFacts);
};

const buildSummary = (facts: ResumeAssessmentFacts): string => {
  const role = facts.currentRole;
  const company = facts.recentCompany;
  const skills =
    facts.skills === UNKNOWN_VALUE || facts.skills.length === 0
      ? UNKNOWN_VALUE
      : facts.skills.join(', ');

  return `Baseline assessment captured role=${role}, recentCompany=${company}, skills=${skills}.`;
};

const maybeTargetingSuggestion = (
  target: AssessmentTarget | undefined,
  facts: ResumeAssessmentFacts,
): ResumeAssessmentSuggestion[] => {
  if (!target) {
    return [];
  }

  const suggestions: ResumeAssessmentSuggestion[] = [];

  if (target.role) {
    const roleMatches =
      typeof facts.currentRole === 'string' &&
      facts.currentRole !== UNKNOWN_VALUE &&
      (normalizeText(facts.currentRole).includes(normalizeText(target.role)) ||
        normalizeText(target.role).includes(normalizeText(facts.currentRole)));

    suggestions.push(
      buildSuggestion(
        'targeting',
        roleMatches
          ? `The resume headline already signals the target role "${target.role}".`
          : `The resume does not yet clearly mirror the target role "${target.role}".`,
        roleMatches ? 'high' : 'low',
        buildEvidence(
          facts.currentRole === UNKNOWN_VALUE ? UNKNOWN_VALUE : 'header',
          'currentRole',
          facts.currentRole === UNKNOWN_VALUE ? undefined : facts.currentRole,
        ),
      ),
    );
  }

  if (target.location) {
    const locationMatches =
      typeof facts.preferredLocation === 'string' &&
      facts.preferredLocation !== UNKNOWN_VALUE &&
      normalizeText(facts.preferredLocation) === normalizeText(target.location);

    suggestions.push(
      buildSuggestion(
        'gap',
        locationMatches
          ? `The resume confirms the preferred location "${target.location}".`
          : `Preferred location remains unknown or unconfirmed for "${target.location}".`,
        locationMatches ? 'medium' : 'unknown',
        buildEvidence(
          facts.preferredLocation === UNKNOWN_VALUE ? UNKNOWN_VALUE : 'header',
          'preferredLocation',
          facts.preferredLocation === UNKNOWN_VALUE ? undefined : facts.preferredLocation,
        ),
      ),
    );
  }

  return suggestions;
};

const buildCoreSuggestions = (facts: ResumeAssessmentFacts): ResumeAssessmentSuggestion[] => {
  const suggestions: ResumeAssessmentSuggestion[] = [];

  suggestions.push(
    buildSuggestion(
      'experience',
      facts.recentCompany === UNKNOWN_VALUE
        ? 'Recent company is unknown; keep it as unknown until the user confirms it.'
        : `Recent experience is grounded in the confirmed employer "${facts.recentCompany}".`,
      facts.recentCompany === UNKNOWN_VALUE ? 'unknown' : 'medium',
      buildEvidence(
        facts.recentCompany === UNKNOWN_VALUE ? UNKNOWN_VALUE : 'experience',
        'recentCompany',
        facts.recentCompany === UNKNOWN_VALUE ? undefined : facts.recentCompany,
      ),
    ),
  );

  suggestions.push(
    buildSuggestion(
      'skills',
      facts.skills === UNKNOWN_VALUE
        ? 'Skills are unknown; do not infer missing tools or platforms.'
        : `Highlight the confirmed skills: ${facts.skills.join(', ')}.`,
      facts.skills === UNKNOWN_VALUE ? 'unknown' : 'high',
      buildEvidence(
        facts.skills === UNKNOWN_VALUE ? UNKNOWN_VALUE : 'skills',
        'skills',
        facts.skills === UNKNOWN_VALUE ? undefined : facts.skills.join(', '),
      ),
    ),
  );

  suggestions.push(
    buildSuggestion(
      'education',
      facts.education === UNKNOWN_VALUE
        ? 'Education is unknown; keep degree details as unknown until confirmed.'
        : `Education can be referenced directly from the resume: "${facts.education}".`,
      facts.education === UNKNOWN_VALUE ? 'unknown' : 'medium',
      buildEvidence(
        facts.education === UNKNOWN_VALUE ? UNKNOWN_VALUE : 'education',
        'education',
        facts.education === UNKNOWN_VALUE ? undefined : facts.education,
      ),
    ),
  );

  return suggestions;
};

export const assessResume = async (
  document: ResumeDocument,
  target?: AssessmentTarget,
): Promise<ResumeAssessment> => {
  const currentState = getResumeDocumentState(document);
  const error = ensureTransition(currentState, 'assessed');
  if (error) {
    throw new ProfileStateTransitionError(error);
  }

  const facts = extractFacts(document);

  return {
    schemaVersion: 'resume-assessment/v1',
    assessor: 'baseline-deterministic',
    generatedAt: new Date().toISOString(),
    summary: buildSummary(facts),
    target: target ? { ...target } : UNKNOWN_VALUE,
    extractedFacts: facts,
    suggestions: [...buildCoreSuggestions(facts), ...maybeTargetingSuggestion(target, facts)],
  };
};
