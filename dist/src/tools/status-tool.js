import { access } from 'node:fs/promises';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { readWorkspaceJson, resolveOutputRoot } from '../workspace/workspace-output.js';
const jsonOutput = {
    schema: { type: 'json' },
    render: (_args, value) => [
        { type: 'text', text: JSON.stringify(value) ?? 'null' },
    ],
};
const asJson = (value) => JSON.parse(JSON.stringify(value));
const exists = async (path) => {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
};
export const createStatusTool = (resolveWorkspace, config) => defineTool({
    name: 'job_hunting_status',
    description: 'Show the active Workspace, local job/profile/site state, and configured automation defaults.',
    parameters: {},
    output: jsonOutput,
    async execute(_args, exec) {
        const workspace = await resolveWorkspace(exec);
        const jobs = await readWorkspaceJson(workspace.path, 'data/jobs.json');
        const interest = await readWorkspaceJson(workspace.path, 'data/interest-ledger.json');
        return asJson({
            workspace: { id: workspace.id, path: workspace.path, status: workspace.status },
            jobs: { count: jobs?.length ?? 0, present: jobs !== undefined },
            profileConfirmed: await exists(resolveOutputRoot(workspace, 'profile/profile.json')),
            siteIndex: await exists(resolveOutputRoot(workspace, `${config.outputDir}/index.html`)),
            interestPoolCount: Object.values(interest?.marks ?? {}).filter((mark) => mark === 'interested').length,
            browserSkill: { enabled: config.browserSkill.enabled },
            schedule: { enabled: config.schedule.enabled },
            policy: { autoApply: false, bypassRestrictions: false },
        });
    },
});
//# sourceMappingURL=status-tool.js.map