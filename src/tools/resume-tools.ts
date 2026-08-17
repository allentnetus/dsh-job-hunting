import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { defineTool, type JsonValue, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';

import { applyResumeAssessment, confirmResumeDocument } from '../profile/profile-state-machine.js';
import { assessResume } from '../resume/resume-assessor.js';
import { parseResume } from '../resume/parse-resume.js';
import type { ResumeDocument } from '../resume/resume-document.js';
import { readWorkspaceJson, resolveOutputRoot, writeWorkspaceJson, type WorkspaceContext } from '../workspace/workspace-output.js';

export type WorkspaceResolver = (exec: ToolRunContext) => Promise<WorkspaceContext>;

const jsonOutput = {
  schema: { type: 'json' } as const,
  render: (_args: unknown, value: unknown): ContentBlock[] => [
    { type: 'text', text: JSON.stringify(value) ?? 'null' },
  ],
};

const asJson = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const requireTransition = <T>(result: { ok: true; value: T } | { ok: false; error: { code: string; from: string; to: string } }): T => {
  if (!result.ok) throw new Error(`${result.error.code}: cannot transition from ${result.error.from} to ${result.error.to}`);
  return result.value;
};

export const createResumeTools = (resolveWorkspace: WorkspaceResolver): ToolDefinition[] => [
  defineTool({
    name: 'job_hunting_resume_parse',
    description: 'Parse a resume file inside the active Workspace and persist the parsed document.',
    parameters: {
      path: { type: 'string', required: true, description: 'Workspace-relative resume path.' },
      confirmed: { type: 'boolean', description: 'Persist an explicit user confirmation for this parsed document.' },
    },
    output: jsonOutput,
    async execute(args, exec) {
      const workspace = await resolveWorkspace(exec);
      const filePath = resolveOutputRoot(workspace, args.path);
      const buffer = await readFile(filePath);
      let document = await parseResume({ name: path.basename(filePath), buffer: new Uint8Array(buffer) });

      if (args.confirmed === true) {
        const confirmation = confirmResumeDocument(document, {
          confirmedAt: new Date().toISOString(),
          corrections: [],
        });
        document = requireTransition(confirmation);
      }

      await writeWorkspaceJson(workspace.path, 'data/resume-document.json', document);
      return asJson(document);
    },
  }),
  defineTool({
    name: 'job_hunting_resume_assess',
    description: 'Assess the confirmed resume document in the active Workspace with evidence-backed suggestions.',
    parameters: {
      target: { type: 'json', description: 'Optional assessment target such as a role or job description.' },
    },
    output: jsonOutput,
    async execute(args, exec) {
      const workspace = await resolveWorkspace(exec);
      const document = await readWorkspaceJson<ResumeDocument>(workspace.path, 'data/resume-document.json');
      if (!document) throw new Error('RESUME_NOT_FOUND: parse a resume before assessment');

      const assessment = await assessResume(document, args.target as never);
      const assessedDocument = requireTransition(applyResumeAssessment(document, assessment));
      await writeWorkspaceJson(workspace.path, 'data/resume-document.json', assessedDocument);
      await writeWorkspaceJson(workspace.path, 'data/resume-assessment.json', assessment);
      return asJson(assessment);
    },
  }),
];
