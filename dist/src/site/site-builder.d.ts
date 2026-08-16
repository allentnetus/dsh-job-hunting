import type { JobRecord } from '../domain/types.js';
export interface SiteData {
    generatedAt: string;
    jobs: readonly JobRecord[];
}
export interface SiteBuildInput {
    outputDir: string;
    jobs: readonly JobRecord[];
    generatedAt?: string;
}
export interface SiteBuildResult {
    indexPath: string;
    assetPaths: string[];
    data: SiteData;
}
export declare const embedSiteData: (template: string, data: SiteData) => string;
export declare const buildSite: (input: SiteBuildInput) => Promise<SiteBuildResult>;
