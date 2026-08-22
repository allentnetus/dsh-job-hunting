# Job Hunting DSH 插件

<p align="center">
  <img src="assets/social-preview.png" alt="Job Hunting 插件预览图" width="960">
</p>

`dsh-job-hunting` 是一个本地优先的 DeepSeek Harness 插件和 Runtime Skill，
用于整理招聘岗位、确认求职画像，以及维护意向岗位。v0.1 包的自有代码和模板
采用 MIT 许可证；第三方依赖仍保留各自许可证。

## v0.1 支持范围

- 导入本地 JSON 或本地 Markdown 岗位文件，并完成标准化、去重、匹配和报告生成。
- 解析 DOCX、文字型 PDF、TXT 和 Markdown 简历。扫描版或加密 PDF 会明确拒绝，
  v0.1 不使用 OCR。
- 构建 JH / 求职情报站 / Job Hunting 静态网站。数据在构建阶段内嵌，因此生成的
  `index.html` 可以直接通过 `file://` 打开。
- 浏览器中的岗位标记只保存在当前浏览器的临时状态中；用户可导出后，再同步到
  活跃 Workspace 的正式兴趣台账。详见[Workspace 输出说明](./docs/workspace-output.md)。
- 提供一个供宿主或手工集成调用的模块级 Windows 快捷方式服务。它不会自动创建快捷方式；
  如果宿主尚未集成，该快捷方式用户入口尚未提供。

用户简历、已确认画像、兴趣数据、报告和生成的网站只能写入宿主选定的活跃 Workspace。
插件不会使用固定的个人数据目录。

## 在 DeepSeek Harness 中安装

本插件针对 DeepSeek Harness `0.1.0-rc.6` 的 `web` profile 验证。完整的 npm、GitHub、
本地源码安装、验证、卸载和 DSH profile 配置方式见[安装指南](./docs/dsh-installation.md)。

### 安装前提

