import type { Position } from 'vscode'
import { createExtension, createMarkdownString, getPosition, registerHoverProvider } from '@vscode-use/utils'
import { runCommands } from './command'
import { getEnvKey } from './getEnvKey'
import { envCacheMap, loadEnv } from './loadEnvFiles'

export = createExtension(async () => {
  await loadEnv()
  runCommands()
  registerHoverProvider('*', (_: any, position: Position) => {
    let envKey = getEnvKey(position)
    if (!envKey)
      return

    // 1. 从 envCacheMap 中获取 fileUrl 和 envObject
    // 2. 生成 hoverMarkdown, 小图标点击直接打开到对应 env 文件的变量上, 提供快速修改跳转到对应文件 和 复制变量值的命令
    const results: { fileUrl: string, envValue: string, selection: [number, number, number, number] }[] = []
    for (const [fileUrl, { env, content }] of envCacheMap.entries()) {
      if (env[envKey] === undefined) {
        if (env[`VITE_${envKey}`] !== undefined)
          envKey = `VITE_${envKey}`
        else
          continue
      }
      const matchContent = `${envKey}=`
      const positionOffset = content.indexOf(matchContent)
      const positionStart = getPosition(positionOffset, content).position
      const positionEnd = getPosition(positionOffset + matchContent.length - 1, content).position
      results.push({
        fileUrl,
        envValue: env[envKey] || '\'\'',
        selection: [positionStart.line, positionStart.character, positionEnd.line, positionEnd.character],
      })
    }
    if (results.length === 0)
      return

    // 生成 markdown,区分 dev/prod 等环境
    const markdown = createMarkdownString()
    markdown.isTrusted = true

    // 添加大标题
    markdown.appendMarkdown(`### ${envKey} 环境变量预览\n\n`)

    for (const { fileUrl, envValue, selection } of results) {
      // 提取更精简的环境名
      let envName = fileUrl.match(/\.env\.([\w-]+)/)?.[1]
      if (!envName)
        envName = fileUrl.match(/\.([\w-]+)\.env/)?.[1]
      if (!envName)
        envName = fileUrl.split('/').pop()?.replace('.env', '') || 'env'

      // 编辑命令
      const editCommandUri = encodeURI(
        `command:env-preview.open?${encodeURIComponent(JSON.stringify([fileUrl, selection]))}`,
      )
      // 复制命令
      const copyCommandUri = encodeURI(
        `command:env-preview.copy?${encodeURIComponent(JSON.stringify([envValue]))}`,
      )
      markdown.appendMarkdown(
        `***${envName}***: \`${envValue}\` [Edit](${editCommandUri} "在 env 文件中编辑") [Copy](${copyCommandUri} "复制变量值")  \n`,
      )
    }

    return { contents: [markdown] }
  })
})
