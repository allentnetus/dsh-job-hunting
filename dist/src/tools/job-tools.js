import { readLocalJsonFile } from '../jobs/local-json-adapter.js';
import { collectLocalJobs, readLocalCollectionMeta } from '../jobs/job-collector.js';
import { readLocalMarkdownFile } from '../jobs/local-markdown-adapter.js';
import { dedupeJobs } from '../domain/job-ledger.js';
import { createProfileDraftState, confirmProfileState } from '../profile/profile-state-machine.js';
import { updateProfile } from '../profile/career-profile.js';
import { readCareerProfile, writeCareerProfile } from '../profile/profile-storage.js';
import { createInterestTools, createWorkspaceInterestLedgerStore } from '../interest/interest-tools.js';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readWorkspaceJson, resolveOutputRoot, writeWorkspaceJson } from '../workspace/workspace-output.js';
const jsonOutput = {
    schema: { type: 'json' },
    render: (_args, value) => [
        { type: 'text', text: JSON.stringify(value) ?? 'null' },
    ],
};
const asJson = (value) => JSON.parse(JSON.stringify(value));
const readJobs = async (workspace) => (await readWorkspaceJson(workspace.path, 'data/jobs.json')) ?? [];
export const createJobTools = (resolveWorkspace) => [
    defineTool({
        name: 'job_hunting_profile_update',
        description: 'Create or update a local job profile draft from the stored assessed resume; confirm explicitly to publish it.',
        parameters: {
            feedback: { type: 'json', required: true, description: 'Profile feedback fields such as targetRoles, locations, keywords, and notes.' },
            confirmed: { type: 'boolean', description: 'Publish the generated profile only when explicitly true.' },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const document = await readWorkspaceJson(workspace.path, 'data/resume-document.json');
            if (!document)
                throw new Error('RESUME_NOT_FOUND: parse and assess a resume before profile update');
            const currentProfile = await readCareerProfile(workspace.path);
            const feedback = args.feedback;
            const draftResult = currentProfile
                ? { ok: true, value: updateProfile(currentProfile, feedback) }
                : createProfileDraftState(document, feedback);
            if (!draftResult.ok)
                throw new Error(`${draftResult.error.code}: cannot transition from ${draftResult.error.from} to ${draftResult.error.to}`);
            const draft = draftResult.value;
            await writeWorkspaceJson(workspace.path, 'profile/draft.json', draft);
            if (args.confirmed !== true)
                return asJson(draft);
            const confirmed = confirmProfileState(draft);
            if (!confirmed.ok)
                throw new Error(`${confirmed.error.code}: cannot transition from ${confirmed.error.from} to ${confirmed.error.to}`);
            await writeCareerProfile(workspace.path, confirmed.value);
            return asJson(confirmed.value);
        },
    }),
    defineTool({
        name: 'job_hunting_import_jobs',
        description: 'Import and deduplicate one local JSON or Markdown JD file inside the active Workspace.',
        parameters: {
            path: { type: 'string', required: true, description: 'Workspace-relative JSON or Markdown JD file.' },
            format: { type: 'string', enum: ['json', 'markdown'], required: true },
            source: { type: 'string', description: 'Stable source label for imported jobs.' },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const filePath = resolveOutputRoot(workspace, args.path);
            const source = args.source ?? args.path;
            const result = args.format === 'json'
                ? await readLocalJsonFile(source, filePath)
                : await readLocalMarkdownFile(source, filePath);
            const existing = await readJobs(workspace);
            const jobs = dedupeJobs(existing, result.jobs);
            await writeWorkspaceJson(workspace.path, 'data/jobs.json', jobs);
            return asJson({ added: jobs.length - existing.length, total: jobs.length, errors: result.errors });
        },
    }),
    defineTool({
        name: 'job_hunting_collect_jobs',
        description: 'Collect local JSON or Markdown JD files through the existing local collector and persist its status metadata.',
        parameters: {
            path: { type: 'string', required: true, description: 'Workspace-relative JSON or Markdown JD file.' },
            format: { type: 'string', enum: ['json', 'markdown'], required: true },
            source: { type: 'string', description: 'Stable source label for the collection.' },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const filePath = resolveOutputRoot(workspace, args.path);
            const existing = await readJobs(workspace);
            const jobs = await collectLocalJobs({
                existingJobs: existing,
                sources: [{ source: args.source ?? args.path, format: args.format, filePaths: [filePath] }],
            });
            await writeWorkspaceJson(workspace.path, 'data/jobs.json', jobs);
            return asJson({ total: jobs.length, meta: readLocalCollectionMeta(jobs) });
        },
    }),
    defineTool({
        name: 'job_hunting_mark_interest',
        description: 'Persist one interest mark in the active Workspace interest ledger after explicit confirmation.',
        parameters: {
            jobId: { type: 'string', required: true },
            mark: { type: 'string', enum: ['none', 'favorite', 'interested', 'excluded'], required: true },
            note: { type: 'string' },
            confirmed: { type: 'boolean', const: true, required: true },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const tools = createInterestTools({ store: createWorkspaceInterestLedgerStore(workspace) });
            await tools.markInterest({
                jobId: args.jobId,
                mark: args.mark,
                ...(args.note === undefined ? {} : { note: args.note }),
                confirmed: args.confirmed,
            });
            return asJson({ jobId: args.jobId, mark: args.mark, confirmed: true });
        },
    }),
    defineTool({
        name: 'job_hunting_sync_interest',
        description: 'Synchronize a browser-exported interest pool into the active Workspace after explicit confirmation.',
        parameters: {
            export: { type: 'json', required: true },
            confirmed: { type: 'boolean', const: true, required: true },
        },
        output: jsonOutput,
        async execute(args, exec) {
            const workspace = await resolveWorkspace(exec);
            const tools = createInterestTools({ store: createWorkspaceInterestLedgerStore(workspace) });
            return asJson(await tools.syncInterest({ exported: args.export, confirmed: args.confirmed }));
        },
    }),
];
//# sourceMappingURL=job-tools.js.map