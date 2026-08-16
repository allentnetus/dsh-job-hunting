import * as plugin from '../src/index.js';
import { defaultConfig } from '../src/config/default-config.js';
import { describe, expect, it } from 'vitest';
const TOOL_NAMES = [
    'job_hunting_resume_parse',
    'job_hunting_resume_assess',
    'job_hunting_profile_update',
    'job_hunting_import_jobs',
    'job_hunting_collect_jobs',
    'job_hunting_collect_browser_jobs',
    'job_hunting_mark_interest',
    'job_hunting_sync_interest',
    'job_hunting_generate_report',
    'job_hunting_build_site',
    'job_hunting_open_site',
    'job_hunting_status',
].sort();
const createFakeRegistry = () => {
    const entries = [];
    return {
        entries,
        register(entry) {
            entries.push(entry);
            return () => {
                const index = entries.indexOf(entry);
                if (index >= 0)
                    entries.splice(index, 1);
            };
        },
    };
};
describe('job hunting DSH plugin registration', () => {
    it('exports the Cordis plugin shape', () => {
        expect(Object.keys(plugin).sort()).toEqual(['Config', 'apply', 'inject', 'name']);
        expect(plugin.name).toBe('dsh-job-hunting');
    });
    it('registers one runtime skill and the integrated BrowserSkill tool with fake registries', () => {
        const tools = createFakeRegistry();
        const skills = createFakeRegistry();
        const ctx = {
            tools,
            skills,
            workspaceRegistry: {
                list: () => [],
                resolveByPath: async () => undefined,
            },
        };
        const dispose = plugin.apply(ctx);
        expect(tools.entries.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
        expect(skills.entries).toHaveLength(1);
        expect(skills.entries[0]).toMatchObject({ name: 'job-hunting' });
        const skillText = `${skills.entries[0]?.description ?? ''} ${skills.entries[0]?.content ?? ''}`;
        for (const phrase of [
            'resume assessment',
            'local JD/job organization',
            'matching',
            'static site',
            'interest pool',
            'integrated BrowserSkill',
            'no auto-apply',
            'no bypass',
        ]) {
            expect(skillText.toLowerCase()).toContain(phrase.toLowerCase());
        }
        dispose?.();
        expect(tools.entries).toHaveLength(0);
        expect(skills.entries).toHaveLength(0);
    });
    it('enables the integrated BrowserSkill tool by default while keeping schedule disabled', () => {
        expect(defaultConfig.browserSkill.enabled).toBe(true);
        expect(defaultConfig.schedule.enabled).toBe(false);
    });
});
//# sourceMappingURL=plugin-registration.test.js.map