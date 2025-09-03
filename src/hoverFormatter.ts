export type HoverResult = { fileUrl: string; envValue: string; selection: [number, number, number, number] }

export type HoverOptions = {
  maskSecrets?: boolean
  maskHead?: number
  maskTail?: number
}

function maskValue(val: string, head = 4, tail = 0) {
  if (val.length <= head + tail + 3) return val
  const headStr = val.slice(0, head)
  const tailStr = tail > 0 ? val.slice(val.length - tail) : ''
  return `${headStr}...${tailStr}`
}

function escapeForCodeBlock(val: string) {
  // wrap in triple backticks; to be safe, if value contains ``` replace with `\`\`\``
  return val.replace(/```/g, '\`\`\`')
}

export function formatHoverMarkdown(key: string, results: HoverResult[], options: HoverOptions = {}): string {
  const { maskSecrets = false, maskHead = 4, maskTail = 0 } = options

  let md = `### ${key} 环境变量预览\n\n`
  for (const { fileUrl, envValue, selection } of results) {
    let envName = fileUrl.match(/\.env\.([\w-]+)/)?.[1]
    if (!envName)
      envName = fileUrl.match(/\.([\w-]+)\.env/)?.[1]
    if (!envName)
      envName = fileUrl.split('/').pop()?.replace('.env', '') || 'env'

    const displayValue = maskSecrets ? maskValue(envValue, maskHead, maskTail) : envValue
    const safeValue = escapeForCodeBlock(displayValue)

    const editCommandUri = encodeURI(`command:env-preview.open?${encodeURIComponent(JSON.stringify([fileUrl, selection]))}`)
    const copyCommandUri = encodeURI(`command:env-preview.copy?${encodeURIComponent(JSON.stringify([envValue]))}`)

    md += `***${envName}***:\n\n` // name line
    md += `\`\`\`text\n${safeValue}\n\`\`\`  \n`
    md += `[Edit](${editCommandUri} "在 env 文件中编辑") [Copy](${copyCommandUri} "复制变量值")  \n\n`
  }

  return md
}
