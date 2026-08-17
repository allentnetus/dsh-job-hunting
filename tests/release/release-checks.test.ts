import { execFile } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = process.cwd();

const readText = async (relativePath: string): Promise<string> =>
  readFile(path.join(root, relativePath), 'utf8');

const assertFilesExist = async (relativePaths: readonly string[]): Promise<void> => {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      await access(path.join(root, relativePath));
    }),
  );
};

const assertIssueFormShape = (content: string, relativePath: string): void => {
  expect(content, relativePath).toMatch(/^name:\s*\S/m);
  expect(content, relativePath).toMatch(/^description:\s*\S/m);
  expect(content, relativePath).toMatch(/^body:\s*$/m);

  const entries = content.split(/\n  - type:\s*/).slice(1);
  expect(entries.length, relativePath).toBeGreaterThan(0);

  for (const entry of entries) {
    expect(entry, relativePath).toMatch(/^[^\n]+/);
    expect(entry, relativePath).toMatch(/\n    attributes:\s*\n/);
    if (!/^markdown\b/.test(entry)) {
      expect(entry, relativePath).toMatch(/\n    id:\s*\S/);
    }
  }
};

const walkReleaseFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath);

    if (
      entry.name === '.git' ||
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.superpowers' ||
      relativePath.startsWith(`docs${path.sep}superpowers`) ||
      relativePath.startsWith(`tests${path.sep}`)
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await walkReleaseFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
};

