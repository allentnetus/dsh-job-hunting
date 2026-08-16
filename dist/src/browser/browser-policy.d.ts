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
export declare const DEFAULT_BROWSER_SKILL_CONFIG: BrowserSkillConfig;
export declare const validateBrowserPolicy: (request: BrowserCollectionRequest, config: BrowserSkillConfig) => void;
