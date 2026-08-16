# 第三方声明

本仓库的自有代码和模板按照 [LICENSE](./LICENSE) 中的 MIT 许可证发布。

MIT 许可证不覆盖第三方依赖、外部运行软件、图片、字体或用户数据。每个依赖都保留其包
元数据中声明的许可证。使用以下命令重新生成依赖清单：

```powershell
pnpm licenses list
```

## 宿主运行时

- `@deepseek-ai/dsh` `0.1.0-rc.6` 通过 `peerDependencies` 声明为已验证的宿主运行时基线。
- Job Hunting 包不会重新打包完整的 DeepSeek Harness 运行时。

## 外部运行前置条件

- [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill) 是本包直接注册的外部 CLI 集成，
  不会作为本包的 npm 依赖安装。
- Tencent/BrowserSkill CLI 和浏览器扩展由操作者自行安装和管理；本包不会打包、复制或作为依赖
  加载它们。
- 使用前必须由操作者独立确认 Tencent/BrowserSkill CLI 和扩展的许可证。本仓库不对该外部项目
  作许可证断言。
- GitHub Actions 中的 Gitleaks 仅用于仓库安全检查，不是本 npm 包的运行时依赖；其许可证和
  运行条件由对应的 GitHub Action 仓库负责。

## 锁定文件中的许可证分类

以下分类来自 2026-08-16 已验证的锁定文件扫描。完整的包和版本清单由
`pnpm licenses list` 生成；下面列出直接依赖或重要依赖示例，更新锁定文件时不得静默改分类。

### 运行时依赖快照（`--prod`）

以下是 2026-08-16 执行 `pnpm licenses list --prod --json` 得到的运行时依赖分类，包含直接和传递依赖；
版本变化时必须重新生成并复核：

- MIT：`@napi-rs/canvas@1.0.6`、`@napi-rs/canvas-win32-x64-msvc@1.0.6`、
  `@xmldom/xmldom@0.8.14`、`argparse@1.0.3`、`base64-js@1.5.1`、`bluebird@3.4.7`、
  `core-util-is@1.0.3`、`immediate@3.0.6`、`isarray@1.0.0`、`lie@3.3.0`、`lodash@3.2.0`、
  `pako@1.0.2`、`path-is-absolute@1.0.1`、`process-nextick-args@2.0.1`、
  `readable-stream@2.3.8`、`safe-buffer@5.1.2`、`setimmediate@1.0.5`、`string_decoder@1.1.1`、
  `underscore@1.13.8`、`util-deprecate@1.0.2`、`xmlbuilder@10.1.1`。
- BSD-2-Clause：`dingbat-to-unicode@1.0.1`、`lop@0.4.2`、`mammoth@1.12.1`、
  `option@0.2.4`。
- BSD：`duck@0.1.12`。
- ISC：`inherits@2.0.4`。
- `(MIT OR GPL-3.0-or-later)`：`jszip@3.10.1`。
- Apache-2.0：`pdfjs-dist@6.2.108`。
- BSD-3-Clause：`sprintf-js@1.0.3`。

### MIT

- `@deepseek-ai/cordis@4.0.1`
- `@deepseek-ai/dsh@0.1.0-rc.6` 及已验证的 DSH peer/dev 包
- 报告为 MIT 的 Vitest 及相关测试工具链包

### BSD-3-Clause

锁定文件扫描包含以下 BSD-3-Clause 包；发布时须分别保留其声明：

#### 2026-08-16 当前锁定的 BSD-3-Clause 包

- `@deepseek-ai/node-addon-landlock-run@0.1.1`
- `@protobufjs/aspromise@1.1.2`
- `@protobufjs/base64@1.1.2`
- `@protobufjs/codegen@2.0.5`
- `@protobufjs/eventemitter@1.1.1`
- `@protobufjs/fetch@1.1.1`
- `@protobufjs/float@1.0.2`
- `@protobufjs/path@1.1.2`
- `@protobufjs/pool@1.1.0`
- `@protobufjs/utf8@1.1.2`
- `buffer-equal-constant-time@1.0.1`
- `diff@9.0.0`
- `fast-uri@3.1.5`
- `protobufjs@7.6.5`
- `qs@6.15.3`
- `source-map-js@1.2.1`

### Apache-2.0

- `pdfjs-dist@6.2.108`
- `typescript@7.0.2`
- `pnpm licenses list` 报告为 Apache-2.0 的其他传递依赖，在锁定文件更新时也必须保留该分类。

### 其他 / 需要复核

当前扫描还报告 BSD-2-Clause（`mammoth@1.12.1`）、ISC、MPL-2.0、0BSD、Python-2.0、BSD、
`(MIT OR GPL-3.0-or-later)` 以及 `Apache-2.0 AND LGPL-3.0-or-later`。这些都不是 MIT，
发布前需要复核其包元数据和许可证文本。锁定文件更新后，必须刷新清单并补充新出现的分类。

发布前必须逐项确认这些“其他 / 需要复核”许可证是否允许当前分发方式，并保留其许可证文本或
合规链接；不能因为核心代码采用 MIT 就把传递依赖统一标为 MIT。
