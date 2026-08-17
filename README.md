# Job Hunting DSH 插件

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

本插件针对 DeepSeek Harness `0.1.0-rc.6` 的 `web` profile 验证。完整的 npm、GitHub 安装、
验证、卸载和 DSH profile 配置方式见[安装指南](./docs/dsh-installation.md)。

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
pnpm --version
dsh --help
```

如果 `pnpm` 不存在，单独安装它即可；不需要在本插件目录执行 `pnpm install`：

```powershell
npm install --global pnpm@11.19.0
```

以下说明面向其他使用者。使用者不需要克隆本仓库、不需要手动复制 `cordis.patch.yml`，
也不需要使用维护者电脑上的本地路径。

### 从 GitHub 安装

```powershell
dsh --help
dsh plugin --profile web add 'github:allentnetus/dsh-job-hunting#v0.1.2'
```

如需固定到不可变提交，请使用 GitHub Release `v0.1.2` 页面显示的完整 commit SHA；日常安装直接使用
上面的版本标签即可。

`web` 是示例 profile 名称；如果使用者使用的是 `demo` 或其他 profile，将命令中的 `web`
替换为自己的 profile 名称。

安装后验证：

```powershell
dsh plugin --profile web list
dsh --profile web --dump-config | Select-String 'dsh-job-hunting|job-hunting'
```

验证成功后重启 `dsh web` 或桌面 Harness。插件会自动注册 `job-hunting` Runtime Skill 和
`job_hunting_` 工具。GitHub 的 `dsh-plugin` 主题仅用于分类和发现，不会自动安装插件。

如果终端提示“`dsh` 不是内部或外部命令”，这是使用者自己的 DSH CLI 未安装或未加入 PATH，
不是本插件安装失败；可以先用 `npx @deepseek-ai/dsh` 启动或执行插件命令，或者将自己的
DeepSeek Harness CLI 加入 PATH，不要使用维护者的本机路径。

远程使用者不需要克隆本仓库、在本插件目录执行 `pnpm install`，也不需要复制维护者电脑中的
`node_modules`。本交付目录已经包含构建后的运行入口；DeepSeek Harness 会在自己的 profile 中
安装本插件声明的运行依赖。

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

采集结束后会停止 BrowserSkill 会话，不会提取凭证、提交申请、发送招聘消息，也不会绕过认证
或 CAPTCHA 控制。详见[BrowserSkill 集成说明](./docs/browser-skill-integration.md)。

## 定时行为

`schedule.enabled` 默认是 `false`。当前支持的模式是 `session-reminder`：它只会在活跃的
DSH 会话中提醒用户，不承诺可靠的后台 Cron，也不会作为无人值守爬虫运行。

## 运行入口

- DSH 插件入口点为 `./dist/src/index.js`。
- Runtime Skill 入口点为 `./dist/src/skill/job-hunting.skill.js`。

开发、测试和构建流程不属于远程用户的安装步骤，保留在维护者的独立开发工作区中。
