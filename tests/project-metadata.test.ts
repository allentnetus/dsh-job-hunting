import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  name?: string;
  license?: string;
  main?: string;
  types?: string;
  repository?: { type?: string; url?: string } | string;
  homepage?: string;
  bugs?: { url?: string } | string;
  exports?: Record<string, { types?: string; default?: string }>;
  scripts?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type TsConfig = {
  compilerOptions?: {
    outDir?: string;
    rootDir?: string;
  };
};

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, 'utf8')) as T;

const getExpectedBuildArtifact = (
  rootDir: string,
  outDir: string,
  sourcePath: string,
  extension: '.js' | '.d.ts',
): string => {
  const normalizedRootDir = rootDir.replace(/\\/g, '/');
  const normalizedOutDir = outDir.replace(/\\/g, '/');
  const normalizedSourcePath = sourcePath.replace(/\\/g, '/');
  const relativeSourcePath = path.posix.relative(normalizedRootDir, normalizedSourcePath);
  const outputPath = relativeSourcePath.replace(/\.ts$/, extension);

  return `./${path.posix.join(normalizedOutDir, outputPath)}`;
};

describe('项目元数据', () => {
  it('声明 Job Hunting 包名和 MIT 许可证', async () => {
    const packageJson = await readJson<PackageJson>('package.json');

    expect(packageJson.name).toBe('dsh-job-hunting');
    expect(packageJson.license).toBe('MIT');
  });

  it('声明任务 1 要求的脚本、DSH peer 版本，并且不把 BrowserSkill 作为 npm 依赖', async () => {
    const packageJson = await readJson<PackageJson>('package.json');

    expect(packageJson.scripts).toMatchObject({
      build: 'corepack pnpm clean && tsc -p tsconfig.json',
      test: 'corepack pnpm build && vitest run',
      typecheck: 'tsc --noEmit -p tsconfig.json',
      lint: 'tsc --noEmit -p tsconfig.json',
      'dsh:smoke': 'node scripts/dsh-profile-smoke.mjs',
      'security:history': 'gitleaks git --redact --log-opts="--all" .',
    });
    expect(packageJson.peerDependencies).toMatchObject({
      '@deepseek-ai/dsh': '0.1.0-rc.6',
    });

    const declaredDependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
      ...Object.keys(packageJson.optionalDependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ];

    expect(
      declaredDependencyNames.some((dependencyName) =>
        /browser[-_]?skill/i.test(dependencyName),
      ),
    ).toBe(false);
  });

  it('声明可追溯的 GitHub 发布元数据', async () => {
    const packageJson = await readJson<PackageJson>('package.json');

    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'https://github.com/allentnetus/dsh-job-hunting.git',
    });
    expect(packageJson.homepage).toBe('https://github.com/allentnetus/dsh-job-hunting#readme');
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/allentnetus/dsh-job-hunting/issues',
    });
  });

  it('让 package.json 和 README 中的入口声明与 tsconfig 构建结构一致', async () => {
    const packageJson = await readJson<PackageJson>('package.json');
    const tsconfig = await readJson<TsConfig>('tsconfig.json');
    const readme = await readFile('README.md', 'utf8');
    const rootDir = tsconfig.compilerOptions?.rootDir;
    const outDir = tsconfig.compilerOptions?.outDir;

    expect(rootDir).toBeDefined();
    expect(outDir).toBeDefined();

    const pluginJs = getExpectedBuildArtifact(rootDir!, outDir!, 'src/index.ts', '.js');
    const pluginTypes = getExpectedBuildArtifact(rootDir!, outDir!, 'src/index.ts', '.d.ts');
    const runtimeSkillJs = getExpectedBuildArtifact(
      rootDir!,
      outDir!,
      'src/skill/job-hunting.skill.ts',
      '.js',
    );
    const runtimeSkillTypes = getExpectedBuildArtifact(
      rootDir!,
      outDir!,
      'src/skill/job-hunting.skill.ts',
      '.d.ts',
    );

    expect(packageJson.main).toBe(pluginJs);
    expect(packageJson.types).toBe(pluginTypes);
    expect(packageJson.exports).toMatchObject({
      '.': {
        types: pluginTypes,
        default: pluginJs,
      },
      './skill/job-hunting.skill': {
        types: runtimeSkillTypes,
        default: runtimeSkillJs,
      },
      './desktop/desktop-shortcut': {
        types: './dist/src/desktop/desktop-shortcut.d.ts',
        default: './dist/src/desktop/desktop-shortcut.js',
      },
    });
    expect(readme).toContain(`DSH 插件入口点为 \`${pluginJs}\`。`);
    expect(readme).toContain(`Runtime Skill 入口点为 \`${runtimeSkillJs}\`。`);
  });
});
