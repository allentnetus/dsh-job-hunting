import { DEFAULT_BROWSER_ALLOWED_DOMAINS } from '../config/default-config.js';

export type BrowserSkillMode = 'read-only' | 'write';

export interface BrowserSkillConfig {
  enabled: boolean;
  mode: BrowserSkillMode;
  allowedDomains: readonly string[];
  requireUserApproval: boolean;
  maxItemsPerRun: number;
  minIntervalMs: number;
}

export interface BrowserCollectionRequest {
  urls: readonly string[];
  config: BrowserSkillConfig;
  userApproved?: boolean;
  approved?: boolean;
  approvalGranted?: boolean;
  executable?: string;
  source?: string;
  collectedAt?: string;
  actions?: readonly string[];
  credentialExtraction?: boolean;
  credentialExtractionExpression?: string;
  extractExpression?: string;
  submit?: boolean;
  formAction?: boolean;
}

export const DEFAULT_BROWSER_SKILL_CONFIG: BrowserSkillConfig = {
  enabled: true,
  mode: 'read-only',
  allowedDomains: DEFAULT_BROWSER_ALLOWED_DOMAINS,
  requireUserApproval: true,
  maxItemsPerRun: 50,
  minIntervalMs: 1000,
};

const isApprovalGranted = (request: BrowserCollectionRequest): boolean =>
  request.userApproved === true || request.approved === true || request.approvalGranted === true;

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase();

const isHostname = (value: string): boolean =>
  value !== '' &&
  !value.includes('://') &&
  !value.includes('/') &&
  !value.includes(':') &&
  !value.includes('*') &&
  !/\s/.test(value);

const assertAllowedDomain = (domain: string, index: number): string => {
  const normalized = normalizeHostname(domain);

  if (!isHostname(normalized)) {
    throw new TypeError(`allowedDomains[${index}] must be a non-empty hostname`);
  }

  return normalized;
};

const assertUrlAllowed = (value: string, allowedDomains: readonly string[]): void => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`URL is invalid or outside the allowed domains: ${value}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new TypeError(`URL protocol is not allowed: ${value}`);
  }

  const hostname = normalizeHostname(url.hostname);
  if (!allowedDomains.some((domain) => hostname === domain)) {
    throw new TypeError(`URL is outside the allowed domains: ${value}`);
  }
};

const assertNoUnsafeRequestAction = (request: BrowserCollectionRequest): void => {
  if (
    request.credentialExtraction === true ||
    request.credentialExtractionExpression?.trim() !== undefined &&
      request.credentialExtractionExpression.trim() !== '' ||
    request.extractExpression?.trim() !== undefined &&
      request.extractExpression.trim() !== '' ||
    request.submit === true ||
    request.formAction === true
  ) {
    throw new TypeError('credential extraction, form actions, and submit actions are not allowed');
  }

  const unsafeAction = request.actions?.find((action) =>
    /credential|evaluate|form|submit|write|fill|click|payment|auth|captcha|otp|login/i.test(action),
  );
  if (unsafeAction !== undefined) {
    throw new TypeError(`browser action is not allowed: ${unsafeAction}`);
  }
};

export const validateBrowserPolicy = (
  request: BrowserCollectionRequest,
  config: BrowserSkillConfig,
): void => {
  if (config.mode !== 'read-only') {
    throw new TypeError('browserSkill.mode must be "read-only"');
  }

  if (
    typeof config.maxItemsPerRun !== 'number' ||
    !Number.isInteger(config.maxItemsPerRun) ||
    config.maxItemsPerRun <= 0
  ) {
    throw new TypeError('browserSkill.maxItemsPerRun must be a positive integer');
  }

  if (
    typeof config.minIntervalMs !== 'number' ||
    !Number.isInteger(config.minIntervalMs) ||
    config.minIntervalMs <= 0
  ) {
    throw new TypeError('browserSkill.minIntervalMs must be a positive integer');
  }

  if (!Array.isArray(config.allowedDomains) || config.allowedDomains.length === 0) {
    throw new TypeError('browserSkill.allowedDomains must contain at least one hostname');
  }

  const allowedDomains = config.allowedDomains.map(assertAllowedDomain);

  if (config.requireUserApproval !== true || !isApprovalGranted(request)) {
    throw new Error('explicit user approval is required for BrowserSkill collection');
  }

  if (!Array.isArray(request.urls) || request.urls.length === 0) {
    throw new TypeError('BrowserSkill collection requires at least one URL');
  }

  for (const url of request.urls) {
    assertUrlAllowed(url, allowedDomains);
  }

  assertNoUnsafeRequestAction(request);
};
