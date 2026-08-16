import { defaultConfig } from './config/default-config.js';
import { parseConfig } from './config/schema.js';
import { resolveActiveWorkspace } from './workspace/workspace-output.js';
import { createJobTools } from './tools/job-tools.js';
import { createBrowserJobTool } from './tools/browser-job-tool.js';
import { createResumeTools } from './tools/resume-tools.js';
import { createSiteTools } from './tools/site-tools.js';
import { createStatusTool } from './tools/status-tool.js';
import { jobHuntingSkill } from './skill/job-hunting.skill.js';
export const name = 'dsh-job-hunting';
export const inject = ['tools', 'skills', 'workspaceRegistry'];
export const Config = {
    '~standard': {
        version: 1,
        vendor: 'dsh-job-hunting',
        validate(value) {
            try {
                return { value: parseConfig(value) };
            }
            catch (error) {
                return {
                    issues: [{ message: error instanceof Error ? error.message : String(error) }],
                };
            }
        },
    },
};
const toWorkspaceContext = (ctx, exec) => ({
    workspaceRegistry: ctx.workspaceRegistry,
    ...(exec.agent === undefined
        ? {}
        : {
            agent: {
                sessionId: String(exec.agent.id),
                ...(exec.agent.session.header.cwd === undefined
                    ? {}
                    : { session: { meta: { cwd: exec.agent.session.header.cwd } } }),
            },
        }),
});
export const apply = (ctx, configInput = defaultConfig) => {
    const config = parseConfig(configInput);
    const resolveWorkspace = async (exec) => resolveActiveWorkspace(toWorkspaceContext(ctx, exec));
    const disposers = [];
    try {
        const tools = [
            ...createResumeTools(resolveWorkspace),
            ...createJobTools(resolveWorkspace),
            createBrowserJobTool(resolveWorkspace, config),
            ...createSiteTools(resolveWorkspace, config.outputDir),
            createStatusTool(resolveWorkspace, config),
        ];
        for (const tool of tools) {
            disposers.push(ctx.tools.register(tool));
        }
        disposers.push(ctx.skills.register(jobHuntingSkill));
    }
    catch (error) {
        for (const dispose of disposers.reverse())
            dispose();
        throw error;
    }
    return () => {
        for (const dispose of disposers.reverse())
            dispose();
    };
};
//# sourceMappingURL=index.js.map