import { dedupeJobs, normalizeJob } from '../domain/job-ledger.js';
import type { JobInput, JobRecord } from '../domain/types.js';
import {
  validateBrowserPolicy,
  type BrowserCollectionRequest,
} from './browser-policy.js';
import {
  checkBrowserSkill,
  type BrowserSkillStatus,
} from './browser-skill-runner.js';
import type { BskCommandResult, BskRunner } from './browser-skill-runner.js';

export { checkBrowserSkill } from './browser-skill-runner.js';
export type { BrowserSkillStatus } from './browser-skill-runner.js';

export interface VisibleJobPayload extends Partial<Omit<JobInput, 'source' | 'collectedAt'>> {
  title: string;
  company: string;
  location: string;
  url: string;
  source?: string;
  collectedAt?: string;
}

interface BrowserSnapshotPayload {
  visibleJobs?: unknown;
  jobs?: unknown;
  assistanceRequired?: unknown;
  humanAssistance?: unknown;
  requiresHuman?: unknown;
}

export type HumanAssistanceReason = 'login' | 'captcha' | 'otp' | 'payment' | 'submit-confirmation';

export class BrowserHumanAssistanceRequiredError extends Error {
  readonly code = 'HUMAN_ASSISTANCE_REQUIRED';

  constructor(readonly reason: HumanAssistanceReason, detail?: string) {
    super(`Human assistance required for BrowserSkill collection: ${detail ?? reason}`);
    this.name = 'BrowserHumanAssistanceRequiredError';
  }
}

export class BrowserSkillUnavailableError extends Error {
  readonly code = 'BROWSERSKILL_UNAVAILABLE';

  constructor(status: BrowserSkillStatus) {
    super(status.message ?? `BrowserSkill is unavailable: ${status.executable}`);
    this.name = 'BrowserSkillUnavailableError';
  }
}

const getCommandError = (result: BskCommandResult, command: readonly string[]): Error | undefined => {
  if (result.exitCode === 0) {
    return undefined;
  }

  const detail = result.stderr?.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
  return new Error(`BrowserSkill command failed (${command.join(' ')}): ${detail}`);
};

const runChecked = async (
  runner: BskRunner,
  command: readonly string[],
): Promise<BskCommandResult> => {
  const result = await runner.run(command);
  const error = getCommandError(result, command);
  if (error !== undefined) {
    throw error;
  }

  return result;
};

const parseJson = (stdout: string, context: string): unknown => {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(`BrowserSkill returned an invalid ${context} payload`);
  }
};

const SESSION_ID_PATTERN = /^[A-Za-z0-9]{4}$/;
const CONTEXTUAL_SESSION_ID_PATTERN =
  /\b(?:session(?:\s+id|Id|_id)?|id)\s*[:=]\s*([A-Za-z0-9]{4})\b/i;

const readSessionId = (stdout: string): string => {
  const trimmed = stdout.trim();
  if (trimmed === '') {
    throw new Error('BrowserSkill did not return a session id');
  }

  let parsed: unknown;
  let isJson = false;
  try {
    parsed = JSON.parse(trimmed) as unknown;
    isJson = true;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const sessionPayload = parsed as { sessionId?: unknown; session_id?: unknown };
      const sessionId = sessionPayload.sessionId ?? sessionPayload.session_id;
      if (typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId.trim())) {
        return sessionId.trim();
      }
    }
  } catch {
    // BrowserSkill may print the short id as plain text or labeled output.
  }

  if (isJson) {
    throw new Error('BrowserSkill did not return a usable session id');
  }

  if (SESSION_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const contextualSessionId = CONTEXTUAL_SESSION_ID_PATTERN.exec(trimmed)?.[1];
  if (contextualSessionId !== undefined) {
    return contextualSessionId;
  }

  throw new Error('BrowserSkill did not return a usable session id');
};

const readAssistanceReason = (value: unknown): HumanAssistanceReason | undefined => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const normalized = text.toLowerCase();

  if (normalized.includes('captcha')) return 'captcha';
  if (normalized.includes('otp') || normalized.includes('one-time')) return 'otp';
  if (normalized.includes('payment')) return 'payment';
  if (normalized.includes('submit-confirmation') || normalized.includes('submission confirmation')) {
    return 'submit-confirmation';
  }
  if (
    normalized.includes('login') ||
    normalized.includes('sign in') ||
    normalized.includes('signin') ||
    normalized.includes('auth')
  ) {
    return 'login';
  }

  return undefined;
};

