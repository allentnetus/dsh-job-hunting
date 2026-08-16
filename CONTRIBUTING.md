# 贡献指南

## 开发规则

- 遵循 TDD：先写会失败的测试，观察失败结果，再用最小改动让测试通过。
- 不要加入未经验证的运行时依赖。
- [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 工具由 npm 安装范围之外的外部软件
  提供，必须保持只读、仅允许精确主机名白名单、受 `maxItemsPerRun` 数量上限和 `minIntervalMs`
  时间间隔限制，并且必须经过批准。
- 不要加入 OCR、自动投递、凭证提取、认证/CAPTCHA 绕过或固定 Workspace 路径。
- 保持 JH / 求职情报站 / Job Hunting 品牌，并确保用户数据不进入仓库和发布包。

## 本地命令

- `pnpm install`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`
- `pnpm dsh:smoke`
- `pnpm release:check`

如果改动了包元数据、隐私边界、入口、模板或文档，在提交前请运行发布检查。依赖许可证
必须从锁定文件生成清单，并在 `THIRD-PARTY-NOTICES.md` 中分类；仓库自有代码和模板采用
MIT，第三方软件保留其原始许可证。

DSH 集成变更还必须在隔离 profile 中验证 `dsh plugin --profile web add <package>`、
`dsh --profile web --dump-config` 和 `dsh web --port 0`。发布前必须运行完整历史密钥扫描，
推荐命令为 `pnpm security:history`（底层命令为 `gitleaks git --redact --log-opts="--all" .`）；未安装扫描器时不要用普通文本搜索
冒充正式结果。
