# Job Hunting 实施方案

> **面向执行代理：** 实施本方案时，必须按任务逐项执行，并使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。每个任务都使用 `- [ ]` 跟踪完成状态。

**目标：** 为 DeepSeek Harness 构建面向个人求职者的 `Job Hunting` Skill，实现简历解析、简历评估、求职画像、招聘岗位 JD 本地归档与匹配、本地静态 HTML 求职情报站，以及收藏和意向岗位池管理。

**架构：** 项目采用 DSH Plugin + Runtime Skill 结构，拆分为简历解析、简历评估、求职画像、岗位标准化、岗位匹配、报告生成、网站渲染、Workspace 输出和 Windows 快捷方式服务。v0.1 默认使用本地 JSON/Markdown 岗位源，并直接注册 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 只读采集工具；工具通过外部 `bsk` CLI 调用，不打包浏览器扩展或复制其源码。网站在构建阶段内嵌数据，以适配 `file://` 直接打开场景。

**技术栈：** TypeScript、Node.js、pnpm、Vitest、`mammoth`、`pdfjs-dist`、DSH `apply/inject/defineTool` API、Tencent/BrowserSkill `bsk` CLI、HTML/CSS/JavaScript 静态网站、Windows Shell 快捷方式接口。

## 全局约束

- 项目源码、开发文件和发布资料位于 `G:\发布\Job Hunting Skill`。
- 用户数据和生成的网站位于当前会话选中的默认 Workspace，不能写死为 `E:\career` 或 `G:\DeepSeek Harness`。
- 产品品牌统一为 `JH / 求职情报站 / Job Hunting`，移除旧的 `JD` 和 `Daily Job Intelligence` 文案。
- 简历解析与简历评估必须是两个独立操作；评估必须依赖用户确认后的解析结果。
- v0.1 支持 DOCX、文字型 PDF、TXT 和 Markdown；扫描版 PDF 明确提示不支持。
- v0.1 默认使用本地 JSON/Markdown 岗位源；BrowserSkill 工具直接注册并默认启用，实际采集
  仍要求外部 `bsk`、精确白名单和用户明确批准。
- `schedule.enabled` 默认值为 `false`；当前 DSH 的调度只保证会话内提醒，不能宣传为可靠的后台 Cron。
- 静态 HTML 在构建时内嵌岗位数据，不能依赖 `file://` 页面运行时 `fetch(JSON)`。
- 桌面快捷方式创建必须经过明确批准；网站构建失败时不得创建或更新快捷方式。
- 自有代码和自有模板使用 MIT；第三方依赖必须保留原许可证，并登记到 `THIRD-PARTY-NOTICES.md`。
- 不读取或导出密码、Cookie、Token、本地存储凭据及其他认证材料。
- BrowserSkill 采集默认只读、域名白名单、限速、必要时人工处理登录/验证码，并在结束时执行 `bsk session stop`。
- 不自动投递简历，不自动向招聘方发送消息。
- 每个生产函数都必须先写测试、观察测试失败，再编写最小实现。

---

## 任务 1：创建项目包和发布元数据

**文件：**

- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`vitest.config.ts`
- 创建：`.gitignore`
- 创建：`LICENSE`
- 创建：`THIRD-PARTY-NOTICES.md`
- 创建：`README.md`
- 创建：`SECURITY.md`
- 创建：`CONTRIBUTING.md`
- 创建：`CODE_OF_CONDUCT.md`
- 测试：`tests/project-metadata.test.ts`

**接口与结果：**

- npm 包名为 `dsh-job-hunting`。
- `package.json` 的 `license` 为 `MIT`。
- 提供 `pnpm test`、`pnpm typecheck`、`pnpm build` 和 `pnpm lint` 命令。
- DSH 运行时依赖按照已验证版本声明，不在项目中重新打包完整 Harness。
- BrowserSkill 工具直接注册到插件，但 CLI 和浏览器扩展仍由宿主单独提供，不作为 npm 依赖安装。

