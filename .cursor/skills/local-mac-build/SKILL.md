---
name: local-mac-build
description: Builds and runs this Orca fork on macOS — pnpm dev for iteration, pnpm build:mac for AgentIDE.app. Use when the user asks to 打包, 构建, build, build:mac, pnpm dev, 本地包, AgentIDE, or to launch the local app.
---

# 本地 mac 构建

本 fork 日常只在 `fork` 上构建。未经用户明确要求，不要 `git commit` / `push`。

## 先确认

1. 当前分支是 `fork`。若在 `main`：先 `git switch fork`。AgentIDE 改名只存在于 `fork`。
2. 有 `node_modules`；没有则 `pnpm install`。
3. 本地打包还要 Xcode / Swift（`build:computer-macos`、notification-status、keyboard-layout）。
4. 终端里已有同名构建在跑：不要再开一份。

## 选哪条命令

| 用户要什么 | 命令 | 进程名 |
|---|---|---|
| 改代码、热更新 | `pnpm dev` | 仍是 `Electron` / Dock 显示 `Orca Dev` |
| 绕过按 `Orca` 拦截的安全软件 | `pnpm build:mac` | `AgentIDE` + Helper |

要进程名变成 AgentIDE，必须走 `pnpm build:mac`，不要用 `pnpm dev`。

不要主动跑 `pnpm build:mac:release`（官方名、要正式签名）或 `build:win` / `build:linux`。

## `pnpm build:mac`

整条链路：`build:desktop`（typecheck + relay + cli + electron-vite + web）→ 三个 mac native helper → `config/scripts/build-mac-local.mjs`。

`build-mac-local.mjs` 会写入 `ORCA_LOCAL_BUILD_VERSION`，electron-builder 据此把 `productName` 设为 **AgentIDE**。hourly/daily/adhoc/release 仍是 Orca。`appId` 保持 `com.stablyai.orca`，不要改。

- 耗时长（含 typecheck + electron-builder 打 x64/arm64）。`block_until_ms` 给足，不要中途当失败。
- 成功后打开本机产物，不要打开 `/Applications/Orca.app`：
  - Apple Silicon：`dist/mac-arm64/AgentIDE.app`
  - Intel：`dist/mac/AgentIDE.app`
- 日志里应出现 `(productName=AgentIDE)`。

## `pnpm dev`

```bash
pnpm dev
```

只在用户明确要「稳定 Electron 名」时才用 `pnpm dev-stable-name`。

## 禁止

- 把 AgentIDE 改名、本 skill、`.cursor/rules` 带进上游 PR
- 改完 `productName` 后继续用已安装的官方 `Orca.app` 验证
- 为了构建去改 git config、跳过 hook、force push
