import type { JobInput, JobRecord } from '../domain/types.js';
import { type BrowserCollectionRequest } from './browser-policy.js';
import { type BrowserSkillStatus } from './browser-skill-runner.js';
import type { BskRunner } from './browser-skill-runner.js';
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
export type HumanAssistanceReason = 'login' | 'captcha' | 'otp' | 'payment' | 'submit-confirmation';
export declare class BrowserHumanAssistanceRequiredError extends Error {
    readonly reason: HumanAssistanceReason;
    readonly code = "HUMAN_ASSISTANCE_REQUIRED";
    constructor(reason: HumanAssistanceReason, detail?: string);
}
export declare class BrowserSkillUnavailableError extends Error {
    readonly code = "BROWSERSKILL_UNAVAILABLE";
    constructor(status: BrowserSkillStatus);
}
export declare const collectWithBrowserSkill: (request: BrowserCollectionRequest, runner: BskRunner) => Promise<JobRecord[]>;
