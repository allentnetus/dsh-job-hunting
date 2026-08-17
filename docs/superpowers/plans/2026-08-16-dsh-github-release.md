# DeepSeek Harness GitHub 发布就绪实施计划

> **面向执行代理：** 使用 superpowers:executing-plans 按任务逐项执行。每个步骤使用复选框跟踪完成状态。

**目标：** 让其他 DeepSeek Harness 用户能够从公开 GitHub 仓库安装和复用 dsh-job-hunting，并具备真实的 profile 冒烟测试、DSH 专用配置说明、CI 检查和明确的发布门槛。

**架构：** 保留现有 DSH bundle 链路（package.json → dsh.bundle → cordis.patch.yml），增加一个隔离冒烟运行器：先打包当前项目，再通过内置 DSH CLI 把 tarball 安装到临时 web profile，验证 profile 清单和配置树，最后短暂启动 web profile。用户配置仍放在 profile 的 cordis.patch.yml 中；不会把用户数据或 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 二进制加入发布包。

**技术栈：** Node.js 24+、pnpm 11.19+、TypeScript、Vitest、DeepSeek Harness 0.1.0-rc.6、GitHub Actions、Gitleaks Action v2。

## 全局约束

- 目标运行时是 DeepSeek Harness 0.1.0-rc.6；本版本只对 web profile 做冒烟验证。
- BrowserSkill 仍是外部 bsk 可执行程序；本包不得安装、打包或绕过它。
- 浏览器采集必须保持只读、精确主机名白名单、限量、限速并经过明确批准。
- 用户数据必须写入活跃 DSH Workspace；不得引入固定路径或仓库本地数据目录。
- 不得隐式删除或暂存现有未提交用户改动和 .superpowers/sdd 文件。
- 当前包元数据预设 GitHub 仓库为 https://github.com/allentnetus/dsh-job-hunting；公开发布前必须核对该仓库实际存在且地址正确。
- 每项新的运行时行为必须先写失败测试再实现；文档和配置改动使用发布检查验证。

---

### 任务 1：增加 DSH 发布契约的失败检查

**文件：**

- 修改：tests/release/release-checks.test.ts
- 修改：tests/project-metadata.test.ts

**产出：** 对 DSH 安装文档、profile 补丁示例、冒烟脚本、CI、更新记录、安全报告流程、忽略规则和包元数据增加可执行检查。

- [x] 步骤 1：先写失败断言

要求存在：

~~~text
docs/dsh-installation.md
scripts/dsh-profile-smoke.mjs
.github/workflows/ci.yml
CHANGELOG.md
~~~

要求 package.json 包含：

~~~json
{
  "scripts": {
    "dsh:smoke": "node scripts/dsh-profile-smoke.mjs"
  }
}
~~~

要求安装文档包含 dsh plugin --profile web add、cordis.patch.yml、job-hunting、dsh --profile web --dump-config 和 BrowserSkill profile 补丁示例。要求 CI 包含 fetch-depth: 0、pnpm dsh:smoke 和 gitleaks/gitleaks-action@v2。

- [x] 步骤 2：运行定向发布测试确认 RED

~~~powershell
pnpm exec vitest run tests/release/release-checks.test.ts tests/project-metadata.test.ts
~~~

预期：由于新文档、脚本、工作流、元数据和检查尚未实现而失败。

### 任务 2：补齐 DSH 安装和 profile 配置文档

**文件：**

- 新建：docs/dsh-installation.md
- 修改：README.md
- 修改：docs/browser-skill-integration.md
- 修改：SECURITY.md

**产出：** 可复制的安装、更新、卸载、验证、重启、故障排查和 profile cordis.patch.yml 配置说明。

- [x] 步骤 1：增加 DSH 安装指南

说明 npm、GitHub 和本地源码安装：

~~~powershell
dsh plugin --profile web add dsh-job-hunting
dsh plugin --profile web add github:allentnetus/dsh-job-hunting
dsh plugin --profile web add 'G:\发布\Job Hunting Skill'
~~~

说明 DSH 基线版本 0.1.0-rc.6、Node >=24.15、pnpm >=11.19 和已验证的 web profile。

- [x] 步骤 2：说明精确的 DSH profile 覆盖方式

加入以下可工作的配置示例：

~~~yaml
- id: job-hunting
  name: dsh-job-hunting
  config:
    browserSkill:
      additionalAllowedDomains:
        - www.example-job-site.com
~~~

说明文件位置为 %USERPROFILE%\.dsh\profiles\web\cordis.patch.yml；包默认已经包含五个招聘网站主机名；没有 bsk 时只会使浏览器采集不可用，不会启用其他未经审查的爬取路径。

- [x] 步骤 3：从 README 和安全文档链接安装指南

在 README.md 增加显眼的安装入口；在 Tencent/BrowserSkill 文档中链接 DSH 配置说明；在 SECURITY.md 说明公开仓库启用 GitHub Security → Report a vulnerability 后的私密报告流程。

### 任务 3：实现隔离 DSH profile 冒烟运行器

**文件：**

- 新建：scripts/dsh-profile-smoke.mjs
- 修改：package.json
- 修改：tests/release/release-checks.test.ts

