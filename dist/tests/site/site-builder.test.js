import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSite, embedSiteData } from '../../src/site/site-builder.js';
const tempDirs = [];
afterEach(async () => {
    await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});
const createJob = (overrides = {}) => ({
    id: 'job-1',
    source: 'local',
    title: 'Data Analyst',
    company: 'Acme',
    location: 'Shanghai',
    requirements: ['SQL'],
    url: 'https://jobs.example.test/1',
    collectedAt: '2026-08-16T08:00:00.000Z',
    ...overrides,
});
describe('site builder', () => {
    it('在构建期内嵌岗位数据，使用当前品牌并清除旧品牌', async () => {
        const outputDir = await mkdtemp(path.join(os.tmpdir(), 'job-hunting-site-'));
        tempDirs.push(outputDir);
        const job = createJob({ description: 'Build dashboards and reports.' });
        const result = await buildSite({
            outputDir,
            jobs: [job],
            generatedAt: '2026-08-16T09:00:00.000Z',
        });
        const html = await readFile(result.indexPath, 'utf8');
        expect(html).toContain('JH');
        expect(html).toContain('求职情报站');
        expect(html).toContain('Job Hunting');
        expect(html).toContain('Data Analyst');
        expect(html).toContain('Build dashboards and reports.');
        expect(html).not.toContain('JD 情报站');
        expect(html).not.toContain('Daily Job Intelligence');
        expect(html).toContain('type="application/json"');
        expect(html).not.toContain('site-data-placeholder');
        expect(html).toMatch(/<script id="site-data" type="application\/json">[\s\S]*<\/script>/);
        expect(html).not.toMatch(/fetch\s*\(/i);
        expect(html).not.toMatch(/import\s*\(/i);
        expect(result.assetPaths.map((assetPath) => path.basename(assetPath))).toEqual([
            'app.css',
            'app.js',
        ]);
    });
    it('将不可信数据安全嵌入非可执行数据脚本，避免 script 闭合突破', () => {
        const data = {
            generatedAt: '2026-08-16T09:00:00.000Z',
            jobs: [
                createJob({
                    title: '</script><script>alert(1)</script>',
                    description: '<img src=x onerror=alert(1)> & \u2028 \u2029',
                }),
            ],
        };
        const template = '<main>__SITE_DATA__</main>';
        const html = embedSiteData(template, data);
        expect(html).toContain('\\u003C/script\\u003E');
        expect(html).toContain('\\u003E');
        expect(html).toContain('\\u0026');
        expect(html).toContain('\\u2028');
        expect(html).toContain('\\u2029');
        expect(html).not.toContain('</script><script>');
        expect(html).toContain('type="application/json"');
    });
});
//# sourceMappingURL=site-builder.test.js.map