export const jobHuntingSkill = {
    name: 'job-hunting',
    description: 'Personal resume assessment, local JD/job organization and matching, static site generation, and interest pool management; integrated BrowserSkill collection is read-only.',
    whenToUse: 'Use for local-first job hunting workflows after resolving the active Workspace.',
    source: 'runtime',
    content: `
Use the job-hunting tools for resume assessment, local JD/job organization, matching,
static site generation, and maintaining the confirmed interest pool. BrowserSkill is an
integrated, read-only collection path and is enabled by default. It still requires an
allowlisted URL and explicit confirmation before a collection run. Ask for explicit
confirmation before changing an interest mark or syncing an exported interest list.
No auto-apply to jobs, no application submission, and no bypass of login, CAPTCHA,
rate limits, or other website restrictions.
`.trim(),
};
//# sourceMappingURL=job-hunting.skill.js.map