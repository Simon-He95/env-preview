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

<p align="center"> English | <a href="./README_zh.md">简体中文</a></p>

> Tired of switching between different `.env` files to check variable values? This plugin lets you effortlessly preview environment variable values directly within your VS Code editor. Hover over an environment variable in your code to see its value from different `.env` files.

<!--
<p align="center">
  <img src="./assets/demo.gif" alt="Env Preview Demo">
</p>
-->

## ✨ Features

*   **⚡️ Instant Preview**: Hover over an environment variable (e.g., `process.env.API_KEY` or `import.meta.env.VITE_USER`) to instantly see its value.
*   **📄 Multi-File Support**: Displays values from various `.env` files (e.g., `.env`, `.env.development`, `.env.production`) simultaneously.
*   **🚀 Quick Actions**:
    *   **Edit**: Directly jump to the variable definition in the corresponding `.env` file.
    *   **Copy**: Quickly copy the variable's value.
*   **🏷️ Clear Identification**: Easily distinguish between different environment configurations (e.g., development, staging, production).

## 🚀 Installation

1.  Open **Visual Studio Code**.
2.  Go to the **Extensions** view (Ctrl+Shift+X or Cmd+Shift+X).
3.  Search for `Env Preview`.
4.  Click **Install**.

Or, install via the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=simonhe.env-preview).

## 💡 Usage

Once installed, simply open a project with `.env` files and hover your mouse cursor over an environment variable in your code. A tooltip will appear showing the values from your configured `.env` files.

## ⚙️ Behavior & Configuration

- Matching strategy: by default the extension follows a "last wins" strategy when the same key appears multiple times in a single `.env` file (later declarations override earlier ones). The internal helper also supports a `first` strategy for callers that need the first occurrence.
- Debounce / batching: file watch events are debounced (250–300ms) and processed in batches to avoid heavy I/O when many file events occur in rapid succession (for example during git operations or bulk saves).
- Security: hover values are displayed inside code blocks and can be masked; copy actions still provide the raw value for convenience. Values are escaped to avoid markdown codeblock injection.

## 🙏 Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>

You can also [buy me a cup of coffee](https://github.com/Simon-He95/sponsor).

## 📄 License

[MIT](./LICENSE) © [Simon He](https://github.com/Simon-He95)