- [ ] **步骤 1：先写失败测试。**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('项目元数据', () => {
  it('声明 Job Hunting 包名和 MIT 许可证', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
    expect(packageJson.name).toBe('dsh-job-hunting');
    expect(packageJson.license).toBe('MIT');
  });
});
```

- [ ] **步骤 2：运行聚焦测试并确认失败。**

运行：`pnpm vitest run tests/project-metadata.test.ts`

预期：由于 `package.json` 尚不存在，测试失败。

- [ ] **步骤 3：创建最小项目元数据。**

配置 DSH 插件入口、Runtime Skill 入口、构建、测试、类型检查和 lint 脚本。不要加入未验证的运行时依赖。

- [ ] **步骤 4：添加 MIT 和第三方声明。**

`THIRD-PARTY-NOTICES.md` 必须说明 Tencent/BrowserSkill 是由宿主提供的外部运行前置条件，不对其许可证作断言，并要求根据锁定文件生成完整依赖许可证清单。实际锁定的 BSD-3-Clause 依赖也必须单独列出，不能笼统写成 MIT。

- [ ] **步骤 5：运行测试和类型检查。**

运行：`pnpm vitest run tests/project-metadata.test.ts && pnpm typecheck`

预期：通过且无警告。

---

## 任务 2：定义领域类型和确定性台账

**文件：**

- 创建：`src/domain/types.ts`
- 创建：`src/domain/job-ledger.ts`
- 创建：`src/domain/interest-ledger.ts`
- 创建：`src/domain/matcher.ts`
- 测试：`tests/domain/job-ledger.test.ts`
- 测试：`tests/domain/interest-ledger.test.ts`
- 测试：`tests/domain/matcher.test.ts`

**接口：**

```ts
export type InterestMark = 'none' | 'favorite' | 'interested' | 'excluded';

export interface JobRecord {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description?: string;
  requirements: string[];
  url: string;
  postedAt?: string;
  deadline?: string;
  collectedAt: string;
  matchScore?: number;
  matchReasons?: string[];
}

export interface CareerProfile {
  targetRoles: string[];
  targetIndustries: string[];
  targetCompanies: string[];
  preferredLocations: string[];
  excludedLocations: string[];
  keywords: string[];
  avoid: string[];
  version: number;
  confirmedAt?: string;
}

export interface InterestState {
  marks: Record<string, InterestMark>;
  notes: Record<string, string>;
  updatedAt: string;
}
```

导出函数：

- `normalizeJob(input: JobInput): JobRecord`
- `dedupeJobs(existing: readonly JobRecord[], incoming: readonly JobRecord[]): JobRecord[]`
- `markInterest(state: InterestState, jobId: string, mark: InterestMark): InterestState`
- `matchJob(job: JobRecord, profile: CareerProfile): MatchResult`

- [ ] **步骤 1：先写岗位去重失败测试。**

覆盖 URL 标准化去重，以及没有 URL 时使用公司、岗位名称、地点作为备用身份。

- [ ] **步骤 2：运行聚焦测试并确认失败。**

运行：`pnpm vitest run tests/domain/job-ledger.test.ts tests/domain/interest-ledger.test.ts tests/domain/matcher.test.ts`

预期：由于领域模块尚不存在，测试失败。

- [ ] **步骤 3：实现最小纯函数。**

只实现确定性标准化和去重，不在台账或匹配器中调用模型。保留来源字段，不删除历史岗位。

- [ ] **步骤 4：补充兴趣状态测试。**

覆盖 `favorite`、`interested`、`excluded`、清除标记、添加备注，以及从 `interested` 岗位推导意向岗位池。

- [ ] **步骤 5：运行领域测试。**

运行：`pnpm vitest run tests/domain`

预期：全部通过。

---

## 任务 3：实现 Workspace 输出和配置校验

**文件：**

- 创建：`src/workspace/workspace-output.ts`
- 创建：`src/config/schema.ts`
- 创建：`src/config/default-config.ts`
- 测试：`tests/workspace/workspace-output.test.ts`
- 测试：`tests/config/schema.test.ts`

**接口：**

- `resolveActiveWorkspace(ctx: DshContext): Promise<WorkspaceContext>`
- `resolveOutputRoot(workspace: WorkspaceContext, relativePath: string): string`
- `ensureOutputTree(root: string): Promise<void>`
- `readWorkspaceJson<T>(root: string, relativePath: string): Promise<T | undefined>`
- `writeWorkspaceJson<T>(root: string, relativePath: string, value: T): Promise<void>`

默认配置：

```ts
export const defaultConfig = {
  outputDir: 'job-hunting-site',
  schedule: {
    enabled: false,
    mode: 'session-reminder',
    time: '08:00',
    timezone: 'Asia/Shanghai',
  },
  browserSkill: {
    enabled: true,
    executable: 'bsk',
    mode: 'read-only',
    allowedDomains: [
      'www.51job.com',
      'www.zhipin.com',
      'www.liepin.com',
      'www.zhaopin.com',
      'www.iguopin.com',
    ],
    additionalAllowedDomains: [],
    requireUserApproval: true,
    maxItemsPerRun: 50,
  },
  desktopShortcut: {
    enabled: true,
    name: 'Job Hunting',
    requireApproval: true,
  },
} as const;
```

- [ ] **步骤 1：先写 Workspace 解析失败测试。**

覆盖有效 Workspace、相对输出路径、没有当前 Workspace，以及拒绝绝对路径和 `..` 路径穿越。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/workspace/workspace-output.test.ts tests/config/schema.test.ts`

