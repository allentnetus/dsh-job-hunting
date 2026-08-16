import { dedupeJobs } from '../domain/job-ledger.js';
import { collectWithBrowserSkill } from '../browser/browser-skill-adapter.js';
import { createSafeBskRunner } from '../browser/browser-skill-runner.js';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readWorkspaceJson, writeWorkspaceJson } from '../workspace/workspace-output.js';
const jsonOutput = {
    schema: { type: 'json' },
    render: (_args, value) => [
        { type: 'text', text: JSON.stringify(value) ?? 'null' },
    ],
};
const asJson = (value) => JSON.parse(JSON.stringify(value));
const readJobs = async (workspace) => (await readWorkspaceJson(workspace.path, 'data/jobs.json')) ?? [];
export const createBrowserJobTool = (resolveWorkspace, config, runner = createSafeBskRunner(config.browserSkill.executable)) => defineTool({
    name: 'job_hunting_collect_browser_jobs',
    description: 'Collect visible job postings through the configured read-only Tencent/BrowserSkill session and persist them in the active Workspace after explicit confirmation.',
    parameters: {
        urls: {
            type: 'array',
            items: { type: 'string' },
            required: true,
            description: 'HTTP(S) URLs on configured allowlisted job sites.',
        },
        confirmed: {
            type: 'boolean',
            const: true,
            required: true,
            description: 'Explicitly confirm this read-only browser collection run.',
        },
        source: {
            type: 'string',
            description: 'Stable source label stored on collected jobs.',
        },
    },
    output: jsonOutput,
    async execute(args, exec) {
        const workspace = await resolveWorkspace(exec);
        const collected = await collectWithBrowserSkill({
            urls: args.urls,
            config: config.browserSkill,
            userApproved: args.confirmed,
            executable: config.browserSkill.executable,
            source: args.source ?? 'browser-skill',
        }, runner);
        const existing = await readJobs(workspace);
        const jobs = dedupeJobs(existing, collected);
        await writeWorkspaceJson(workspace.path, 'data/jobs.json', jobs);
        return asJson({
            source: 'browser-skill',
            collected: collected.length,
            added: jobs.length - existing.length,
            total: jobs.length,
        });
    },
});
//# sourceMappingURL=browser-job-tool.js.map