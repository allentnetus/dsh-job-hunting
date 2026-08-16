import { dedupeJobs, normalizeJob } from '../domain/job-ledger.js';
import { validateBrowserPolicy, } from './browser-policy.js';
import { checkBrowserSkill, } from './browser-skill-runner.js';
export { checkBrowserSkill } from './browser-skill-runner.js';
export class BrowserHumanAssistanceRequiredError extends Error {
    reason;
    code = 'HUMAN_ASSISTANCE_REQUIRED';
    constructor(reason, detail) {
        super(`Human assistance required for BrowserSkill collection: ${detail ?? reason}`);
        this.reason = reason;
        this.name = 'BrowserHumanAssistanceRequiredError';
    }
}
export class BrowserSkillUnavailableError extends Error {
    code = 'BROWSERSKILL_UNAVAILABLE';
    constructor(status) {
        super(status.message ?? `BrowserSkill is unavailable: ${status.executable}`);
        this.name = 'BrowserSkillUnavailableError';
    }
}
const getCommandError = (result, command) => {
    if (result.exitCode === 0) {
        return undefined;
    }
    const detail = result.stderr?.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
    return new Error(`BrowserSkill command failed (${command.join(' ')}): ${detail}`);
};
const runChecked = async (runner, command) => {
    const result = await runner.run(command);
    const error = getCommandError(result, command);
    if (error !== undefined) {
        throw error;
    }
    return result;
};
const parseJson = (stdout, context) => {
    try {
        return JSON.parse(stdout);
    }
    catch {
        throw new Error(`BrowserSkill returned an invalid ${context} payload`);
    }
};
const SESSION_ID_PATTERN = /^[A-Za-z0-9]{4}$/;
const CONTEXTUAL_SESSION_ID_PATTERN = /\b(?:session(?:\s+id|Id|_id)?|id)\s*[:=]\s*([A-Za-z0-9]{4})\b/i;
const readSessionId = (stdout) => {
    const trimmed = stdout.trim();
    if (trimmed === '') {
        throw new Error('BrowserSkill did not return a session id');
    }
    let parsed;
    let isJson = false;
    try {
        parsed = JSON.parse(trimmed);
        isJson = true;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const sessionPayload = parsed;
            const sessionId = sessionPayload.sessionId ?? sessionPayload.session_id;
            if (typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId.trim())) {
                return sessionId.trim();
            }
        }
    }
    catch {
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
const readAssistanceReason = (value) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    const normalized = text.toLowerCase();
    if (normalized.includes('captcha'))
        return 'captcha';
    if (normalized.includes('otp') || normalized.includes('one-time'))
        return 'otp';
    if (normalized.includes('payment'))
        return 'payment';
    if (normalized.includes('submit-confirmation') || normalized.includes('submission confirmation')) {
        return 'submit-confirmation';
    }
    if (normalized.includes('login') ||
        normalized.includes('sign in') ||
        normalized.includes('signin') ||
        normalized.includes('auth')) {
        return 'login';
    }
    return undefined;
};
const readSnapshot = (stdout) => {
    const payload = parseJson(stdout, 'visible job');
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('BrowserSkill visible job payload must be an object');
    }
    return payload;
};
const readVisibleJobs = (payload, request) => {
    const assistanceValue = payload.assistanceRequired ?? payload.humanAssistance ?? payload.requiresHuman;
    const assistanceReason = readAssistanceReason(assistanceValue);
    if (assistanceReason !== undefined) {
        throw new BrowserHumanAssistanceRequiredError(assistanceReason);
    }
    const visibleJobs = payload.visibleJobs ?? payload.jobs;
    if (!Array.isArray(visibleJobs)) {
        throw new Error('BrowserSkill payload must contain a visibleJobs array');
    }
    const collectedAt = request.collectedAt ?? new Date().toISOString();
    const jobs = [];
    for (const value of visibleJobs) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            continue;
        }
        const raw = value;
        if (typeof raw.title !== 'string' ||
            typeof raw.company !== 'string' ||
            typeof raw.location !== 'string' ||
            typeof raw.url !== 'string') {
            continue;
        }
        jobs.push(normalizeJob({
            ...raw,
            source: request.source ?? 'browser-skill',
            collectedAt: typeof raw.collectedAt === 'string' ? raw.collectedAt : collectedAt,
            requirements: Array.isArray(raw.requirements) ? raw.requirements : [],
        }));
    }
    return jobs;
};
export const collectWithBrowserSkill = async (request, runner) => {
    if (request.config.enabled !== true) {
        throw new Error('BrowserSkill collection is disabled');
    }
    validateBrowserPolicy(request, request.config);
    const status = await checkBrowserSkill(request.executable ?? 'bsk', runner);
    if (!status.available) {
        throw new BrowserSkillUnavailableError(status);
    }
    const started = await runChecked(runner, ['session', 'start', '--no-focus']);
    let sessionId;
    let collectionFailed = false;
    let collectionError;
    let cleanupError;
    let jobs;
    try {
        sessionId = readSessionId(started.stdout);
        const incomingJobs = [];
        let lastNavigationAt;
        for (const url of request.urls) {
            if (lastNavigationAt !== undefined) {
                const elapsedMs = Date.now() - lastNavigationAt;
                const remainingMs = request.config.minIntervalMs - elapsedMs;
                if (remainingMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remainingMs));
                }
            }
            await runChecked(runner, ['navigate', url, '--session', sessionId]);
            lastNavigationAt = Date.now();
            const snapshot = await runChecked(runner, ['snapshot', '--session', sessionId]);
            incomingJobs.push(...readVisibleJobs(readSnapshot(snapshot.stdout), request));
        }
        jobs = dedupeJobs([], incomingJobs).slice(0, request.config.maxItemsPerRun);
    }
    catch (error) {
        collectionFailed = true;
        collectionError = error;
        if (sessionId === undefined) {
            // BrowserSkill started successfully but did not expose a targetable id.
            // Use the documented emergency cleanup only in this exceptional path.
            try {
                await runner.run(['session', 'stop', '--all']);
            }
            catch {
                // Preserve the original parse/collection error while still attempting cleanup.
            }
        }
    }
    finally {
        if (sessionId !== undefined) {
            const stopCommand = ['session', 'stop', sessionId];
            try {
                const stopResult = await runner.run(stopCommand);
                const stopError = getCommandError(stopResult, stopCommand);
                if (!collectionFailed && stopError !== undefined) {
                    cleanupError = new Error(`BrowserSkill session cleanup failed: ${stopError.message}`, { cause: stopError });
                }
            }
            catch (error) {
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
    return jobs;
};
//# sourceMappingURL=browser-skill-adapter.js.map