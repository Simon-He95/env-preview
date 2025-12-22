<p align="center">
  <img height="200" src="./assets/kv.png" alt="Env Preview Logo">
</p>

<h1 align="center">Env Preview for VS Code</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=simonhe.env-preview">
    <img src="https://img.shields.io/visual-studio-marketplace/v/simonhe.env-preview.svg?color=blue&label=VS%20Code%20Marketplace&logo=visualstudiocode" alt="VS Code Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=simonhe.env-preview">
    <img src="https://img.shields.io/visual-studio-marketplace/d/simonhe.env-preview.svg?color=blue&label=Downloads" alt="VS Code Marketplace Downloads">
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/Simon-He95/env-preview?color=blue" alt="License">
  </a>
</p>

<p align="center"><a href="./README.md">English</a> | 简体中文</p>

> 还在为切换查看不同环境的 `.env` 文件而烦恼吗？这款插件让你在 VS Code 中轻松预览环境变量的值。只需将鼠标悬停在代码中的环境变量上，即可查看其在不同 `.env` 文件中的值。

<!--
<p align="center">
  <img src="./assets/demo.gif" alt="Env Preview 演示">
</p>
-->

## ✨ 功能特性

*   **⚡️ 实时预览**: 将鼠标悬停在环境变量上（例如 `process.env.API_KEY` 或 `import.meta.env.VITE_USER`），即可立即看到其值。
*   **📄 支持多种 .env 文件**: 同时显示来自多个 `.env` 文件（如 `.env`, `.env.development`, `.env.production`）的值。
*   **🚀 快捷操作**:
    *   **编辑**: 一键跳转到对应 `.env` 文件中变量的定义位置。
    *   **复制**: 快速复制变量的值。
*   **🔎 跳转定义**: Cmd/Ctrl+点击 env key 跳转到其在 `.env` 中的定义（可能有多个）。
*   **⌨️ 自动补全**: 在 `process.env.` / `import.meta.env.` / `Deno.env.get(` / `Bun.env.` 后自动补全 key。
*   **🏷️ 清晰识别**: 轻松区分不同环境配置（如开发、测试、生产环境）。

## 🚀 安装

1.  打开 **Visual Studio Code**。
2.  前往 **扩展** 视图 (Ctrl+Shift+X 或 Cmd+Shift+X)。
3.  搜索 `Env Preview`。
4.  点击 **安装**。

或者，通过 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=simonhe.env-preview) 安装。

## 💡 使用

安装后，只需打开一个包含 `.env` 文件的项目，并将鼠标悬停在代码中的环境变量上，即可看到一个显示了来自不同 `.env` 文件值的悬浮提示框。

## ⚙️ 行为与配置

- 匹配策略：同一个 `.env` 文件里如果同名 key 出现多次，默认使用“后者覆盖前者”（last wins）。
- 防抖 / 批处理：文件变更事件会进行 250–300ms 的防抖与批量处理，减少频繁 I/O。
- Multi-root 工作区：按当前激活的工作区文件夹加载对应的 env 文件，并在 hover 中按当前文件夹过滤结果，避免多项目之间的值混在一起。
- Vite 模式：开启后会按 `viteMode` 计算最终生效值，并展示 `.env` 覆盖链路。
- Vite 变量展开：最终生效值可按 `${VAR}` / `$VAR` 规则展开（仅在 Vite `.env*` 内部解析），可用 `viteExpand` 关闭。
- Vite mode 发现：hover 会根据 root/envDir 下的 `.env.<mode>` 文件名提示可用的 mode 列表。
- Vite mode 切换：hover 中点击 “Set Vite Mode” 可下拉选择并更新 `env-preview.viteMode`。
- Vite envDir/envPrefix：hover 中提供快捷入口设置 `viteEnvDir` 与 `viteEnvPrefix`。
- 若展开后的最终值与原始值不同，hover 也会提供 “Copy Raw Effective” 便于对比。
- Multi-root 提示：多数 `env-preview.*` 配置为 resource scope，可对不同 workspace folder 分别配置 `viteMode/envDir`。
- 安全：hover 中的值可以开启脱敏显示；复制操作仍会复制原始值。
- 设置项：
  - `env-preview.maskSecrets`（默认：`false`）
  - `env-preview.maskHead`（默认：`4`）
  - `env-preview.maskTail`（默认：`0`）
  - `env-preview.maskKeyPattern`（默认：`""`，示例：`(?i)(token|secret|password|api_key|private_key)`，仅匹配到的 key 会脱敏）
  - `env-preview.unmaskKeyPattern`（默认：`""`，用于从 maskKeyPattern 中排除）
  - `env-preview.framework`（默认：`"auto"`，可选：`"auto" | "vite" | "generic"`；`auto` 会在 key 为 `VITE_*` 或 key 存在于 root `.env*` 时启用 Vite 规则）
  - `env-preview.viteMode`（默认：`"development"`，用于解析 `.env.[mode]` 与 `.env.[mode].local`）
  - `env-preview.viteEnvDir`（默认：`""`，Vite 的 `envDir`；可填绝对路径或相对 workspace root 的路径）
  - `env-preview.viteEnvPrefix`（默认：`["VITE_"]`，Vite 的 `envPrefix`，用于支持自定义前缀如 `PUBLIC_`）
  - `env-preview.viteExpand`（默认：`true`，用于展开 `${VAR}` / `$VAR`）
  - `env-preview.viteIncludeLocalInTest`（默认：`false`，当 `viteMode` 为 `test` 时是否包含 `.env.local` / `.env.test.local`）
  - `env-preview.viteHoverRefreshMs`（默认：`2000`，当 `envDir` 在 root 外时，hover 定期刷新 Vite `.env*`；`0` 关闭）
  - `env-preview.enableCompletions`（默认：`true`）
  - `env-preview.include`（默认：`[".env", "**/.env", "**/.env.*"]`）
  - `env-preview.exclude`（默认忽略：`node_modules`、`.git`、`dist`、`build`、`.next`、`.turbo`、`coverage`）

## 🙏 支持者

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>

您也可以 [请我喝一杯咖啡](https://github.com/Simon-He95/sponsor)。

## 📄 许可证

[MIT](./LICENSE) © [Simon He](https://github.com/Simon-He95)
