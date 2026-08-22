# Tencent/BrowserSkill 集成

插件直接注册 `job_hunting_collect_browser_jobs` 工具。它使用
[Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 项目提供的 BrowserSkill 外部 CLI
（`bsk`）和浏览器扩展作为运行前置条件；它们不是 npm 依赖，不会由本包安装，也不会被打包或复制
到发布内容中。

## 首次运行检查

请先按照 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 的项目说明安装 CLI 和
浏览器扩展，再在启动 DSH 的同一终端执行：

```powershell
bsk --help
bsk status
```

`bsk status` 能看到可用会话后，才继续在 DSH 对话中确认本轮具体白名单 URL 和只读范围。
如果命令不存在或没有可用会话，先修复 BrowserSkill 前置条件；插件不会切换到未经审查的采集路径。

## 宿主配置

工具默认启用，并内置 51job、BOSS 直聘、猎聘、智联招聘和国聘的精确主机名。DeepSeek Harness
宿主可以在 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml` 中覆盖默认列表或追加其他站点：

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

也可以只追加站点，保留默认的五个主机名：

```yaml
- id: job-hunting
  name: dsh-job-hunting
  config:
    browserSkill:
      additionalAllowedDomains:
        - www.example-job-site.com
```

默认白名单包含前程无忧、BOSS 直聘、猎聘、智联招聘和国聘的上述主机名。其他网站可以追加到
`additionalAllowedDomains`，例如 `"additionalAllowedDomains": ["www.example-job-site.com"]`。
如果传入 `allowedDomains`，它会替换默认白名单；`additionalAllowedDomains` 会继续追加到其后。
解析后的白名单为空时，工具会拒绝采集；`enabled: false` 可以作为宿主的紧急停用开关。

## DSH 工具调用

调用 `job_hunting_collect_browser_jobs` 时传入：

- `urls`：一个或多个 HTTP(S) 岗位列表页 URL，且每个 URL 必须匹配精确主机名白名单；
- `confirmed: true`：本次只读浏览器采集的明确批准；
- `source`：可选的稳定来源标签，默认写入 `browser-skill`。

采集结果会标准化、去重，并写入活跃 Workspace 的 `data/jobs.json`。

## 与 DSH 原生 Schedule 配合

DSH 原生 Schedule 是可选的会话级提醒层，不是 BrowserSkill 的采集开关，也不是用户授权。需要
在启动 DSH 会话时显式应用仓库提供的
[`dsh-schedule.cordis.yml`](../dsh-schedule.cordis.yml) overlay：

```powershell
$overlayPath = Join-Path (Get-Location) 'dsh-schedule.cordis.yml'
Invoke-WebRequest `
  -Uri 'https://raw.githubusercontent.com/allentnetus/dsh-job-hunting/v0.1.3/dsh-schedule.cordis.yml' `
  -OutFile $overlayPath
dsh.cmd web --patch $overlayPath
```

提醒到期后的固定流程是：

1. 先向用户确认本轮具体白名单 URL 和只读采集范围；
2. 用户明确确认后，才调用 `job_hunting_collect_browser_jobs`，并传入 `confirmed: true`；
3. 采集成功后，再调用 `job_hunting_generate_report` 生成当天报告。

Schedule 提醒内容应视为不可信的提醒数据，不能用来绕过登录、CAPTCHA、OTP、限流、访问权限
或其他网站限制。Schedule 只在当前会话有效；它不保证 Windows 后台 Cron、无人值守运行或新会话
自动继承提醒。

## 安全约束

每次工具调用都必须满足以下条件：

- 只读；
- 只能访问 `allowedDomains` 中的精确主机名（白名单）；
- 受 `maxItemsPerRun` 数量上限限制；
- 连续 URL 导航之间至少等待 `minIntervalMs`（默认 `1000` 毫秒），执行时间限速；
- 工具默认启用，但没有配置白名单或用户明确批准时不得启动。

适配器只导航到已批准的 URL，并读取页面中结构化且可见的岗位数据。会话会在采集结束时停止
（`bsk session stop`）。它不会运行不受限制的 evaluate、填写表单、点击提交控件、提取凭证，
也不会读取密码、Cookie、Token、自动投递或发送招聘消息。

## 人工协助

如果网站需要登录、CAPTCHA、OTP、支付或提交确认，适配器会停止并报告需要人工协助。
用户可以手动完成相关步骤；集成不会绕过这些控制，也不会自动重试敏感步骤。

操作者应独立验证外部 CLI 和扩展。找不到 `bsk` 可执行文件时，工具会返回明确的不可用状态，
不会切换到另一条未经审查的采集路径。