预期：由于模块不存在，测试失败。

- [ ] **步骤 3：实现 Workspace 解析和安全路径拼接。**

使用 DSH Workspace Registry 和会话上下文。不得回退到 `process.cwd()`、`E:\career` 或 `G:\DeepSeek Harness` 作为用户数据目录。

- [ ] **步骤 4：实现输出目录和 JSON 读写。**

创建 `input/resumes`、`profile`、`data`、`reports`、`assets` 和 `config`。JSON 采用临时同级文件写入后重命名，避免半写入状态。

- [ ] **步骤 5：运行测试和类型检查。**

运行：`pnpm vitest run tests/workspace tests/config && pnpm typecheck`

预期：全部通过。

---

## 任务 4：实现简历解析和格式边界

**文件：**

- 创建：`src/resume/resume-document.ts`
- 创建：`src/resume/docx-parser.ts`
- 创建：`src/resume/pdf-parser.ts`
- 创建：`src/resume/text-parser.ts`
- 创建：`src/resume/parse-resume.ts`
- 测试：`tests/resume/parse-resume.test.ts`

**接口：**

- `parseResume(file: ResumeFile): Promise<ResumeDocument>`
- `parseDocx(buffer: Uint8Array): Promise<string>`
- `parseTextPdf(buffer: Uint8Array): Promise<string>`
- `unsupportedFormatError(format: string): ResumeParseError`

- [ ] **步骤 1：先写 DOCX、文字型 PDF、纯文本和扫描版 PDF 失败测试。**

扫描版 PDF 必须返回 `UNSUPPORTED_SCANNED_PDF`，不能返回空文本但状态为成功。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/resume/parse-resume.test.ts`

预期：由于解析模块不存在，测试失败。

- [ ] **步骤 3：实现 DOCX 和文字提取。**

使用 `mammoth` 提取 DOCX，使用 `pdfjs-dist` 提取文字型 PDF。原始文本提取与结构化整理必须分开，便于查看来源和警告。

- [ ] **步骤 4：实现明确的格式错误。**

扫描版 PDF、图片、加密文件和未知格式都返回可操作的错误提示。v0.1 不调用 OCR。

- [ ] **步骤 5：运行解析测试。**

运行：`pnpm vitest run tests/resume && pnpm typecheck`

预期：全部通过。

---

## 任务 5：实现简历评估和求职画像状态机

**文件：**

- 创建：`src/resume/resume-assessor.ts`
- 创建：`src/profile/career-profile.ts`
- 创建：`src/profile/profile-state-machine.ts`
- 创建：`src/domain/llm-contracts.ts`
- 测试：`tests/profile/profile-state-machine.test.ts`
- 测试：`tests/resume/resume-assessor.test.ts`

**接口：**

- `assessResume(document: ResumeDocument, target?: AssessmentTarget): Promise<ResumeAssessment>`
- `createDraftProfile(input: ProfileFeedback): CareerProfileDraft`
- `confirmProfile(draft: CareerProfileDraft): CareerProfile`
- `updateProfile(profile: CareerProfile, feedback: ProfileFeedback): CareerProfileDraft`

状态流转：

```text
parsed → user-confirmed → assessed → profile-draft → profile-confirmed
```

- [ ] **步骤 1：先写禁止未确认简历进入评估的测试。**

未确认的 `ResumeDocument` 必须被拒绝；确认后的文档才能产生带证据引用的评估结果。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/profile tests/resume/resume-assessor.test.ts`

