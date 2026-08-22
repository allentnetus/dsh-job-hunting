# 在 DeepSeek Harness 中安装 Job Hunting

本插件针对 DeepSeek Harness（DSH）`0.1.0-rc.6` 的 `web` profile 验证。
安装入口是 DSH 自带的 `dsh plugin`，不是把文件复制到某个 `skills` 目录。

## 运行前提

- DeepSeek Harness `0.1.0-rc.6` 或经过兼容性验证的更高版本；
- Node.js `>=24.15.0`；
- pnpm `>=11.19.0`（当前 `dsh plugin` 会调用它；安装 DSH 本体不会自动安装 pnpm）；
- 已初始化或可初始化 `web` profile。

本插件的 `@deepseek-ai/dsh`、Cordis、工具、Skill 和 Workspace 包通过 peer
依赖声明为宿主提供的运行时，不会重新打包整个 DeepSeek Harness。

官方用 `npx.cmd @deepseek-ai/dsh@0.1.0-rc.6 web` 启动 DSH 时只要求 Node.js；安装本插件前还要让终端能找到
`pnpm`。Windows PowerShell 下直接使用 `.cmd` 入口，无需修改执行策略：

```powershell
npm.cmd install --global pnpm@11.19.0
pnpm.cmd --version
```

如果终端提示找不到 `dsh`，长期使用时全局安装已验证版本：

```powershell
npm.cmd install --global @deepseek-ai/dsh@0.1.0-rc.6
dsh.cmd --help
```

只需临时运行时，可以使用 npx：

```powershell
npx.cmd @deepseek-ai/dsh@0.1.0-rc.6 --help
```

首次运行 npx 可能会询问是否安装该包，输入 `y` 并按 Enter 即可。之后通常会复用 npm 缓存，
但仍需通过 `npx.cmd` 调用，不会创建永久的 `dsh` 命令。全局安装后如果仍找不到 `dsh.cmd`，
请重新打开 PowerShell；若仍未找到，可运行 `npm.cmd prefix -g`，确认输出目录已加入 PATH。

这里需要的是 pnpm 命令，不是让远程用户在本插件目录执行 `pnpm install`；`dsh.cmd plugin` 会在
使用者自己的 profile 目录中安装插件及其运行依赖。

## 安装

### 从 npm 安装

当 `dsh-job-hunting` 已发布到 npm 时：

```powershell
dsh.cmd plugin --profile web add dsh-job-hunting
```

### 从 GitHub 安装

```powershell
dsh.cmd plugin --profile web add "https://codeload.github.com/allentnetus/dsh-job-hunting/tar.gz/refs/tags/v0.1.3"
```

这里使用 GitHub tag tarball URL，不调用 Git `ls-remote`，不依赖本机 GitHub SSH host key，
也不受 Git for Windows Schannel 握手问题影响。不要改成 `github:` 简写。

GitHub 仓库根目录必须包含 `package.json`、`dsh.bundle` 字段和
`cordis.patch.yml`。DSH 会在安装后把声明了 `dsh.bundle` 的依赖加入
`dsh.profile.bundles`，不需要手动复制补丁。

### 从本地源码安装

在插件仓库中先构建：

```powershell
$pluginSourcePath = 'D:\path\to\dsh-job-hunting'
Set-Location $pluginSourcePath
pnpm.cmd install
pnpm.cmd build
```

再从任意目录执行：

```powershell
dsh.cmd plugin --profile web add $pluginSourcePath
```

如果当前 Windows 环境没有把 `dsh.cmd` 加入 PATH，可以使用 `npx.cmd` 调用同一入口：

```powershell
npx.cmd @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add $pluginSourcePath
```

## 验证与重启

查看 profile 依赖和 bundle：

```powershell
dsh.cmd plugin --profile web list
dsh.cmd --profile web --dump-config | Select-String 'job-hunting|dsh-job-hunting'
```

验证成功后重启当前 `dsh.cmd web`/桌面 Harness。插件注册的 Runtime Skill 名称是
`job-hunting`，工具名称以 `job_hunting_` 开头。

## 可选启用 DSH 原生 Schedule

默认安装不会启用 DSH 原生 Schedule。仓库根目录的
[`dsh-schedule.cordis.yml`](../dsh-schedule.cordis.yml) 是独立的宿主层 overlay，不会写入默认
`cordis.patch.yml`，也不会包含在 npm 发布包中。需要使用时，先将 overlay 文件放在使用者可读的
位置，再在启动会话时显式应用。可以用当前版本的固定 URL 下载 overlay：

```powershell
$overlayPath = Join-Path (Get-Location) 'dsh-schedule.cordis.yml'
Invoke-WebRequest `
  -Uri 'https://raw.githubusercontent.com/allentnetus/dsh-job-hunting/v0.1.3/dsh-schedule.cordis.yml' `
  -OutFile $overlayPath
dsh.cmd web --patch $overlayPath
```

