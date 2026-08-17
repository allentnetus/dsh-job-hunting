import { readLocalJsonFile } from '../jobs/local-json-adapter.js';
import { collectLocalJobs, readLocalCollectionMeta } from '../jobs/job-collector.js';
import { readLocalMarkdownFile } from '../jobs/local-markdown-adapter.js';
import { dedupeJobs } from '../domain/job-ledger.js';
import type { CareerProfile, CareerProfileDraft, JobRecord, ProfileFeedback } from '../domain/types.js';
import { createProfileDraftState, confirmProfileState } from '../profile/profile-state-machine.js';
import { updateProfile } from '../profile/career-profile.js';
import type { ResumeDocument } from '../resume/resume-document.js';
import { createInterestTools, createWorkspaceInterestLedgerStore } from '../interest/interest-tools.js';
import type { InterestExport } from '../site/interest-export.js';
import { defineTool, type JsonValue, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { readWorkspaceJson, resolveOutputRoot, writeWorkspaceJson, type WorkspaceContext } from '../workspace/workspace-output.js';

export type WorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: unknown): ContentBlock[] => [
    { type: 'text', text: JSON.stringify(value) ?? 'null' },
  ],
};

const asJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const readJobs = async (workspace: WorkspaceContext): Promise<JobRecord[]> =>
  (await readWorkspaceJson<JobRecord[]>(workspace.path, 'data/jobs.json')) ?? [];

export const createJobTools = (resolveWorkspace: WorkspaceResolver): ToolDefinition[] => [
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
      const document = await readWorkspaceJson<ResumeDocument>(workspace.path, 'data/resume-document.json');
      if (!document) throw new Error('RESUME_NOT_FOUND: parse and assess a resume before profile update');

      const currentProfile = await readWorkspaceJson<CareerProfile>(workspace.path, 'profile/profile.json');
      const feedback = args.feedback as ProfileFeedback;
      const draftResult = currentProfile
        ? { ok: true as const, value: updateProfile(currentProfile, feedback) }
        : createProfileDraftState(document, feedback);
      if (!draftResult.ok) throw new Error(`${draftResult.error.code}: cannot transition from ${draftResult.error.from} to ${draftResult.error.to}`);

      const draft = draftResult.value as CareerProfileDraft;
      await writeWorkspaceJson(workspace.path, 'profile/draft.json', draft);
      if (args.confirmed !== true) return asJson(draft);

      const confirmed = confirmProfileState(draft);
      if (!confirmed.ok) throw new Error(`${confirmed.error.code}: cannot transition from ${confirmed.error.from} to ${confirmed.error.to}`);
      await writeWorkspaceJson(workspace.path, 'profile/profile.json', confirmed.value);
      return asJson(confirmed.value);
    },
  }),
  defineTool({
    name: 'job_hunting_import_jobs',
    description: 'Import and deduplicate one local JSON or Markdown JD file inside the active Workspace.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative JSON or Markdown JD file.' },
      format: { type: 'string', enum: ['json', 'markdown'] as const, required: true },
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
      format: { type: 'string', enum: ['json', 'markdown'] as const, required: true },
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
      mark: { type: 'string', enum: ['none', 'favorite', 'interested', 'excluded'] as const, required: true },
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
      return asJson(await tools.syncInterest({ exported: args.export as unknown as InterestExport, confirmed: args.confirmed }));
    },
  }),
];
