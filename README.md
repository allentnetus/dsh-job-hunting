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

本插件针对 DeepSeek Harness `0.1.0-rc.6` 的 `web` profile 验证。完整的 npm、GitHub、
本地源码安装、验证、卸载和 DSH profile 配置方式见[安装指南](./docs/dsh-installation.md)。

从 GitHub 安装：

```powershell
dsh plugin --profile web add github:allentnetus/dsh-job-hunting
```

安装后重启 `dsh web` 或桌面 Harness；插件会自动注册 `job-hunting` Runtime Skill 和
`job_hunting_` 工具，不需要手动复制 `cordis.patch.yml`。

## BrowserSkill 集成

插件会直接注册并默认启用 `job_hunting_collect_browser_jobs` 工具。BrowserSkill CLI
（`bsk`）和浏览器扩展是外部运行前置条件，不是 npm 依赖，也不会随本包安装或发布。
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

## 入口与命令

- DSH 插件入口点为 `./dist/src/index.js`。
- Runtime Skill 入口点为 `./dist/src/skill/job-hunting.skill.js`。

```powershell
pnpm install
pnpm test              # 运行 Vitest 前会先清理并构建
pnpm typecheck
pnpm build
pnpm lint
pnpm dsh:smoke
pnpm release:check
```

`pnpm test` 和 `pnpm release:check` 都会先清理并构建 `dist`，再运行 Vitest 检查；
`pnpm build` 也会先移除旧的 `dist`。这些命令不会发布包，也不会全局安装任何内容。
完整 Git 历史密钥扫描仍是外部发布前置条件，不由当前本地检查执行。详见[发布清单](./docs/release-checklist.md)。
