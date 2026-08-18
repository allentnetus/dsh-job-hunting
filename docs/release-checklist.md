# v0.1 发布清单

请在配套的源码工作区根目录运行本清单。它只执行本地检查，不会发布包，也不会全局安装任何内容。
本 GitHub 目录是预构建交付目录，不包含源码、测试、构建脚本或锁文件；同步完成后，
应另外检查发布目录的包清单和可安装入口。

## 自动检查

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] `pnpm dsh:smoke`（隔离 `web` profile 安装 tarball、加载 bundle 并启动 DSH）
- [ ] `pnpm release:check`（发布测试、DSH 冒烟和 `pnpm pack --dry-run`）
- [ ] `pnpm pack --dry-run` 已包含源码工作区构建后的 `dist`、网站模板和 `cordis.patch.yml`。
- [ ] 在临时 profile 中从上一版本升级到本版本，确认 `dsh.profile.bundles` 保持包含
      `dsh-job-hunting`，并验证 `dsh --profile <name> --dump-config`。
- [ ] 使用旧版 `profile/profile.json` 执行一次升级读取，确认生成
      `profile/profile.json.pre-schema-<version>.bak`，且城市、行业、分类共享规则、收藏和备注不变。
- [ ] `git diff --check`
- [ ] 在干净 profile 中验证公开 GitHub tag tarball 安装命令（例如
      `dsh plugin --profile web add "https://codeload.github.com/allentnetus/dsh-job-hunting/tar.gz/refs/tags/v0.1.2"`）；不要使用 `github:` 简写。
- [ ] 在本 GitHub 发布目录运行 `npm pack --dry-run --ignore-scripts`，确认只包含预构建入口、模板、bundle、补丁和用户文档。
- [ ] 确认本 GitHub 发布目录不包含 `src/`、`tests/`、`scripts/`、`node_modules/`、锁文件或内部计划。
- [ ] 已创建本次发布对应的版本 tag（当前为 `v0.1.2`），并在 GitHub 仓库添加 `dsh-plugin` topic。
- [ ] 已复核 `pnpm licenses list`，且 `THIRD-PARTY-NOTICES.md` 分开记录 MIT、BSD-3-Clause、
      Apache-2.0 和其他所有实际报告的许可证。
- [ ] 使用 Gitleaks 或项目批准的等价扫描器扫描完整 Git 历史：
      `pnpm security:history`（底层命令为 `gitleaks git --redact --log-opts="--all" .`）。扫描器缺失时必须停止发布，不能用普通
      `git` 搜索替代；GitHub Actions 也必须保持 `fetch-depth: 0`。
- [ ] `SECURITY.md` 已给出私密漏洞报告入口，且 GitHub Private vulnerability reporting 已启用。

## 内容与隐私检查

- [ ] `package.json` 使用 MIT，并指向 `dist/src/index.js` 和 Runtime Skill 入口点。
- [ ] GitHub 发布目录的 `package.json` 不含源码工作区专用的 `scripts` 或 `devDependencies`，并能通过
      `npm pack --dry-run --ignore-scripts` 校验预构建内容。
- [ ] 代码/模板/插件契约的版本号与 `CHANGELOG.md` 一致；岗位采集数据更新不递增插件版本。
- [ ] `package.json` 的 `repository`、`homepage` 和 `bugs` URL 指向实际 GitHub 仓库，不能保留
      示例 owner/repository。
- [ ] 发布包包含网站模板和必要文档，但不包含测试、用户 Workspace 数据、简历样本、浏览器
      扩展二进制、`.env` 文件、私钥或明显密钥。
- [ ] 面向用户的文件统一使用 JH / 求职情报站 / Job Hunting 品牌，不使用已废弃品牌。
- [ ] v0.1 文档说明本地 JSON/Markdown 岗位、DOCX/文字型 PDF/TXT/MD 简历，以及扫描/加密
      PDF 明确拒绝且不使用 OCR。
- [ ] 隐私文档说明不自动投递、不提取凭证、不绕过认证/CAPTCHA，也不上传被拒绝的简历。
- [ ] `docs/dsh-installation.md` 已说明 DSH `web` profile、`dsh plugin` 安装命令、验证命令、
      profile `cordis.patch.yml` 配置和 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill)
      提供的外部 `bsk` 前置条件。

## Windows 人工冒烟检查

- [ ] 导入本地 JSON 岗位和本地 Markdown 岗位，验证来源保留和去重。
- [ ] 解析 DOCX 和文字型 PDF；验证扫描版 PDF、加密 PDF 在不 OCR 的情况下被拒绝。
- [ ] 双击生成的 `index.html`，验证内嵌数据正常显示且不运行时请求 JSON。
- [ ] 验证 `job_hunting_collect_browser_jobs` 已注册且默认启用；配置外部 `bsk`、精确白名单，
      再测试明确批准、只读会话、人工协助和会话停止清理。
- [ ] 验证浏览器临时兴趣标记可导出 JSON，只有明确同步才写入 Workspace 正式兴趣台账。
- [ ] 没有活跃 Workspace 时，验证不会写出用户数据。
- [ ] 如果已接入宿主/手工集成，批准 Windows 快捷方式，创建并重复更新已归属快捷方式，
      验证不会覆盖无归属的同名快捷方式。插件不会自动创建；未接入宿主时不提供用户入口。
