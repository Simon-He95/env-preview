import type { Position } from 'vscode'
import path from 'node:path'
import { createDefinitionLocation, createExtension, createMarkdownString, getConfiguration, getRootPath, registerCompletionItemProvider, registerDefinitionProvider, registerHoverProvider } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { runCommands } from './command'
import { collectRootEnvKeys, collectViteEnvKeys, detectEnvCompletionContext } from './completions'
import { findKeyPosition } from './findKeyPosition'
import { getEnvKey } from './getEnvKey'
import { formatHoverMarkdown } from './hoverFormatter'
import { envCacheMap, loadEnv, readEnv } from './loadEnvFiles'
import { shouldMaskKey } from './masking'
import { computeViteEffectiveValue, discoverViteModes, getViteEnvFiles, resolveViteSearchKey, shouldUseViteMode } from './viteEnv'

function getEnvPreviewConfig<T>(key: string, defaultValue: T, root?: string) {
  if (root) {
    try {
      return vscode.workspace.getConfiguration('env-preview', vscode.Uri.file(root)).get<T>(key, defaultValue)
    }
    catch {}
  }
  return getConfiguration(`env-preview.${key}`, defaultValue as any) as any
}

export = createExtension(() => {
  void loadEnv()
  runCommands()
  const selectors = [
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
    'vue',
    'svelte',
    'astro',
  ]

  registerCompletionItemProvider(selectors, async (document: vscode.TextDocument, position: vscode.Position) => {
    const lineText = document.lineAt(position.line).text
    const prefixText = lineText.slice(0, position.character)
    const ctx = detectEnvCompletionContext(prefixText)
    if (!ctx)
      return

    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    const resolvedRoot = folder?.uri.fsPath ? path.resolve(folder.uri.fsPath) : getRootPath()
    if (!resolvedRoot)
      return
    const enabled = getEnvPreviewConfig('enableCompletions', true, resolvedRoot)
    if (!enabled)
      return

    let keys: string[] = []
    if (ctx.kind === 'import-dot' || ctx.kind === 'import-bracket') {
      const framework = getEnvPreviewConfig('framework', 'auto', resolvedRoot)
      if (framework === 'generic')
        return
      const viteMode = getEnvPreviewConfig('viteMode', 'development', resolvedRoot)
      const viteEnvDir = getEnvPreviewConfig('viteEnvDir', '', resolvedRoot)
      const viteEnvPrefix = getEnvPreviewConfig('viteEnvPrefix', ['VITE_'] as any, resolvedRoot)
      const viteIncludeLocalInTest = getEnvPreviewConfig('viteIncludeLocalInTest', false, resolvedRoot)
      const viteFiles = getViteEnvFiles(resolvedRoot, viteMode, viteEnvDir, { includeLocalInTest: viteIncludeLocalInTest })
      await Promise.all(viteFiles.map(f => envCacheMap.has(f) ? undefined : readEnv(f).catch(() => undefined)))
      keys = collectViteEnvKeys(envCacheMap, resolvedRoot, viteMode, viteEnvDir, viteIncludeLocalInTest, viteEnvPrefix)
    }
    else {
      keys = collectRootEnvKeys(envCacheMap, resolvedRoot)
    }

    if (ctx.partial)
      keys = keys.filter(k => k.startsWith(ctx.partial))
    if (keys.length === 0)
      return

    return keys.map((k) => {
      const item = new vscode.CompletionItem(k, vscode.CompletionItemKind.Variable)
      item.range = new vscode.Range(position.translate(0, -ctx.partial.length), position)
      if (ctx.kind === 'process-bracket' || ctx.kind === 'import-bracket' || ctx.kind === 'deno-get')
        item.insertText = ctx.quote ? k : `'${k}'`
      else
        item.insertText = k
      return item
    })
  }, ['.', '[', '"', '\'', '('])

  registerDefinitionProvider(selectors, async (document: vscode.TextDocument, position: Position) => {
    const envKey = getEnvKey(position)
    if (!envKey)
      return

    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    const resolvedRoot = folder?.uri.fsPath ? path.resolve(folder.uri.fsPath) : (getRootPath() ? path.resolve(getRootPath()!) : undefined)
    const rootPrefix = resolvedRoot ? `${resolvedRoot}${path.sep}` : undefined

    const framework = getEnvPreviewConfig('framework', 'auto', resolvedRoot)
    const viteMode = getEnvPreviewConfig('viteMode', 'development', resolvedRoot)
    const viteEnvDir = getEnvPreviewConfig('viteEnvDir', '', resolvedRoot)
    const viteEnvPrefix = getEnvPreviewConfig('viteEnvPrefix', ['VITE_'] as any, resolvedRoot)
    const viteIncludeLocalInTest = getEnvPreviewConfig('viteIncludeLocalInTest', false, resolvedRoot)
    const viteHoverRefreshMs = getEnvPreviewConfig('viteHoverRefreshMs', 2000, resolvedRoot)
    const wantsVite = framework === 'vite'
      || (framework === 'auto' && resolvedRoot && (viteEnvDir || shouldUseViteMode(envKey, resolvedRoot, viteMode, envCacheMap, { envDir: viteEnvDir, envPrefix: viteEnvPrefix, includeLocalInTest: viteIncludeLocalInTest })))

    const locations: vscode.Location[] = []

    if (wantsVite && resolvedRoot) {
      const viteFiles = getViteEnvFiles(resolvedRoot, viteMode, viteEnvDir, { includeLocalInTest: viteIncludeLocalInTest })
      const now = Date.now()
      const refreshOutsideRoot = rootPrefix ? !path.resolve(viteFiles[0]).startsWith(rootPrefix) : false
      await Promise.all(viteFiles.map(async (f) => {
        const cached = envCacheMap.get(f)
        if (!cached) {
          await readEnv(f).catch(() => undefined)
          return
        }
        if (refreshOutsideRoot && viteHoverRefreshMs > 0 && now - cached.readAt > viteHoverRefreshMs)
          await readEnv(f).catch(() => undefined)
      }))

      const searchKey = resolveViteSearchKey(envKey, resolvedRoot, viteMode, envCacheMap, { envDir: viteEnvDir, envPrefix: viteEnvPrefix, includeLocalInTest: viteIncludeLocalInTest })
      for (const fileUrl of viteFiles) {
        const entry = envCacheMap.get(fileUrl)
        if (!entry)
          continue
        if (entry.env[searchKey] === undefined)
          continue
        const loc = findKeyPosition(entry.content, searchKey)
        const start = loc ? new vscode.Position(loc.startLine, loc.startChar) : new vscode.Position(0, 0)
        locations.push(createDefinitionLocation(fileUrl, start))
      }
    }
    else {
      for (const [fileUrl, { env, content }] of envCacheMap.entries()) {
        if (rootPrefix) {
          const resolvedFile = path.resolve(fileUrl)
          if (!resolvedFile.startsWith(rootPrefix))
            continue
        }

        let searchKey = envKey
        if (env[searchKey] === undefined) {
          if (env[`VITE_${searchKey}`] !== undefined)
            searchKey = `VITE_${searchKey}`
          else
            continue
        }
        const loc = findKeyPosition(content, searchKey)
        const start = loc ? new vscode.Position(loc.startLine, loc.startChar) : new vscode.Position(0, 0)
        locations.push(createDefinitionLocation(fileUrl, start))
      }
    }

    return locations.length > 0 ? locations : undefined
  })

  registerHoverProvider(selectors, async (document: vscode.TextDocument, position: Position) => {
    const envKey = getEnvKey(position)
    if (!envKey)
      return

    // 1. 从 envCacheMap 中获取 fileUrl 和 envObject
    // 2. 生成 hoverMarkdown, 小图标点击直接打开到对应 env 文件的变量上, 提供快速修改跳转到对应文件 和 复制变量值的命令
    const results: { fileUrl: string, envValue: string, selection: [number, number, number, number], tag?: string }[] = []
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    const resolvedRoot = folder?.uri.fsPath ? path.resolve(folder.uri.fsPath) : (getRootPath() ? path.resolve(getRootPath()!) : undefined)
    const rootPrefix = resolvedRoot ? `${resolvedRoot}${path.sep}` : undefined

    const framework = getEnvPreviewConfig('framework', 'auto', resolvedRoot)
    const viteMode = getEnvPreviewConfig('viteMode', 'development', resolvedRoot)
    const viteEnvDir = getEnvPreviewConfig('viteEnvDir', '', resolvedRoot)
    const viteEnvPrefix = getEnvPreviewConfig('viteEnvPrefix', ['VITE_'] as any, resolvedRoot)
    const viteExpand = getEnvPreviewConfig('viteExpand', true, resolvedRoot)
    const viteIncludeLocalInTest = getEnvPreviewConfig('viteIncludeLocalInTest', false, resolvedRoot)
    const viteHoverRefreshMs = getEnvPreviewConfig('viteHoverRefreshMs', 2000, resolvedRoot)
    const wantsVite = framework === 'vite'
      || (framework === 'auto' && resolvedRoot && (viteEnvDir || shouldUseViteMode(envKey, resolvedRoot, viteMode, envCacheMap, { envDir: viteEnvDir, envPrefix: viteEnvPrefix, includeLocalInTest: viteIncludeLocalInTest })))

    let summary: {
      title: string
      value: string
      copyValue?: string
      copyLabel?: string
      secondaryCopy?: { label: string, value: string }
    } | undefined
    let meta: { title: string, lines: string[] } | undefined
    let hoverKey = envKey
    let maskKey = envKey
    let didUseVite = false

    if (wantsVite && resolvedRoot) {
      didUseVite = true
      const viteFiles = getViteEnvFiles(resolvedRoot, viteMode, viteEnvDir, { includeLocalInTest: viteIncludeLocalInTest })
      const now = Date.now()
      const refreshOutsideRoot = rootPrefix ? !path.resolve(viteFiles[0]).startsWith(rootPrefix) : false
      await Promise.all(viteFiles.map(async (f) => {
        const cached = envCacheMap.get(f)
        if (!cached) {
          await readEnv(f).catch(() => undefined)
          return
        }
        if (refreshOutsideRoot && viteHoverRefreshMs > 0 && now - cached.readAt > viteHoverRefreshMs)
          await readEnv(f).catch(() => undefined)
      }))

      const searchKey = resolveViteSearchKey(envKey, resolvedRoot, viteMode, envCacheMap, { envDir: viteEnvDir, envPrefix: viteEnvPrefix, includeLocalInTest: viteIncludeLocalInTest })
      if (searchKey !== envKey)
        hoverKey = `${envKey} → ${searchKey}`
      maskKey = searchKey

      const { files, effective, effectiveExpanded, effectiveFile } = computeViteEffectiveValue(searchKey, resolvedRoot, viteMode, envCacheMap, { envDir: viteEnvDir, expand: viteExpand, includeLocalInTest: viteIncludeLocalInTest })
      if (effective !== undefined) {
        const value = effectiveExpanded ?? effective
        summary = {
          title: `Vite effective (mode: ${viteMode}${viteExpand ? ', expanded' : ''})`,
          value,
          copyValue: value,
          copyLabel: 'Copy Effective',
          secondaryCopy: (viteExpand && effectiveExpanded !== undefined && effectiveExpanded !== effective)
            ? { label: 'Copy Raw Effective', value: effective }
            : undefined,
        }
      }
      meta = {
        title: 'Vite env chain',
        lines: files.map((fileUrl) => {
          const label = path.basename(fileUrl)
          const entry = envCacheMap.get(fileUrl)
          if (!entry)
            return `${label}: missing`

          const loc = entry.env[searchKey] !== undefined ? findKeyPosition(entry.content, searchKey) : undefined
          const selection: [number, number, number, number] = loc
            ? [loc.startLine, loc.startChar, loc.endLine, loc.endChar]
            : [0, 0, 0, 0]
          const openUri = encodeURI(`command:env-preview.open?${encodeURIComponent(JSON.stringify([fileUrl, selection]))}`)
          const link = `[${label}](${openUri} "Open env file")`

          if (entry.env[searchKey] === undefined)
            return `${link}: unset`
          if (fileUrl === effectiveFile)
            return `${link}: ${loc ? 'effective' : 'effective, unlocated'}`
          return `${link}: ${loc ? 'overridden' : 'overridden, unlocated'}`
        }),
      }
      const availableModes = await discoverViteModes(resolvedRoot, viteEnvDir)
      if (availableModes.length > 0) {
        meta.lines.push(`available modes: ${availableModes.join(', ')} (set env-preview.viteMode)`)
      }
      const setModeCommandUri = encodeURI(`command:env-preview.setViteMode?${encodeURIComponent(JSON.stringify([resolvedRoot, viteEnvDir]))}`)
      meta.lines.push(`[Set Vite Mode](${setModeCommandUri} "选择/切换 Vite mode")`)
      const setEnvDirUri = encodeURI(`command:env-preview.setViteEnvDir?${encodeURIComponent(JSON.stringify([resolvedRoot]))}`)
      const setEnvPrefixUri = encodeURI(`command:env-preview.setViteEnvPrefix?${encodeURIComponent(JSON.stringify([resolvedRoot]))}`)
      meta.lines.push(`[Set Vite envDir](${setEnvDirUri} "设置 Vite envDir") [Set Vite envPrefix](${setEnvPrefixUri} "设置 Vite envPrefix")`)

      for (const fileUrl of files) {
        const entry = envCacheMap.get(fileUrl)
        if (!entry)
          continue
        const { env, content } = entry
        if (env[searchKey] === undefined)
          continue
        const loc = findKeyPosition(content, searchKey)
        const selection: [number, number, number, number] = loc
          ? [loc.startLine, loc.startChar, loc.endLine, loc.endChar]
          : [0, 0, 0, 0]
        results.push({
          fileUrl,
          envValue: env[searchKey] ?? '',
          selection,
          tag: loc
            ? (fileUrl === effectiveFile ? 'effective' : 'overridden')
            : (fileUrl === effectiveFile ? 'effective, unlocated' : 'overridden, unlocated'),
        })
      }
    }
    else {
      for (const [fileUrl, { env, content }] of envCacheMap.entries()) {
        if (rootPrefix) {
          const resolvedFile = path.resolve(fileUrl)
          if (!resolvedFile.startsWith(rootPrefix))
            continue
        }
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
          envValue: env[searchKey] ?? '',
          selection: [loc.startLine, loc.startChar, loc.endLine, loc.endChar],
        })
      }
    }

    // In Vite mode, still show hover even when the key is missing/unlocatable,
    // so users can see the chain and quickly switch modes.
    if (results.length === 0 && !didUseVite)
      return

    if (!didUseVite)
      results.sort((a, b) => a.fileUrl.localeCompare(b.fileUrl))

    const markdown = createMarkdownString()
    markdown.isTrusted = true
    const maskSecrets = getEnvPreviewConfig('maskSecrets', false, resolvedRoot)
    const maskKeyPattern = getEnvPreviewConfig('maskKeyPattern', '', resolvedRoot)
    const unmaskKeyPattern = getEnvPreviewConfig('unmaskKeyPattern', '', resolvedRoot)
    const maskThisKey = shouldMaskKey(maskKey, { maskSecrets, maskKeyPattern, unmaskKeyPattern })
    const maskHead = getEnvPreviewConfig('maskHead', 4, resolvedRoot)
    const maskTail = getEnvPreviewConfig('maskTail', 0, resolvedRoot)
    const mdText = formatHoverMarkdown(hoverKey, results, { maskSecrets: maskThisKey, maskHead, maskTail, summary, meta })
    markdown.appendMarkdown(mdText)
    return { contents: [markdown] }
  })
})