安装 DSH 本体和安装插件是两件事。[官方 npm 启动方式](https://github.com/deepseek-ai/deepseek-harness#run)
使用 Node.js 和 `npx`，不会自动安装 pnpm；当前 DSH 的 `dsh plugin` 命令会调用 pnpm 管理
profile 依赖。使用者需要准备：

- DeepSeek Harness `0.1.0-rc.6`，或经过兼容性验证的更高版本；
- Node.js `>=24.15.0`；
- pnpm `>=11.19.0`；
- 已初始化或可初始化目标 profile（以下以 `web` 为例）。

先确认终端可以找到这些命令：

```powershell
node --version
pnpm.cmd --version
dsh.cmd --help
```

如果 `pnpm` 不存在，单独安装它即可；不需要在本插件目录执行 `pnpm install`：

```powershell
npm.cmd install --global pnpm@11.19.0
```

#### Windows PowerShell 执行策略问题

如果 Windows PowerShell 提示“无法加载文件 `npm.ps1`，因为在此系统上禁止运行脚本”，这是
PowerShell 的执行策略阻止了 npm 的 PowerShell 入口，不是 pnpm 安装包本身的问题。可以改用
`.cmd` 入口安装和验证，无需修改执行策略：

```powershell
npm.cmd install --global pnpm@11.19.0
pnpm.cmd --version
```

验证命令输出 `11.19.0` 即表示安装成功。之后在同一 PowerShell 环境中运行 pnpm 命令时，
继续使用 `pnpm.cmd` 即可，无需修改执行策略。安装过程中若出现 `electron_mirror` 的未知配置
警告，通常不影响 pnpm 安装。

以下说明面向其他使用者。使用者不需要克隆本仓库、不需要手动复制 `cordis.patch.yml`，
也不需要使用维护者电脑上的本地路径。

### 从 GitHub 安装

```powershell
dsh.cmd --help
dsh.cmd plugin --profile web add "https://codeload.github.com/allentnetus/dsh-job-hunting/tar.gz/refs/tags/v0.1.3"
```

这里使用 GitHub tag tarball URL，不调用 Git `ls-remote`，不依赖本机 GitHub SSH host key，
也不受 Git for Windows Schannel 握手问题影响。不要改成 `github:` 简写。

如需固定到不可变提交，请使用 GitHub tag `v0.1.3` 指向的完整 commit SHA（可在 tag 页面或提交历史中查看）；
日常安装直接使用上面的版本标签即可。

`web` 是示例 profile 名称；如果使用者使用的是 `demo` 或其他 profile，将命令中的 `web`
替换为自己的 profile 名称。

安装后验证：

```powershell
dsh.cmd plugin --profile web list
dsh.cmd --profile web --dump-config | Select-String 'dsh-job-hunting|job-hunting'
```

验证成功后重启 `dsh.cmd web` 或桌面 Harness。插件会自动注册 `job-hunting` Runtime Skill 和
`job_hunting_` 工具。GitHub 的 `dsh-plugin` 主题仅用于分类和发现，不会自动安装插件。

### 后续版本更新

插件代码使用版本号发布；岗位采集数据、用户求职画像、城市/行业分类、收藏和备注保存在
Workspace 中，独立于插件版本。更新时先检查，再明确执行：

```powershell
dsh.cmd plugin --profile web outdated
dsh.cmd plugin --profile web update dsh-job-hunting
dsh.cmd --profile web --dump-config | Select-String 'dsh-job-hunting|job-hunting'
```

更新后重启 Harness。默认不执行静默自动升级；如果更新需要回滚，恢复 profile 的
`package.json` 与 `pnpm-lock.yaml` 后执行 `dsh.cmd plugin --profile web install --frozen-lockfile`。
旧版 profile 第一次被新插件读取时会自动补充 schema 标记，并保留
`profile/profile.json.pre-schema-<version>.bak`，不会覆盖用户已确认的分类决策。

如果终端提示“`dsh` 不是内部或外部命令”，说明使用者自己的 DSH CLI 尚未安装或未加入 PATH，
不是本插件安装失败。Windows PowerShell 下可以选择以下方式，均不需要修改执行策略：

长期使用（推荐）时，全局安装已验证版本：

```powershell
npm.cmd install --global @deepseek-ai/dsh@0.1.0-rc.6
dsh.cmd --help
```

只需临时运行时，使用 npx：

```powershell
npx.cmd @deepseek-ai/dsh@0.1.0-rc.6 --help
```

首次运行 npx 可能会询问是否安装该包，输入 `y` 并按 Enter 即可。之后通常会复用 npm 缓存，
但仍需通过 `npx.cmd` 调用，不会创建永久的 `dsh` 命令。全局安装后如果仍找不到 `dsh.cmd`，
请重新打开 PowerShell；若仍未找到，可运行 `npm.cmd prefix -g`，确认输出目录已加入 PATH。

如果 pnpm 提示 Git 依赖的构建脚本需要审批，请在使用者自己的 DSH profile 的
`pnpm-workspace.yaml` 中允许本包后重新执行安装：

```yaml
allowBuilds:
  dsh-job-hunting: true
```

## Tencent/BrowserSkill 集成

插件会直接注册并默认启用 `job_hunting_collect_browser_jobs` 工具。它使用
[Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 项目提供的 BrowserSkill CLI
（`bsk`）和浏览器扩展；这些是外部运行前置条件，不是 npm 依赖，也不会随本包安装或发布。
默认已包含 51job、BOSS 直聘、猎聘、智联招聘和国聘的精确主机名；宿主可以覆盖默认列表或追加其他站点：

```json
{
  "browserSkill": {
    "enabled": true,
    "executable": "bsk",
    "mode": "read-only",
    "allowedDomains": [
      "www.51job.com",
      "www.zhipin.com",
      "www.liepin.com",
      "www.zhaopin.com",
      "www.iguopin.com"
    ],
    "additionalAllowedDomains": [],
    "requireUserApproval": true,
    "maxItemsPerRun": 50,
    "minIntervalMs": 1000
  }
}
```

默认白名单包含前程无忧、BOSS 直聘、猎聘、智联招聘和国聘的上述主机名。其他网站可追加到
`additionalAllowedDomains`，例如 `"additionalAllowedDomains": ["www.example-job-site.com"]`；
工具只读取白名单站点中可见的结构化岗位，受 `maxItemsPerRun` 数量上限和 URL 导航之间的
`minIntervalMs` 时间间隔限制，并要求工具调用传入 `confirmed: true`。找不到 `bsk`、白名单
为空或需要登录/CAPTCHA 时，会报告不可用或需要人工协助。

首次使用浏览器采集前，请按照 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill)
的说明安装 CLI 和浏览器扩展，然后在同一终端检查：

```powershell
bsk --help
bsk status
```

`bsk status` 能看到可用会话后，再在 DSH 对话中确认具体白名单 URL 和只读范围。

采集结束后会停止 BrowserSkill 会话，不会提取凭证、提交申请、发送招聘消息，也不会绕过认证
或 CAPTCHA 控制。详见[BrowserSkill 集成说明](./docs/browser-skill-integration.md)。

## 定时行为

插件配置中的 `schedule.enabled` 默认是 `false`；它不会创建独立的后台调度器。需要使用 DSH
原生 Schedule 时，必须在启动会话时显式应用可选的宿主层 overlay：

```powershell
$overlayPath = Join-Path (Get-Location) 'dsh-schedule.cordis.yml'
Invoke-WebRequest `
  -Uri 'https://raw.githubusercontent.com/allentnetus/dsh-job-hunting/v0.1.3/dsh-schedule.cordis.yml' `
  -OutFile $overlayPath
dsh.cmd web --patch $overlayPath
```

仓库根目录的 [dsh-schedule.cordis.yml](./dsh-schedule.cordis.yml) 只加载
`@deepseek-ai/dsh-time-context` 和 `@deepseek-ai/dsh-schedule`。它不会写入默认的
`cordis.patch.yml`，也不会随 npm 包发布；上面的版本固定 URL 可供 GitHub 安装用户直接取得，
从 npm 安装的使用者也需要单独下载该 overlay，或在自己的 DSH profile patch 中写入同等配置。

DSH 原生 Schedule 只对当前会话有效；新会话需要再次使用 `--patch`，并重新创建提醒。它的职责
是到时间提醒，不是 Windows Cron、可靠的后台任务或无人值守爬虫。提醒到期后，提醒本身不构成
采集授权：必须由用户确认本轮具体白名单 URL 和只读范围，之后才能调用
`job_hunting_collect_browser_jobs`，采集成功后再生成当天报告。登录、CAPTCHA、限流或其他
网站限制仍需要人工处理。详见[DSH 安装与 Schedule 说明](./docs/dsh-installation.md)和
[BrowserSkill 集成说明](./docs/browser-skill-integration.md)。

## 入口与命令

- DSH 插件入口点为 `./dist/src/index.js`。
- Runtime Skill 入口点为 `./dist/src/skill/job-hunting.skill.js`。

```powershell
pnpm.cmd install
pnpm.cmd test              # 运行 Vitest 前会先清理并构建
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd lint
pnpm.cmd dsh:smoke
pnpm.cmd release:check
```

`pnpm test` 和 `pnpm release:check` 都会先清理并构建 `dist`，再运行 Vitest 检查；
`pnpm build` 也会先移除旧的 `dist`。这些命令不会发布包，也不会全局安装任何内容。
完整 Git 历史密钥扫描仍是外部发布前置条件，不由当前本地检查执行。详见[发布清单](./docs/release-checklist.md)。