如果使用的 profile 不是 `web`，将命令中的 `web` 替换为实际 profile 名称。该 overlay 加载
`@deepseek-ai/dsh-time-context` 和 `@deepseek-ai/dsh-schedule`；它只对本次 DSH 会话生效，
新会话需要再次应用 patch。然后在同一会话中创建提醒，例如：

```text
每天 09:00 提醒我检查新增 JD；提醒时先让我确认白名单 URL 和只读采集范围。
```

Schedule 到期后只是提醒，不是岗位采集授权。用户必须确认本轮具体 URL 和只读范围，之后才可以
调用 `job_hunting_collect_browser_jobs`；采集成功后再生成当天报告。提醒内容不具备绕过登录、
CAPTCHA、限流或其他网站限制的权限。没有应用 overlay 时，插件不会自行创建每日调度任务。

## 配置 Tencent/BrowserSkill

[Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 项目提供的 BrowserSkill CLI（`bsk`）
和浏览器扩展是外部前置条件，不会由本插件安装。
插件默认启用只读浏览器工具，并默认允许以下精确主机名：

```text
www.51job.com
www.zhipin.com
www.liepin.com
www.zhaopin.com
www.iguopin.com
```

首次配置 BrowserSkill 时，先按照其项目说明安装 CLI 和浏览器扩展，再在同一终端执行：

```powershell
bsk --help
bsk status
```

只有 `bsk status` 能看到可用会话后，才继续在 DSH 对话中确认白名单 URL 和只读采集范围。

在 DSH profile 中追加站点，编辑：

```text
%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml
```

写入：

```yaml
- id: job-hunting
  name: dsh-job-hunting
  config:
    browserSkill:
      additionalAllowedDomains:
        - www.example-job-site.com
```

修改 profile 补丁后重启 Harness。`additionalAllowedDomains` 会追加到默认的五个主机名；
如果显式提供 `allowedDomains`，它会替换默认列表。每次采集仍要求工具调用传入
`confirmed: true`，并且只读、限量、限速。

## 使用方式

安装完成后不需要运行单独的 `job-hunting` 命令，直接在 Harness 对话中使用：

- “解析我当前 Workspace 中的简历。”
- “根据已确认求职画像匹配岗位。”
- “查看当前求职状态。”
- “生成岗位分析报告。”
- “我确认，只读采集以下白名单招聘网站中的岗位：……”。

没有 `bsk`、没有活跃 Workspace、URL 不在白名单或网站需要登录/CAPTCHA 时，工具会返回
不可用或需要人工协助，不会切换到未经审查的采集路径。

## 更新、卸载与问题排查

### 手动更新（推荐）

插件版本、用户求职画像和岗位数据是三套独立内容。更新插件只替换代码、模板和
`cordis.patch.yml`，不会用新包覆盖 Workspace 中的 `profile/profile.json`、岗位数据、收藏或备注。

先查看 profile 中可更新的依赖，再明确执行更新：

```powershell
dsh.cmd plugin --profile web outdated
dsh.cmd plugin --profile web update dsh-job-hunting
dsh.cmd --profile web --dump-config | Select-String 'dsh-job-hunting|job-hunting'
```

更新完成后重启 DSH。`dsh plugin` 会把更新交给 profile 内的 pnpm，并重新核对
`dsh.profile.bundles`；它不会在当前已经运行的 Node 进程中热替换插件。
旧版 `profile/profile.json` 第一次被新插件读取时只会补充 schema 标记，并保留
`profile/profile.json.pre-schema-<version>.bak`，不会覆盖用户已经确认的城市、行业、分类共享规则、收藏或备注。

如果需要回到上一版本，优先恢复更新前的 profile `package.json` 和 `pnpm-lock.yaml`，再执行：

```powershell
dsh.cmd plugin --profile web install --frozen-lockfile
```

如果使用 npm 发布渠道，也可以明确安装一个已验证的版本：

```powershell
dsh.cmd plugin --profile web add dsh-job-hunting@0.1.3
```

### GitHub 源码安装的构建授权

从 GitHub 源码安装时，pnpm 可能会阻止 `prepare` 构建脚本。只对确认可信的包在使用者自己的
profile 中授权：

```yaml
allowBuilds:
  dsh-job-hunting: true
```

日常稳定更新更建议使用 npm 预构建包；GitHub tag 或 commit 适合审查源码和回滚。发布新版本时，
只在代码、模板或插件契约发生对外变化后递增版本号，不要把每天的岗位采集数据更新做成插件版本。

```powershell
dsh.cmd plugin --profile web remove dsh-job-hunting
dsh.cmd --profile web --dump-config
```

如果插件没有出现在配置树中，先确认依赖安装在 `web` profile，并检查包的
`package.json` 中是否存在：

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

若浏览器采集不可用，单独运行 `bsk status` 检查外部 BrowserSkill；这不影响本插件的本地
岗位导入、简历解析、匹配、报告和网站构建功能。
