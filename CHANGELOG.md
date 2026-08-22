# 更新记录

## Unreleased

- 增加可选的 DSH 原生 Schedule 宿主层 overlay 及配套文档；默认插件包不启用 Schedule，提醒到期后仍需用户确认白名单 URL 和只读采集范围。
- 增加 `profile/profile.json` 的持久化 schema 版本标记与非破坏性迁移；首次迁移会保留
  `profile.json.pre-schema-<version>.bak` 备份，不覆盖用户的城市、行业、分类共享规则、收藏或备注。
- 为 Git/npm 安装补充 `prepare` 和 `prepack` 构建生命周期，并在发布清单中加入升级验证与回滚检查。
- 将插件代码版本更新与岗位采集数据更新分开，继续采用人工确认更新，不执行运行时静默自升级。

## 0.1.2

- 将开发工作区与 GitHub 用户交付目录分离，交付包只保留构建后的运行入口和用户文档。
- 移除交付目录中的源码、测试、构建工具、锁文件和 `node_modules`，并保留运行时依赖声明。
- 补充 DSH 插件安装所需的 pnpm 前置条件、ZIP 本地安装方式和 `npx` 备用入口。
- 将用户安装命令切换到 `v0.1.2`，避免继续使用旧 `v0.1.1` 标签。

## 0.1.1

- 对齐 GitHub 发布目录中的源码、构建产物、用户文档和发布合同文件。
- 统一在 Skill、BrowserSkill 工具和用户文档中标明 Tencent/BrowserSkill 外部集成。
- 更新 DSH 安装说明，使其他用户可以通过 `v0.1.1` 安装本批 Skill 代码。

## 0.1.0

- 发布面向 DeepSeek Harness `web` profile 的 `dsh-job-hunting` 插件和 Runtime Skill。
- 支持本地 JSON/Markdown 岗位导入、简历解析、求职画像、岗位匹配、报告和静态网站。
- 直接注册 [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 提供的只读 BrowserSkill
  工具，默认允许 51job、BOSS 直聘、猎聘、智联招聘和国聘，并支持通过 DSH profile 追加精确主机名。
- 明确不自动投递、不提取凭证、不绕过登录/CAPTCHA，不使用 OCR 处理扫描版或加密 PDF。
- 增加 GitHub 安装说明、隔离 DSH profile 冒烟测试和完整历史密钥扫描 CI 门槛。