预期：由于状态机和评估器不存在，测试失败。

- [ ] **步骤 3：实现状态机。**

非法状态转移返回结构化错误。用户修正内容必须与模型建议分开保存。

- [ ] **步骤 4：实现模型输出契约。**

要求模型返回结构化 JSON、证据引用、置信度和明确的 `unknown`。禁止编造经历、日期、公司和技能。

- [ ] **步骤 5：运行测试。**

运行：`pnpm vitest run tests/profile tests/resume && pnpm typecheck`

预期：全部通过。

---

## 任务 6：实现本地岗位导入、匹配和报告

**文件：**

- 创建：`src/jobs/local-json-adapter.ts`
- 创建：`src/jobs/local-markdown-adapter.ts`
- 创建：`src/jobs/job-collector.ts`
- 创建：`src/reports/daily-report.ts`
- 测试：`tests/jobs/local-adapters.test.ts`
- 测试：`tests/reports/daily-report.test.ts`

**接口：**

- `collectLocalJobs(input: LocalJobSource): Promise<JobRecord[]>`
- `buildDailyReport(jobs: JobRecord[], profile: CareerProfile, date: string): DailyReport`
- `writeReportBundle(report: DailyReport, outputRoot: string): Promise<void>`

- [ ] **步骤 1：先写 JSON/Markdown 标准化失败测试。**

覆盖可选字段缺失、格式错误、来源链接保留和采集时间保留。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/jobs tests/reports`

预期：由于适配器和报告生成器不存在，测试失败。

- [ ] **步骤 3：实现本地适配器。**

只接受用户明确指定的文件或 Workspace 内已配置的岗位目录，不扫描任意磁盘路径。

- [ ] **步骤 4：接入台账去重和确定性匹配。**

保留原始来源信息，并根据已确认求职画像生成可解释的匹配原因。

- [ ] **步骤 5：实现 JSON、Markdown 和 HTML 报告。**

记录 `generatedAt`、`collectedAt`、来源状态和失败信息。部分来源失败时，报告必须明确显示异常。

- [ ] **步骤 6：运行测试。**

运行：`pnpm vitest run tests/jobs tests/reports`

预期：全部通过。

---

## 任务 7：构建静态求职情报站和兴趣导出

**文件：**

- 创建：`templates/default/index.html`
- 创建：`templates/default/app.css`
- 创建：`templates/default/app.js`
- 创建：`src/site/site-builder.ts`
- 创建：`src/site/interest-export.ts`
- 测试：`tests/site/site-builder.test.ts`
- 测试：`tests/site/interest-export.test.ts`

**接口：**

- `buildSite(input: SiteBuildInput): Promise<SiteBuildResult>`
- `embedSiteData(template: string, data: SiteData): string`
- `exportInterestMarks(state: InterestState, jobs: JobRecord[]): InterestExport`

网站要求：

- 使用 `JH / 求职情报站 / Job Hunting` 品牌。
- 保持原有深色、棕黑、橙红强调的情报站风格。
- 构建期内嵌数据，不在页面运行时读取旁侧 JSON。
- 显示 `favorite`、`interested` 和 `excluded` 状态。
- 静态页面临时交互使用浏览器 `localStorage`。
- 提供当前兴趣标记的 JSON 导出。

- [ ] **步骤 1：先写数据内嵌和旧品牌清除测试。**

生成 HTML 必须包含当前品牌和岗位数据，不能出现 `JD 情报站` 或 `Daily Job Intelligence`。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/site/site-builder.test.ts tests/site/interest-export.test.ts`

预期：由于模板和构建器不存在，测试失败。

- [ ] **步骤 3：创建默认模板。**

保留既有视觉布局、颜色、间距、卡片密度、筛选方式和顶部信息栏。JH 图标必须使用自绘或明确授权素材，不加入钢铁侠影视图片、第三方 Logo 或未确认授权字体。

