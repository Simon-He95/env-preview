import type { Position } from 'vscode'
import { createExtension, createMarkdownString, registerHoverProvider } from '@vscode-use/utils'
import { runCommands } from './command'
import { findKeyPosition } from './findKeyPosition'
import { getEnvKey } from './getEnvKey'
import { formatHoverMarkdown } from './hoverFormatter'
import { envCacheMap, loadEnv } from './loadEnvFiles'

export = createExtension(async () => {
  await loadEnv()
  runCommands()
  registerHoverProvider('*', (_: any, position: Position) => {
    const envKey = getEnvKey(position)
    if (!envKey)
      return

    // 1. 从 envCacheMap 中获取 fileUrl 和 envObject
    // 2. 生成 hoverMarkdown, 小图标点击直接打开到对应 env 文件的变量上, 提供快速修改跳转到对应文件 和 复制变量值的命令
    const results: { fileUrl: string, envValue: string, selection: [number, number, number, number] }[] = []
    for (const [fileUrl, { env, content }] of envCacheMap.entries()) {
      // do not mutate outer envKey; use a per-file searchKey
      let searchKey = envKey
      if (env[searchKey] === undefined) {
        if (env[`VITE_${searchKey}`] !== undefined)
          searchKey = `VITE_${searchKey}`
        else
          continue
      }

      const loc = findKeyPosition(content, searchKey)
      if (!loc)
        continue
      results.push({
        fileUrl,
        envValue: env[searchKey] || '\'\'',
        selection: [loc.startLine, loc.startChar, loc.endLine, loc.endChar],
      })
    }
    if (results.length === 0)
      return

    const markdown = createMarkdownString()
    markdown.isTrusted = true
    const mdText = formatHoverMarkdown(envKey, results, { maskSecrets: false })
    markdown.appendMarkdown(mdText)
    return { contents: [markdown] }
  })
})