describe('release checks', () => {
  it('ships the required release documents and issue forms', async () => {
    await assertFilesExist([
      'README.md',
      'CHANGELOG.md',
      'SECURITY.md',
      'CONTRIBUTING.md',
      'THIRD-PARTY-NOTICES.md',
      'docs/job-hunting-feasibility.md',
      'docs/dsh-installation.md',
      'docs/browser-skill-integration.md',
      'docs/workspace-output.md',
      'docs/release-checklist.md',
      'scripts/dsh-profile-smoke.mjs',
      '.github/workflows/ci.yml',
      '.github/ISSUE_TEMPLATE/bug.yml',
      '.github/ISSUE_TEMPLATE/feature.yml',
    ]);

    for (const issueForm of ['.github/ISSUE_TEMPLATE/bug.yml', '.github/ISSUE_TEMPLATE/feature.yml']) {
      assertIssueFormShape(await readText(issueForm), issueForm);
    }
  });

  it('documents the v0.1 support boundary and operating model', async () => {
    const readme = await readText('README.md');
    const feasibility = await readText('docs/job-hunting-feasibility.md');
    const browser = await readText('docs/browser-skill-integration.md');
    const workspace = await readText('docs/workspace-output.md');

    expect(`${readme}\n${feasibility}`).toMatch(/local JSON|本地 JSON/);
    expect(`${readme}\n${feasibility}`).toMatch(/local Markdown|本地 Markdown/);
    expect(feasibility).toMatch(/DOCX/);
    expect(feasibility).toMatch(/文字型 PDF|text-layer PDF/i);
    expect(feasibility).toMatch(/TXT/);
    expect(feasibility).toMatch(/Markdown/);
    expect(feasibility).toMatch(/扫描.*PDF.*拒绝|scanned.*PDF.*reject/i);
    expect(feasibility).toMatch(/加密.*PDF.*拒绝|encrypted[\s\S]*PDF[\s\S]*reject/i);
    expect(feasibility).toMatch(/不(?:进行)? OCR|does not OCR|no OCR/i);
    expect(`${readme}\n${feasibility}`).toContain('file://');
    expect(`${readme}\n${workspace}`).toMatch(/内嵌|embedded/i);
    expect(`${readme}\n${workspace}`).toMatch(/schedule\.enabled.*false|定时.*默认.*关闭/i);
    expect(`${readme}\n${workspace}`).toMatch(/session-reminder|会话.*提醒/);

    expect(browser).toMatch(/直接注册|已接入|integrated/i);
    expect(browser).toContain('job_hunting_collect_browser_jobs');
    expect(browser).toMatch(/外部|external/i);
    expect(browser).toMatch(/只读|read-only/i);
    expect(browser).toMatch(/allowlist|白名单/i);
    expect(browser).toMatch(/item cap|maxItemsPerRun/);
    expect(browser).toMatch(/minIntervalMs|rate limit|限速|间隔/);
    expect(browser).toMatch(/人工|human/i);
    expect(browser).toMatch(/session stop|会话.*停止/i);
    for (const hostname of [
      'www.51job.com',
      'www.zhipin.com',
      'www.liepin.com',
      'www.zhaopin.com',
      'www.iguopin.com',
    ]) {
      expect(browser, hostname).toContain(hostname);
    }
    expect(browser).toContain('additionalAllowedDomains');
    expect(workspace).toMatch(/临时|temporary/i);
    expect(workspace).toMatch(/正式|authoritative|正式.*interest/i);
    expect(workspace).toMatch(/批准|approval/i);
  });

  it('documents the DeepSeek Harness installation and profile override path', async () => {
    const installation = await readText('docs/dsh-installation.md');
    const readme = await readText('README.md');
    const browser = await readText('docs/browser-skill-integration.md');

    expect(installation).toContain('dsh.cmd plugin --profile web add');
    expect(installation).toContain('dsh.cmd --profile web --dump-config');
    expect(installation).toContain('npm.cmd install --global pnpm@11.19.0');
    expect(installation).toContain('npm.cmd install --global @deepseek-ai/dsh@0.1.0-rc.6');
    expect(installation).toContain('npx.cmd @deepseek-ai/dsh@0.1.0-rc.6');
    expect(installation).toContain(
      'https://codeload.github.com/allentnetus/dsh-job-hunting/tar.gz/refs/tags/v0.1.2',
    );
    expect(installation).not.toContain('git+https://github.com/allentnetus/dsh-job-hunting.git#v0.1.2');
    expect(installation).not.toContain('github:allentnetus/dsh-job-hunting#v0.1.2');
    expect(installation).toContain('dsh-job-hunting');
    expect(installation).toContain('cordis.patch.yml');
    expect(installation).toContain('additionalAllowedDomains');
    expect(installation).toContain('0.1.0-rc.6');
    expect(readme).toContain('docs/dsh-installation.md');
    expect(readme).toContain(
      'https://codeload.github.com/allentnetus/dsh-job-hunting/tar.gz/refs/tags/v0.1.2',
    );
    expect(readme).not.toContain('git+https://github.com/allentnetus/dsh-job-hunting.git#v0.1.2');
    expect(readme).not.toContain('github:allentnetus/dsh-job-hunting#v0.1.2');
    expect(browser).toMatch(/profiles[\\/]web[\\/]cordis\.patch\.yml/);
  });

  it('documents the security exclusions and approved entry points', async () => {
    const readme = await readText('README.md');
    const security = await readText('SECURITY.md');
    const contributing = await readText('CONTRIBUTING.md');
    const checklist = await readText('docs/release-checklist.md');
    const combined = `${readme}\n${security}\n${contributing}\n${checklist}`;

    expect(combined).toMatch(/MIT/);
    expect(combined).toMatch(/无自动投递|不自动投递|no automatic application|does not submit/i);
    expect(combined).toMatch(/凭证提取|credential extraction|credentials/i);
    expect(combined).toMatch(/绕过|bypass/i);
    expect(combined).toMatch(/Windows.*快捷方式|Windows shortcut/i);
    expect(combined).toMatch(/明确批准|explicit approval|requireApproval/i);
    expect(combined).toMatch(/入口点|entrypoint/i);
    expect(combined).toMatch(/module-level|模块(?:级|服务)/);
    expect(combined).toMatch(/不会自动创建|does not (?:automatically )?create|never creates.*automatically/i);
    expect(combined).toMatch(/host.*manual|host.*手动|宿主.*手工|用户入口(?:尚未|暂未)提供|user entry.*not yet/i);
    expect(combined).toMatch(/Report a vulnerability|Private vulnerability reporting|私下报告/);
  });

  it('contains the DSH smoke command, complete-history scan workflow, and changelog', async () => {
    const packageJson = JSON.parse(await readText('package.json')) as {
      scripts?: Record<string, string>;
    };
    const workflow = await readText('.github/workflows/ci.yml');
    const changelog = await readText('CHANGELOG.md');
    const ignore = await readText('.gitignore');

    expect(packageJson.scripts?.['dsh:smoke']).toBe('node scripts/dsh-profile-smoke.mjs');
    expect(packageJson.scripts?.['security:history']).toBe('gitleaks git --redact --log-opts="--all" .');
    expect(packageJson.scripts?.['release:check']).toContain('pnpm dsh:smoke');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('pnpm dsh:smoke');
    expect(workflow).toContain('gitleaks/gitleaks-action@v2');
    expect(changelog).toContain('0.1.0');
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.superpowers/sdd/');
  });

  it('classifies the lockfile dependency licenses without treating them all as MIT', async () => {
    const notices = await readText('THIRD-PARTY-NOTICES.md');
    const packageJson = JSON.parse(await readText('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const dependencies = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    });

    expect(notices).toMatch(/### MIT/);
    expect(notices).toMatch(/### BSD-3-Clause/);
    expect(notices).toMatch(/### Apache-2\.0/);
    expect(notices).toMatch(/### Other|BSD-2-Clause|MPL-2\.0|ISC/);
    expect(notices).toMatch(/pnpm licenses list/);
    expect(notices).toMatch(/mammoth/);
    expect(notices).toMatch(/pdfjs-dist/);
    expect(notices).toMatch(/@protobufjs\/|protobufjs/);
    expect(dependencies).not.toContain('browser-skill');
    expect(notices).not.toMatch(/BrowserSkill[\s\S]{0,120}MIT-licensed/i);
    expect(notices).toMatch(/operator.*confirm|运营方.*确认|操作者.*确认/i);
  });

  it('has no obvious secrets, resume files, or retired branding in release-oriented files', async () => {
    const relativePaths = await walkReleaseFiles(root);
    const contents = await Promise.all(
      relativePaths.map(async (relativePath) => ({
        relativePath,
        content: await readText(relativePath),
      })),
    );
    const obviousSecret =
      /-----BEGIN (?:RSA |OPENSSH |EC |PGP )?PRIVATE KEY-----|\b(?:sk|ghp|github_pat|xox[baprs])-[A-Za-z0-9_-]{12,}\b|\bAKIA[0-9A-Z]{16}\b/;
    const retiredBrand = /JD 情报站|Daily Job Intelligence/;

    for (const { relativePath, content } of contents) {
      expect(content, relativePath).not.toMatch(obviousSecret);
      expect(content, relativePath).not.toMatch(retiredBrand);
      expect(relativePath.toLowerCase(), relativePath).not.toMatch(
        /(?:^|[\\/])(?:resume|简历)[^\\/]*\.(?:docx|pdf|txt|md)$/,
      );
    }

    const secretFileName = /(?:^|[\\/])(?:\.env|[^\\/]+\.pem|[^\\/]+\.key)$/i;
    expect(secretFileName.test('.env')).toBe(true);
    expect(secretFileName.test('config/.env')).toBe(true);
    expect(contents.some(({ relativePath }) => secretFileName.test(relativePath))).toBe(false);
  });

  it('keeps package entrypoints, templates, documentation, and dry-run contents aligned', async () => {
    const packageJson = JSON.parse(await readText('package.json')) as {
      main?: string;
      types?: string;
      files?: string[];
      scripts?: Record<string, string>;
    };
    const tsconfig = JSON.parse(await readText('tsconfig.json')) as {
      compilerOptions?: { outDir?: string };
    };
    const packageFiles = packageJson.files ?? [];

    expect(packageJson.main).toBe('./dist/src/index.js');
    expect(packageJson.types).toBe('./dist/src/index.d.ts');
    expect(tsconfig.compilerOptions?.outDir).toBe('dist');
    expect(packageFiles).toContain('dist/src');
    expect(packageFiles).toContain('templates');
    expect(packageFiles).toContain('docs/job-hunting-feasibility.md');
    expect(packageFiles).not.toContain('tests');
    expect(packageJson.scripts?.build).toBe('corepack pnpm clean && tsc -p tsconfig.json');
    expect(packageJson.scripts?.test).toBe('corepack pnpm build && vitest run');
    expect(packageJson.scripts?.['release:check']).toBe(
      'corepack pnpm build && vitest run tests/release/release-checks.test.ts && corepack pnpm dsh:smoke && corepack pnpm pack --dry-run',
    );

    await assertFilesExist([
      'package.json',
      'dist/src/index.js',
      'dist/src/index.d.ts',
      'dist/src/skill/job-hunting.skill.js',
      'dist/src/skill/job-hunting.skill.d.ts',
      'dist/src/desktop/desktop-shortcut.js',
      'dist/src/desktop/desktop-shortcut.d.ts',
      'docs/job-hunting-feasibility.md',
      'docs/dsh-installation.md',
      'docs/browser-skill-integration.md',
      'docs/workspace-output.md',
      'docs/release-checklist.md',
      'templates/default/index.html',
      'templates/default/app.js',
      'templates/default/app.css',
      'dsh.bundle',
      'cordis.patch.yml',
      'LICENSE',
      'README.md',
      'CHANGELOG.md',
      'SECURITY.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md',
      'THIRD-PARTY-NOTICES.md',
    ]);

    const pack = process.platform === 'win32'
      ? await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'corepack pnpm pack --dry-run'], {
          cwd: root,
          maxBuffer: 1024 * 1024,
        })
      : await execFileAsync('corepack', ['pnpm', 'pack', '--dry-run'], {
          cwd: root,
          maxBuffer: 1024 * 1024,
        });
    const packOutput = `${pack.stdout}\n${pack.stderr}`;

    for (const publishedPath of [
      'dist/src/index.js',
      'dist/src/index.d.ts',
      'dist/src/skill/job-hunting.skill.js',
      'dist/src/skill/job-hunting.skill.d.ts',
      'dist/src/desktop/desktop-shortcut.js',
      'dist/src/desktop/desktop-shortcut.d.ts',
      'docs/job-hunting-feasibility.md',
      'docs/dsh-installation.md',
      'docs/browser-skill-integration.md',
      'docs/workspace-output.md',
      'docs/release-checklist.md',
      'templates/default/index.html',
      'templates/default/app.js',
      'templates/default/app.css',
      'dsh.bundle',
      'cordis.patch.yml',
      'LICENSE',
      'CODE_OF_CONDUCT.md',
      'THIRD-PARTY-NOTICES.md',
      'README.md',
      'CHANGELOG.md',
      'SECURITY.md',
      'CONTRIBUTING.md',
      'package.json',
    ]) {
      expect(packOutput).toContain(publishedPath);
    }
    expect(packOutput).not.toMatch(/dist[\\/]tests[\\/]|tests[\\/].*\.test\./);
    expect(packOutput).not.toMatch(/dist[\\/]vitest\.config/);
    expect(packOutput).not.toMatch(/(?:^|\r?\n)(?:tests[\\/]|dist[\\/]tests[\\/]|\.superpowers(?:[\\/]|$))/m);
    expect(packOutput).not.toMatch(/node_modules|\.superpowers|\.env|\.pem/);
  });
});