- [ ] **步骤 4：实现构建期数据注入。**

安全转义 JSON 并写入页面数据块。岗位描述属于不可信输入，不能直接拼接为任意 HTML。

- [ ] **步骤 5：实现浏览器临时标记和导出。**

使用 `localStorage` 保存当前浏览器中的即时操作，导出岗位 ID、标记、备注和时间戳。正式的 Workspace 台账由后续同步工具写入。

- [ ] **步骤 6：运行静态构建和浏览器验证。**

运行：`pnpm vitest run tests/site && pnpm build`

用 Chrome 或 Edge 双击打开生成的 `index.html`，确认页面无控制台错误，并且不通过网络请求加载本地数据。

预期：全部通过。

---

## 任务 8：接入 BrowserSkill 适配器

**文件：**

- 创建：`src/browser/browser-skill-runner.ts`
- 创建：`src/browser/browser-skill-adapter.ts`
- 创建：`src/browser/browser-policy.ts`
- 创建：`src/tools/browser-job-tool.ts`
- 测试：`tests/browser/browser-policy.test.ts`
- 测试：`tests/browser/browser-skill-adapter.test.ts`
- 修改：`THIRD-PARTY-NOTICES.md`
- 修改：`README.md`

**接口：**

- `checkBrowserSkill(executable: string): Promise<BrowserSkillStatus>`
- `collectWithBrowserSkill(request: BrowserCollectionRequest, runner: BskRunner): Promise<JobRecord[]>`
- `validateBrowserPolicy(request: BrowserCollectionRequest, config: BrowserSkillConfig): void`

运行器必须抽象进程执行，测试使用假的命令运行器。生产调用遵循 BrowserSkill 会话生命周期：

```text
bsk status
bsk session start --no-focus
... 所有命令都带 --session <id> ...
bsk session stop <id>
```

- [ ] **步骤 1：先写合规策略失败测试。**

拒绝空域名白名单、写入模式、凭据提取表达式和提交表单请求；允许在明确白名单域名下进行只读采集。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/browser`

预期：由于适配器和策略模块不存在，测试失败。

- [ ] **步骤 3：实现策略保护。**

默认值必须为 `enabled: true`、`mode: read-only`、`requireUserApproval: true`，并要求显式域名白名单。不得暴露无限制的通用 `bsk evaluate` 工具。

- [ ] **步骤 4：实现状态检查和会话封装。**

使用 `try/finally` 确保始终停止会话。遇到登录、验证码、OTP、支付或提交确认页面时，返回人工协助请求，不进行盲目重试。

- [ ] **步骤 5：实现结构化岗位提取。**

只读取用户授权页面中可见的岗位信息，转换为 `JobRecord`，保留来源链接和采集时间，然后复用本地台账、去重和匹配流程。

- [ ] **步骤 6：运行适配器测试并更新文档。**

运行：`pnpm vitest run tests/browser`

预期：全部通过。文档说明 BrowserSkill 工具已直接接入，但 CLI 和浏览器扩展仍是外部运行前置条件，不打包到 Job Hunting 中。

---

## 任务 9：实现意向岗位池同步

**文件：**

- 创建：`src/interest/interest-sync.ts`
- 创建：`src/interest/interest-tools.ts`
- 测试：`tests/interest/interest-sync.test.ts`

**接口：**

- `syncInterestExport(exported: InterestExport, ledger: InterestState): InterestState`
- `getInterestPool(jobs: JobRecord[], state: InterestState): JobRecord[]`
- `updateInterestFromConversation(jobId: string, mark: InterestMark, note?: string): Promise<void>`

- [ ] **步骤 1：先写幂等同步失败测试。**

同一个导出文件导入两次不能产生重复记录；`excluded` 必须覆盖此前的 `interested`；未知岗位 ID 必须报告，不能静默创建虚假岗位。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/interest/interest-sync.test.ts`

预期：由于同步模块不存在，测试失败。

- [ ] **步骤 3：实现台账同步和意向池生成。**

将正式状态写入当前 Workspace 的 `data/interest-ledger.json`，保存备注和更新时间。

- [ ] **步骤 4：注册 DSH 工具。**

