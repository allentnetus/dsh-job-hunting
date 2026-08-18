import type { JobRecord } from '../domain/types.js';
export interface SiteData {
    generatedAt: string;
    jobs: readonly JobRecord[];
    selection?: SiteSelection;
}
export interface IndustrySuggestion {
    requested: string;
    suggested: string;
    reason: string;
}
/** The confirmed choices from the preceding job-search conversation. */
export interface SiteSelection {
    cities?: readonly string[];
    industries?: readonly string[];
    industrySuggestions?: readonly IndustrySuggestion[];
    /** Omitted means shared; false is only used after explicit per-city feedback. */
    shareIndustriesAcrossCities?: boolean;
    industriesByCity?: Readonly<Record<string, readonly string[]>>;
}
export interface SiteBuildInput {
    outputDir: string;
    jobs: readonly JobRecord[];
    generatedAt?: string;
    selection?: SiteSelection;
}
export interface SiteBuildResult {
    indexPath: string;
    assetPaths: string[];
    data: SiteData;
}
export declare const suggestIndustryClassifications: (industries: readonly string[] | undefined) => IndustrySuggestion[];
export declare const embedSiteData: (template: string, data: SiteData) => string;
export declare const buildSite: (input: SiteBuildInput) => Promise<SiteBuildResult>;
