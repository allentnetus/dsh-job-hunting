# GitHub 上传目录说明

本目录是从 `G:\发布\Job Hunting Skill` 当前已验证工作树中整理出的 GitHub 上传副本。
它不是原项目的嵌套目录，原项目的 Git 状态不会被本目录影响。

## 已包含

- `src/`：插件源码；
- `dist/`：已构建的 JavaScript、类型声明和 source map。`package.json` 的入口指向这里，
  因此保留它以支持从 GitHub 直接安装 DSH 插件；
- `tests/`、`scripts/`：测试、发布检查和 DSH profile 冒烟脚本；
- `docs/`、`templates/`、`.github/`：用户文档、网站模板、Issue 模板和 CI；
- `package.json`、`pnpm-lock.yaml`、`dsh.bundle`、`cordis.patch.yml` 及许可证、安全和更新记录。

## 明确排除

- `.git/` 和已有 Git 历史；
- `.superpowers/` 内部工作记录；
- `node_modules/`、`coverage/`、临时 tarball 和其他构建缓存；
- 根目录的 `task-3-report.md`，它是过时的内部开发报告，不属于公开发布材料。

## 上传前检查

在本目录中执行：

如果 PowerShell 提示找不到 `pnpm`，使用 `corepack pnpm`；本项目已声明并验证 pnpm `11.19.0`。

```powershell
Set-Location 'G:\发布\Job Hunting Skill-GitHub'
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm dsh:smoke
git init
git status --short
git add .
git status --short
```

第一次 `git status --short` 用于暂存前检查；`git add .` 后的第二次用于确认待提交内容。
确认第二次输出中包含 `dist/`、`.github/workflows/ci.yml` 和 `docs/dsh-installation.md`，
不包含 `node_modules/`、`.superpowers/`、`.env` 或个人数据，再配置 GitHub remote 并提交推送。
