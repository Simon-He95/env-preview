import path from 'node:path'

export interface HoverResult { fileUrl: string, envValue: string, selection: [number, number, number, number], tag?: string }

export interface HoverOptions {
  maskSecrets?: boolean
  maskHead?: number
  maskTail?: number
  summary?: {
    title: string
    value: string
    copyValue?: string
    copyLabel?: string
    secondaryCopy?: { label: string, value: string }
  }
  meta?: { title: string, lines: string[] }
}

function maskValue(val: string, head = 4, tail = 0) {
  if (val.length <= head + tail + 3)
    return val
  const headStr = val.slice(0, head)
  const tailStr = tail > 0 ? val.slice(val.length - tail) : ''
  return `${headStr}...${tailStr}`
}

function toShortPath(fileUrl: string) {
  const normalized = fileUrl.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 2)
    return parts.join('/')
  return parts.slice(-2).join('/')
}

function getEnvLabel(fileUrl: string) {
  const base = path.basename(fileUrl)
  // common patterns: .env, .env.local, .env.development.local, foo.env
  let envName = base
  if (base === '.env')
    envName = '.env'
  else if (base.startsWith('.env.'))
    envName = base.slice('.env.'.length)
  else if (base.startsWith('.env'))
    envName = base.slice('.env'.length).replace(/^\./, '') || '.env'
  else if (base.endsWith('.env') && base !== '.env')
    envName = base.slice(0, -'.env'.length)

  return { envName, shortPath: toShortPath(fileUrl) }
}

function wrapCodeBlock(val: string, lang = 'text') {
  const runs = val.match(/`+/g) || []
  const maxRun = runs.reduce((m, s) => Math.max(m, s.length), 0)
  const fenceLen = Math.max(3, maxRun + 1)
  const fence = '`'.repeat(fenceLen)
  return `${fence}${lang}\n${val}\n${fence}`
}

export function formatHoverMarkdown(key: string, results: HoverResult[], options: HoverOptions = {}): string {
  const { maskSecrets = false, maskHead = 4, maskTail = 0, summary, meta } = options

  let md = `### ${key} 环境变量预览\n\n`

  if (summary) {
    let displayValue = summary.value
    if (displayValue === '')
      displayValue = '\'\''
    else if (maskSecrets)
      displayValue = maskValue(displayValue, maskHead, maskTail)
    md += `**${summary.title}**\n\n`
    md += `${wrapCodeBlock(displayValue, 'text')}\n\n`
    if (summary.copyValue !== undefined) {
      const copyCommandUri = encodeURI(`command:env-preview.copy?${encodeURIComponent(JSON.stringify([summary.copyValue]))}`)
      md += `[${summary.copyLabel || 'Copy Effective'}](${copyCommandUri} "复制最终生效值")\n`
      if (summary.secondaryCopy) {
        const secondaryCopyUri = encodeURI(`command:env-preview.copy?${encodeURIComponent(JSON.stringify([summary.secondaryCopy.value]))}`)
        md += ` [${summary.secondaryCopy.label}](${secondaryCopyUri} "复制原始值")\n`
      }
      md += '\n'
    }
  }

  if (meta && meta.lines.length > 0) {
    md += `**${meta.title}**\n\n`
    for (const line of meta.lines) {
      md += `- ${line}\n`
    }
    md += '\n'
  }

  for (const { fileUrl, envValue, selection, tag } of results) {
    const { envName, shortPath } = getEnvLabel(fileUrl)

    let displayValue = envValue
    if (displayValue === '')
      displayValue = '\'\''
    else if (maskSecrets)
      displayValue = maskValue(displayValue, maskHead, maskTail)

    const editCommandUri = encodeURI(`command:env-preview.open?${encodeURIComponent(JSON.stringify([fileUrl, selection]))}`)
    const copyCommandUri = encodeURI(`command:env-preview.copy?${encodeURIComponent(JSON.stringify([envValue]))}`)

    md += `***${envName}*** \`(${shortPath})\`${tag ? ` _(${tag})_` : ''}:\n\n` // name line
    md += `${wrapCodeBlock(displayValue, 'text')}  \n`
    md += `[Edit](${editCommandUri} "在 env 文件中编辑") [Copy](${copyCommandUri} "复制变量值")  \n\n`
  }

  return md
}
