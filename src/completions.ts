import type { EnvCacheEntry } from './loadEnvFiles'
import path from 'node:path'
import { getViteEnvFiles } from './viteEnv'

const viteBuiltins = new Set(['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'])

export type EnvCompletionContext
  = | { kind: 'process-dot', partial: string }
    | { kind: 'process-bracket', partial: string, quote?: '\'' | '"' }
    | { kind: 'import-dot', partial: string }
    | { kind: 'import-bracket', partial: string, quote?: '\'' | '"' }
    | { kind: 'bun-dot', partial: string }
    | { kind: 'deno-get', partial: string, quote?: '\'' | '"' }

export function detectEnvCompletionContext(prefixText: string): EnvCompletionContext | undefined {
  const processDot = /process\.env\??\.(\w*)$/.exec(prefixText)
  if (processDot)
    return { kind: 'process-dot', partial: processDot[1] || '' }

  const processBracket = /process\.env(?:\?\.)?\[\s*(['"]?)(\w*)$/i.exec(prefixText)
  if (processBracket) {
    const q = processBracket[1] as any
    return { kind: 'process-bracket', partial: processBracket[2] || '', quote: (q === '\'' || q === '"') ? q : undefined }
  }

  const importDot = /import\.meta\.env\??\.(\w*)$/.exec(prefixText)
  if (importDot)
    return { kind: 'import-dot', partial: importDot[1] || '' }

  const importBracket = /import\.meta\.env(?:\?\.)?\[\s*(['"]?)(\w*)$/i.exec(prefixText)
  if (importBracket) {
    const q = importBracket[1] as any
    return { kind: 'import-bracket', partial: importBracket[2] || '', quote: (q === '\'' || q === '"') ? q : undefined }
  }

  const bunDot = /Bun\.env\??\.(\w*)$/.exec(prefixText)
  if (bunDot)
    return { kind: 'bun-dot', partial: bunDot[1] || '' }

  const denoGet = /Deno\.env\.get\(\s*(['"]?)(\w*)$/i.exec(prefixText)
  if (denoGet) {
    const q = denoGet[1] as any
    return { kind: 'deno-get', partial: denoGet[2] || '', quote: (q === '\'' || q === '"') ? q : undefined }
  }
}

export function collectEnvKeys(entries: Iterable<EnvCacheEntry>) {
  const keys = new Set<string>()
  for (const entry of entries) {
    for (const k of Object.keys(entry.env || {})) {
      if (k)
        keys.add(k)
    }
  }
  return [...keys].sort()
}

export function collectRootEnvKeys(envCacheMap: Map<string, EnvCacheEntry>, root: string) {
  const resolvedRoot = path.resolve(root)
  const prefix = `${resolvedRoot}${path.sep}`
  const entries: EnvCacheEntry[] = []
  for (const [fileUrl, entry] of envCacheMap.entries()) {
    const resolvedFile = path.resolve(fileUrl)
    if (resolvedFile.startsWith(prefix))
      entries.push(entry)
  }
  return collectEnvKeys(entries)
}

export function normalizePrefixes(envPrefix: unknown) {
  const fallback = ['VITE_']
  if (Array.isArray(envPrefix)) {
    const arr = envPrefix
      .filter(v => typeof v === 'string')
      .map(v => v.trim())
      .filter(Boolean)
    return arr.length > 0 ? arr : fallback
  }
  if (typeof envPrefix === 'string') {
    const parts = envPrefix
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    return parts.length > 0 ? parts : fallback
  }
  return fallback
}

export function collectViteEnvKeys(
  envCacheMap: Map<string, EnvCacheEntry>,
  root: string,
  mode: string,
  envDir: string,
  includeLocalInTest: boolean,
  envPrefix: unknown,
) {
  const files = getViteEnvFiles(root, mode, envDir, { includeLocalInTest })
  const prefixes = normalizePrefixes(envPrefix)
  const keys = new Set<string>()
  for (const fileUrl of files) {
    const entry = envCacheMap.get(fileUrl)
    if (!entry)
      continue
    for (const k of Object.keys(entry.env || {})) {
      if (!k)
        continue
      if (viteBuiltins.has(k))
        continue
      // only suggest keys that match prefixes for import.meta.env usage
      if (!prefixes.some(p => k.startsWith(p)))
        continue
      keys.add(k)
    }
  }
  return [...keys].sort()
}
