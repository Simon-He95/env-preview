import type { EnvCacheEntry } from './loadEnvFiles'
import { readdir } from 'node:fs/promises'

import path from 'node:path'

function normalizePrefixes(envPrefix?: unknown) {
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

function resolveEnvDir(root: string, envDir?: string) {
  const resolvedRoot = path.resolve(root)
  const dir = (envDir || '').trim()
  if (!dir)
    return resolvedRoot
  if (path.isAbsolute(dir))
    return path.resolve(dir)
  return path.resolve(resolvedRoot, dir)
}

export function extractViteModesFromFilenames(names: string[]) {
  const modes = new Set<string>()
  for (const name of names) {
    if (!name.startsWith('.env.'))
      continue
    let rest = name.slice('.env.'.length)
    if (rest === 'local' || rest.length === 0)
      continue
    if (rest.endsWith('.local'))
      rest = rest.slice(0, -'.local'.length)
    if (rest.length === 0)
      continue
    modes.add(rest)
  }
  return [...modes].sort()
}

const discoveredModesCache = new Map<string, { at: number, modes: string[] }>()

export async function discoverViteModes(root: string, envDir?: string) {
  const base = resolveEnvDir(root, envDir)
  const now = Date.now()
  const cached = discoveredModesCache.get(base)
  if (cached && now - cached.at < 5000)
    return cached.modes

  try {
    const entries = await readdir(base, { withFileTypes: true })
    const names = entries.filter(e => e.isFile()).map(e => e.name)
    const modes = extractViteModesFromFilenames(names)
    discoveredModesCache.set(base, { at: now, modes })
    return modes
  }
  catch {
    discoveredModesCache.set(base, { at: now, modes: [] })
    return []
  }
}

export function getViteEnvFiles(root: string, mode: string, envDir?: string, options: { includeLocalInTest?: boolean } = {}) {
  const base = resolveEnvDir(root, envDir)
  const includeLocalInTest = options.includeLocalInTest === true
  // Vite does not load *.local in test mode by default (to keep tests deterministic).
  if (mode === 'test' && !includeLocalInTest) {
    return [
      path.join(base, '.env'),
      path.join(base, `.env.${mode}`),
    ]
  }
  return [
    path.join(base, '.env'),
    path.join(base, '.env.local'),
    path.join(base, `.env.${mode}`),
    path.join(base, `.env.${mode}.local`),
  ]
}

export function shouldUseViteMode(envKey: string, root: string, mode: string, cache: Map<string, EnvCacheEntry>, options: {
  envDir?: string
  envPrefix?: unknown
  includeLocalInTest?: boolean
} = {}) {
  const prefixes = normalizePrefixes(options.envPrefix)
  if (prefixes.some(p => envKey.startsWith(p)))
    return true

  const files = getViteEnvFiles(root, mode, options.envDir, { includeLocalInTest: options.includeLocalInTest })
  for (const file of files) {
    const entry = cache.get(file)
    if (!entry)
      continue
    if (entry.env[envKey] !== undefined)
      return true
    for (const prefix of prefixes) {
      const prefixed = `${prefix}${envKey}`
      if (entry.env[prefixed] !== undefined)
        return true
    }
  }
  return false
}

export function resolveViteSearchKey(envKey: string, root: string, mode: string, cache: Map<string, EnvCacheEntry>, options: {
  envDir?: string
  envPrefix?: unknown
  includeLocalInTest?: boolean
} = {}) {
  const prefixes = normalizePrefixes(options.envPrefix)
  if (prefixes.some(p => envKey.startsWith(p)))
    return envKey

  const files = getViteEnvFiles(root, mode, options.envDir, { includeLocalInTest: options.includeLocalInTest })
  for (const file of files) {
    const entry = cache.get(file)
    if (!entry)
      continue
    if (entry.env[envKey] !== undefined)
      return envKey
    for (const prefix of prefixes) {
      const prefixed = `${prefix}${envKey}`
      if (entry.env[prefixed] !== undefined)
        return prefixed
    }
  }
  return envKey
}

function mergeEnv(files: string[], cache: Map<string, EnvCacheEntry>) {
  const merged: Record<string, string> = {}
  for (const file of files) {
    const entry = cache.get(file)
    if (!entry)
      continue
    for (const [k, v] of Object.entries(entry.env)) {
      // dotenv.parse always returns strings, but keep it defensive
      if (typeof v === 'string')
        merged[k] = v
    }
  }
  return merged
}

function expandValue(
  value: string,
  env: Record<string, string>,
  memo: Map<string, string>,
  stack: Set<string>,
  depth: number,
): string {
  if (depth > 20)
    return value

  let out = ''
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    const next = value[i + 1]

    // escape: \$ -> $
    if (ch === '\\' && next === '$') {
      out += '$'
      i++
      continue
    }

    if (ch !== '$') {
      out += ch
      continue
    }

    // ${VAR}
    if (next === '{') {
      const end = value.indexOf('}', i + 2)
      if (end === -1) {
        out += ch
        continue
      }
      const name = value.slice(i + 2, end)
      const replacement = expandVarToken(name, env, memo, stack, depth + 1, value.slice(i, end + 1))
      out += replacement
      i = end
      continue
    }

    // $VAR
    let j = i + 1
    while (j < value.length && /[A-Z0-9_]/.test(value[j]))
      j++
    const name = value.slice(i + 1, j)
    if (!name) {
      out += '$'
      continue
    }
    const replacement = expandVarToken(name, env, memo, stack, depth + 1, value.slice(i, j))
    out += replacement
    i = j - 1
  }
  return out
}

function expandVarToken(
  name: string,
  env: Record<string, string>,
  memo: Map<string, string>,
  stack: Set<string>,
  depth: number,
  originalToken: string,
) {
  if (!(name in env))
    return originalToken
  if (stack.has(name))
    return originalToken
  const cached = memo.get(name)
  if (cached !== undefined)
    return cached

  stack.add(name)
  const expanded = expandValue(env[name], env, memo, stack, depth)
  stack.delete(name)
  memo.set(name, expanded)
  return expanded
}

export function expandEnv(env: Record<string, string>) {
  const memo = new Map<string, string>()
  const stack = new Set<string>()
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    out[k] = expandValue(v, env, memo, stack, 0)
  }
  return out
}

export function computeViteEffectiveValue(
  searchKey: string,
  root: string,
  mode: string,
  cache: Map<string, EnvCacheEntry>,
  options: { envDir?: string, expand?: boolean, includeLocalInTest?: boolean } = {},
) {
  const files = getViteEnvFiles(root, mode, options.envDir, { includeLocalInTest: options.includeLocalInTest })
  let effective: string | undefined
  let effectiveFile: string | undefined
  for (const file of files) {
    const entry = cache.get(file)
    if (!entry)
      continue
    const val = entry.env[searchKey]
    if (val !== undefined) {
      effective = val
      effectiveFile = file
    }
  }

  let effectiveExpanded: string | undefined
  if (options.expand && effective !== undefined) {
    const merged = mergeEnv(files, cache)
    const expanded = expandEnv(merged)
    effectiveExpanded = expanded[searchKey]
  }

  return { files, effective, effectiveExpanded, effectiveFile }
}
