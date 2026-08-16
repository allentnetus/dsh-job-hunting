# 在 DeepSeek Harness 中安装 Job Hunting

本插件针对 DeepSeek Harness（DSH）`0.1.0-rc.6` 的 `web` profile 验证。
安装入口是 DSH 自带的 `dsh plugin`，不是把文件复制到某个 `skills` 目录。

## 运行前提

- DeepSeek Harness `0.1.0-rc.6` 或经过兼容性验证的更高版本；
- Node.js `>=24.15.0`；
- pnpm `>=11.19.0`；
- 已初始化或可初始化 `web` profile。

本插件的 `@deepseek-ai/dsh`、Cordis、工具、Skill 和 Workspace 包通过 peer
依赖声明为宿主提供的运行时，不会重新打包整个 DeepSeek Harness。

## 安装

### 从 npm 安装

当 `dsh-job-hunting` 已发布到 npm 时：

```powershell
dsh plugin --profile web add dsh-job-hunting
```

### 从 GitHub 安装

```powershell
dsh plugin --profile web add github:allentnetus/dsh-job-hunting
```

GitHub 仓库根目录必须包含 `package.json`、`dsh.bundle` 字段和
`cordis.patch.yml`。DSH 会在安装后把声明了 `dsh.bundle` 的依赖加入
`dsh.profile.bundles`，不需要手动复制补丁。

### 从本地源码安装

在插件仓库中先构建：

```powershell
Set-Location 'G:\发布\Job Hunting Skill'
pnpm install
pnpm build
```

再从任意目录执行：

```powershell
dsh plugin --profile web add 'G:\发布\Job Hunting Skill'
```

如果当前 Windows 环境没有把 `dsh` 加入 PATH，可以调用 Harness 自带的入口：

```powershell
$DshBin = 'C:\Users\mrvic\.dsh\profiles\node_modules\@deepseek-ai\dsh\lib\bin.js'
node $DshBin plugin --profile web add 'G:\发布\Job Hunting Skill'
```

## 验证与重启

查看 profile 依赖和 bundle：

```powershell
dsh plugin --profile web list
dsh --profile web --dump-config | Select-String 'job-hunting|dsh-job-hunting'
```

验证成功后重启当前 `dsh web`/桌面 Harness。插件注册的 Runtime Skill 名称是
`job-hunting`，工具名称以 `job_hunting_` 开头。

## 配置 BrowserSkill

BrowserSkill CLI（`bsk`）和浏览器扩展是外部前置条件，不会由本插件安装。
插件默认启用只读浏览器工具，并默认允许以下精确主机名：

```text
www.51job.com
www.zhipin.com
www.liepin.com
www.zhaopin.com
www.iguopin.com
```

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

```powershell
dsh plugin --profile web update dsh-job-hunting
dsh plugin --profile web remove dsh-job-hunting
dsh --profile web --dump-config
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

