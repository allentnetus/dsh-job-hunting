# 更新记录

## 0.1.0

- 发布面向 DeepSeek Harness `web` profile 的 `dsh-job-hunting` 插件和 Runtime Skill。
- 支持本地 JSON/Markdown 岗位导入、简历解析、求职画像、岗位匹配、报告和静态网站。
- 直接注册只读 BrowserSkill 工具，默认允许 51job、BOSS 直聘、猎聘、智联招聘和国聘，
  并支持通过 DSH profile 追加精确主机名。
- 明确不自动投递、不提取凭证、不绕过登录/CAPTCHA，不使用 OCR 处理扫描版或加密 PDF。
- 增加 GitHub 安装说明、隔离 DSH profile 冒烟测试和完整历史密钥扫描 CI 门槛。
