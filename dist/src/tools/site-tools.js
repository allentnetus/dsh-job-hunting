import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { buildDailyReport, writeReportBundle } from '../reports/daily-report.js';
import { buildSite } from '../site/site-builder.js';
import { readCareerProfile } from '../profile/profile-storage.js';
import { readWorkspaceJson, resolveOutputRoot } from '../workspace/workspace-output.js';
const jsonOutput = {
    schema: { type: 'json' },
    render: (_args, value) => [
        { type: 'text', text: JSON.stringify(value) ?? 'null' },
    ],
};
const asJson = (value) => JSON.parse(JSON.stringify(value));
const readJobs = async (workspace) => (await readWorkspaceJson(workspace.path, 'data/jobs.json')) ?? [];
export const createSiteTools = (resolveWorkspace, outputDir) => [
    defineTool({
        name: 'job_hunting_generate_report',
        description: 'Generate a dated JSON, Markdown, and HTML job report in the active Workspace.',
        parameters: {
            date: { type: 'string', description: 'UTC report date in YYYY-MM-DD format.' },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const profile = await readCareerProfile(workspace.path);
            if (!profile)
                throw new Error('PROFILE_NOT_CONFIRMED: confirm a profile before generating a report');
            const date = args.date ?? new Date().toISOString().slice(0, 10);
            const report = buildDailyReport(await readJobs(workspace), profile, date);
            await writeReportBundle(report, resolveOutputRoot(workspace, 'reports'));
            return asJson({ date: report.date, generatedAt: report.generatedAt, anomalies: report.anomalies });
        },
    }),
    defineTool({
        name: 'job_hunting_build_site',
        description: 'Build the self-contained static job site with Workspace job data embedded for file:// use.',
        parameters: {},
        output: jsonOutput,
        async execute(_args, exec) {
            const workspace = await resolveWorkspace(exec);
            const profile = await readCareerProfile(workspace.path);
            const result = await buildSite({
                outputDir: resolveOutputRoot(workspace, outputDir),
                jobs: await readJobs(workspace),
                ...(profile
                    ? {
                        selection: {
                            cities: profile.preferredLocations,
                            industries: profile.targetIndustries,
                            ...(profile.shareIndustriesAcrossCities !== undefined
                                ? { shareIndustriesAcrossCities: profile.shareIndustriesAcrossCities }
                                : {}),
                            ...(profile.industriesByCity ? { industriesByCity: profile.industriesByCity } : {}),
                        },
                    }
                    : {}),
            });
            return asJson({
                indexPath: result.indexPath,
                assetPaths: result.assetPaths,
                jobCount: result.data.jobs.length,
                selection: result.data.selection,
            });
        },
    }),
    defineTool({
        name: 'job_hunting_open_site',
        description: 'Validate and return the file:// URL of the active Workspace static site entry point.',
        parameters: {},
        output: jsonOutput,
        async execute(_args, exec) {
            const workspace = await resolveWorkspace(exec);
            const indexPath = resolveOutputRoot(workspace, `${outputDir}/index.html`);
            await access(indexPath);
            return asJson({ indexPath, url: pathToFileURL(indexPath).href });
        },
    }),
];
//# sourceMappingURL=site-tools.js.map