const readSnapshot = (stdout: string): BrowserSnapshotPayload => {
  const payload = parseJson(stdout, 'visible job');
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('BrowserSkill visible job payload must be an object');
  }

  return payload as BrowserSnapshotPayload;
};

const readVisibleJobs = (
  payload: BrowserSnapshotPayload,
  request: BrowserCollectionRequest,
): JobRecord[] => {
  const assistanceValue =
    payload.assistanceRequired ?? payload.humanAssistance ?? payload.requiresHuman;
  const assistanceReason = readAssistanceReason(assistanceValue);
  if (assistanceReason !== undefined) {
    throw new BrowserHumanAssistanceRequiredError(assistanceReason);
  }

  const visibleJobs = payload.visibleJobs ?? payload.jobs;
  if (!Array.isArray(visibleJobs)) {
    throw new Error('BrowserSkill payload must contain a visibleJobs array');
  }

  const collectedAt = request.collectedAt ?? new Date().toISOString();
  const jobs: JobRecord[] = [];

  for (const value of visibleJobs) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      continue;
    }

    const raw = value as Partial<VisibleJobPayload>;
    if (
      typeof raw.title !== 'string' ||
      typeof raw.company !== 'string' ||
      typeof raw.location !== 'string' ||
      typeof raw.url !== 'string'
    ) {
      continue;
    }

    jobs.push(
      normalizeJob({
        ...(raw as JobInput),
        source: request.source ?? 'browser-skill',
        collectedAt: typeof raw.collectedAt === 'string' ? raw.collectedAt : collectedAt,
        requirements: Array.isArray(raw.requirements) ? raw.requirements : [],
      }),
    );
  }

  return jobs;
};

export const collectWithBrowserSkill = async (
  request: BrowserCollectionRequest,
  runner: BskRunner,
): Promise<JobRecord[]> => {
  if (request.config.enabled !== true) {
    throw new Error('BrowserSkill collection is disabled');
  }

  validateBrowserPolicy(request, request.config);

  const status = await checkBrowserSkill(request.executable ?? 'bsk', runner);
  if (!status.available) {
    throw new BrowserSkillUnavailableError(status);
  }

  const started = await runChecked(runner, ['session', 'start', '--no-focus']);
  let sessionId: string | undefined;
  let collectionFailed = false;
  let collectionError: unknown;
  let cleanupError: Error | undefined;
  let jobs: JobRecord[] | undefined;

  try {
    sessionId = readSessionId(started.stdout);
    const incomingJobs: JobRecord[] = [];
    let lastNavigationAt: number | undefined;

    for (const url of request.urls) {
      if (lastNavigationAt !== undefined) {
        const elapsedMs = Date.now() - lastNavigationAt;
        const remainingMs = request.config.minIntervalMs - elapsedMs;
        if (remainingMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
        }
      }

      await runChecked(runner, ['navigate', url, '--session', sessionId]);
      lastNavigationAt = Date.now();
      const snapshot = await runChecked(runner, ['snapshot', '--session', sessionId]);
      incomingJobs.push(...readVisibleJobs(readSnapshot(snapshot.stdout), request));
    }

    jobs = dedupeJobs([], incomingJobs).slice(0, request.config.maxItemsPerRun);
  } catch (error) {
    collectionFailed = true;
    collectionError = error;
    if (sessionId === undefined) {
      // BrowserSkill started successfully but did not expose a targetable id.
      // Use the documented emergency cleanup only in this exceptional path.
      try {
        await runner.run(['session', 'stop', '--all']);
      } catch {
        // Preserve the original parse/collection error while still attempting cleanup.
      }
    }
  } finally {
    if (sessionId !== undefined) {
      const stopCommand = ['session', 'stop', sessionId] as const;
      try {
        const stopResult = await runner.run(stopCommand);
        const stopError = getCommandError(stopResult, stopCommand);
        if (!collectionFailed && stopError !== undefined) {
          cleanupError = new Error(
            `BrowserSkill session cleanup failed: ${stopError.message}`,
            { cause: stopError },
          );
        }
      } catch (error) {
        if (!collectionFailed) {
          const detail = error instanceof Error ? error.message : String(error);
          cleanupError = new Error(`BrowserSkill session cleanup failed: ${detail}`, {
            cause: error,
          });
        }
      }
    }
  }

  if (collectionFailed) {
    throw collectionError;
  }
  if (cleanupError !== undefined) {
    throw cleanupError;
  }

  return jobs!;
};