**产出：** pnpm dsh:smoke 把当前项目打成 tarball，使用 dsh plugin --profile web add 安装到临时 DSH Home，验证 profile 依赖、bundle、配置树，然后短暂启动 web profile 并终止。

- [x] 步骤 1：先加入冒烟命令契约

加入：

~~~json
"dsh:smoke": "node scripts/dsh-profile-smoke.mjs"
~~~

把 release:check 更新为在发布测试后、pnpm pack --dry-run 前运行 pnpm dsh:smoke。

- [x] 步骤 2：实现前运行冒烟命令确认 RED

~~~powershell
pnpm dsh:smoke
~~~

预期：因脚本不存在而失败。

- [x] 步骤 3：实现冒烟运行器

运行器必须：

1. 从 DSH_BIN 或 node_modules/@deepseek-ai/dsh/lib/bin.js 解析 DSH 入口。
2. 在系统临时目录创建隔离目录。
3. 从仓库根目录运行 pnpm pack --pack-destination <临时打包目录>。
4. 设置临时 DSH_HOME，使用生成的 .tgz 执行 DSH 插件安装，不能直接安装源码目录。
5. 断言 profiles/web/package.json 有 dsh-job-hunting 依赖，且 dsh.profile.bundles 包含 dsh-job-hunting。
6. 执行 dsh --profile web --dump-config，断言配置树包含 job-hunting 和 dsh-job-hunting。
7. 执行 dsh --profile web --port 0，等待 dsh web: http://127.0.0.1:<port>，然后终止进程；超时或提前退出必须失败。
8. 在 finally 中删除本次创建的临时目录，同时保留原始错误和输出。

### 任务 4：增加 CI、安全扫描和发布卫生规则

**文件：**

- 新建：.github/workflows/ci.yml
- 新建：CHANGELOG.md
- 修改：.gitignore
- 修改：docs/release-checklist.md
- 修改：CONTRIBUTING.md
- 修改：THIRD-PARTY-NOTICES.md

**产出：** 可复现的 GitHub 检查、完整历史密钥扫描、明确的发布命令以及本地密钥和构建产物保护规则。

- [x] 步骤 1：增加忽略规则和更新记录

忽略 .env、.env.*（保留未来的 .env.example）、私钥/证书扩展名、生成的 tarball 和 .superpowers/sdd/。增加 0.1.0 更新记录，说明本地优先工作流、DSH 集成和 BrowserSkill 边界。

- [x] 步骤 2：增加 GitHub Actions

工作流在 push、pull request 和手动触发时运行；使用 fetch-depth: 0，安装 Node 24 和 pnpm 11.19，执行冻结安装、测试、lint、DSH 冒烟、打包检查和 Gitleaks Action v2。

- [x] 步骤 3：明确本地发布门槛

固定以下完整历史扫描命令：

~~~powershell
gitleaks git --redact --log-opts="--all" .
~~~

说明扫描器缺失或存在未解决发现时必须停止发布；普通 git 搜索不能替代正式扫描。GitHub Actions 必须保持 fetch-depth: 0。

- [x] 步骤 4：补充许可证复核要求

每次锁定文件变化后重新运行 pnpm licenses list，并逐项复核所有非 MIT 分类；不能把传递依赖统一标成 MIT。

### 任务 5：完成包元数据和公开仓库指引

**文件：**

- 修改：package.json
- 修改：README.md
- 修改：docs/release-checklist.md
- 修改：docs/superpowers/plans/2026-08-16-job-hunting.md

**产出：** 可发现的包元数据、明确的兼容性声明和不互相矛盾的公开文档。

- [x] 步骤 1：补充 GitHub 元数据

在 package.json 中加入 repository、homepage 和 bugs，并在发布清单中要求它们指向真实仓库，而不能保留示例地址。

- [x] 步骤 2：消除矛盾表述

把内部计划中旧的“BrowserSkill 默认关闭”改为当前实现的“工具默认启用，但实际采集需要外部 bsk、白名单和明确批准”。

- [x] 步骤 3：记录 GitHub 公开步骤

说明推送仓库后需要添加 dsh-plugin topic、创建 v0.1.0 tag，并从干净 profile 验证公开 GitHub 安装命令。

### 任务 6：执行完整验证门槛

**文件：**

- 验证：所有修改文件和 Git 状态

- [x] 步骤 1：运行定向测试和冒烟

~~~powershell
pnpm exec vitest run tests/release/release-checks.test.ts tests/project-metadata.test.ts
pnpm dsh:smoke
~~~

- [x] 步骤 2：运行完整本地门槛

~~~powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm release:check
git diff --check
~~~

- [x] 步骤 3：审查最终差异和外部发布门槛

确认没有 .superpowers/sdd 文件、用户 Workspace 数据、简历样本、.env 文件或私钥被暂存。单独报告仍需在仓库外完成的动作：确认 GitHub 仓库地址、配置 remote 并 push、完成许可证合规复核、创建 GitHub tag/release，以及启用私密漏洞报告。本地已取得完整历史 Gitleaks 结果；公开仓库建立后仍需让 GitHub Actions 再扫描一次。