注册 `job_hunting_mark_interest` 和 `job_hunting_sync_interest`。没有用户确认时，不能把普通对话自动解释为永久兴趣标记。

- [ ] **步骤 5：运行测试。**

运行：`pnpm vitest run tests/interest`

预期：全部通过。

---

## 任务 10：增加审批保护的 Windows 快捷方式

**文件：**

- 创建：`src/desktop/desktop-shortcut.ts`
- 创建：`src/desktop/windows-shortcut.ts`
- 测试：`tests/desktop/windows-shortcut.test.ts`

**接口：**

- `validateShortcutTarget(siteRoot: string): Promise<string>`
- `createOrUpdateShortcut(request: ShortcutRequest, shell: ShortcutShell): Promise<ShortcutResult>`

- [ ] **步骤 1：先写使用模拟桌面路径和 Shell 的失败测试。**

覆盖目标校验、Manifest 所有权下的幂等更新、拒绝覆盖无关同名快捷方式，以及未批准时不执行任何写入。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/desktop/windows-shortcut.test.ts`

预期：由于快捷方式服务不存在，测试失败。

- [ ] **步骤 3：实现目标校验和所有权 Manifest。**

只有 `.job-hunting-manifest.json` 明确记录的快捷方式才能被更新。使用 Windows 已知 Desktop 目录，不得写死用户名。

- [ ] **步骤 4：实现 Windows Shell 适配器。**

获得明确批准后才调用 Windows 快捷方式操作。图标使用自带 JH 图标，目标指向生成的 `index.html`。

- [ ] **步骤 5：运行测试。**

运行：`pnpm vitest run tests/desktop`

预期：全部通过。发布前必须在真实 Windows 环境进行一次人工验证。

---

## 任务 11：注册 DSH 插件、Runtime Skill 和工具

**文件：**

- 创建：`src/index.ts`
- 创建：`src/skill/job-hunting.skill.ts`
- 创建：`src/tools/resume-tools.ts`
- 创建：`src/tools/job-tools.ts`
- 创建：`src/tools/site-tools.ts`
- 创建：`src/tools/status-tool.ts`
- 创建：`dsh.bundle`
- 创建：`cordis.patch.yml`
- 测试：`tests/plugin-registration.test.ts`

**接口：**

- 插件导出：`{ Config, apply, inject, name }`。
- Runtime Skill 名称：`job-hunting`。
- 工具名称：`job_hunting_resume_parse`、`job_hunting_resume_assess`、`job_hunting_profile_update`、`job_hunting_import_jobs`、`job_hunting_collect_jobs`、`job_hunting_mark_interest`、`job_hunting_sync_interest`、`job_hunting_generate_report`、`job_hunting_build_site`、`job_hunting_open_site`、`job_hunting_status`。

- [ ] **步骤 1：先写注册失败测试。**

断言插件导出形态正确、Runtime Skill 已注册、工具名称完整，并且 BrowserSkill 和 schedule 默认关闭。

- [ ] **步骤 2：运行测试并确认失败。**

运行：`pnpm vitest run tests/plugin-registration.test.ts`

预期：由于注册模块不存在，测试失败。

- [ ] **步骤 3：实现最小 DSH 注册。**

使用当前已核验的 DSH API，在 `apply(ctx)` 中创建服务。通过依赖注入取得 Workspace、执行、配置和用户批准服务，不读取全局进程状态。

- [ ] **步骤 4：注册简洁的 Runtime Skill 描述。**

描述中必须说明个人简历评估、本地招聘岗位 JD 整理、匹配、静态网站生成、意向岗位池和已接入的 BrowserSkill 采集，并明确不自动投递、不绕过网站限制。

- [ ] **步骤 5：运行注册测试和类型检查。**

运行：`pnpm vitest run tests/plugin-registration.test.ts && pnpm typecheck`

预期：全部通过。

---

## 任务 12：完成文档、安全检查和发布验证

**文件：**

- 修改：`README.md`
- 修改：`SECURITY.md`
- 修改：`CONTRIBUTING.md`
- 创建：`docs/job-hunting-feasibility.md`
- 创建：`docs/browser-skill-integration.md`
- 创建：`docs/workspace-output.md`
- 创建：`docs/release-checklist.md`
- 创建：`.github/ISSUE_TEMPLATE/bug.yml`
- 创建：`.github/ISSUE_TEMPLATE/feature.yml`
- 测试：`tests/release/release-checks.test.ts`

- [ ] **步骤 1：先写发布检查失败测试。**

检查仓库是否包含 MIT、第三方声明、隐私边界、无真实简历样本、无疑似密钥，以及没有旧的 `JD 情报站` 品牌。

- [ ] **步骤 2：运行检查并确认缺文件时失败。**

运行：`pnpm vitest run tests/release/release-checks.test.ts`

预期：发布文件和扫描规则未完成前，测试失败。

- [ ] **步骤 3：补充支持范围和限制说明。**

README 必须说明：v0.1 支持本地岗位导入、DOCX/文字型 PDF 解析、不支持 OCR、网站使用内嵌数据、定时默认关闭、BrowserSkill 工具已直接接入、快捷方式需要批准。

- [ ] **步骤 4：增加依赖和密钥扫描。**

使用项目批准的许可证扫描工具和密钥扫描工具检查完整 Git 历史。依赖报告必须区分 MIT、BSD-3-Clause、Apache-2.0 及实际存在的其他许可证。

- [ ] **步骤 5：运行完整验证。**

运行：

```powershell
pnpm test
pnpm typecheck
pnpm build
```

在目标 Windows 环境进行人工验证：

1. DOCX 解析。
2. 文字型 PDF 解析。
3. 扫描版 PDF 明确拒绝。
4. 本地岗位导入和去重。
5. 双击打开静态 HTML。
6. JH 品牌正确，旧 JD 品牌消失。
7. BrowserSkill 状态、会话启动和停止流程。
8. 兴趣岗位导出和 Workspace 同步。
9. 快捷方式批准、创建和重复更新。
10. 没有 Workspace 时不写出用户数据。

- [ ] **步骤 6：进行干净环境打包验证。**

在临时目录构建可分发包，安装到隔离的 DSH Profile，重复冒烟测试。验证过程不能依赖开发目录中的未打包文件。

预期：测试全部通过，无密钥命中，许可证正确，包内没有用户数据和浏览器扩展二进制文件。

---

## 版本范围

### v0.1：本地岗位情报闭环

- 个人简历解析和评估。
- 已确认求职画像。
- 本地 JSON/Markdown 岗位导入。
- 岗位标准化、去重、匹配和报告。
- 本地静态 HTML 求职情报站。
- JH 品牌。
- 浏览器本地兴趣标记和 JSON 导出/同步。
- Workspace 输出。
- 经批准的 Windows 快捷方式。
- BrowserSkill 只读岗位采集、白名单、限速和人工协助。
- MIT 发布元数据。

### v0.2：BrowserSkill 增强

- `BrowserSkillAdapter` 的采集日志和状态增强。
- 用户授权站点的只读采集。
- 域名白名单和限速。
- 登录/验证码人工协作。
- 浏览器采集日志。
- 来源追踪。

### v0.3：本地自动化

- 可选 Windows Task Scheduler Runner。
- 本地岗位源定时更新。
- 受监督的 BrowserSkill 定时采集。
- 任务锁、日志、重试和过期岗位报告。

### 明确不做

- v0.1 OCR。
- 无人值守且有保证的后台抓取。
- 验证码或登录绕过。
- 自动投递岗位。
- 自动发送招聘消息。
- 发布用户简历或私人岗位数据。

---

## 自检结果

- 产品定位使用“招聘岗位 JD 归档与意向管理”，不再使用含义不清的“求职 JD 汇总”。
- 简历解析与评估有独立模块和确认状态。
- Workspace 输出与项目目录、Harness 运行目录隔离。
- `file://` 限制通过构建期内嵌数据处理。
- BrowserSkill 工具已直接接入，外部 CLI/扩展仍由宿主提供，并保持只读、白名单和人工协作边界。
- 后台定时默认关闭，不夸大平台能力。
- 兴趣标记区分浏览器临时状态和 Workspace 正式状态。
- Windows 快捷方式经过批准并支持幂等更新。
- MIT 许可证不覆盖第三方依赖、图片、字体和用户数据。
- OCR、任意网站抓取、自动投递和凭据提取均明确排除。
