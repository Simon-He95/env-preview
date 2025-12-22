import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// loadEnvFiles 加载所有 .env.xxx 的文件
import { addEventListener, getRootPath, watchFiles } from '@vscode-use/utils'
import { parse } from 'dotenv'
import { glob } from 'tinyglobby'
import * as vscode from 'vscode'

export interface EnvCacheEntry {
  env: Record<string, string>
  content: string
  readAt: number
}

export const envCacheMap = new Map<string, EnvCacheEntry>()

function getGlobList(value: unknown, fallback: string[]) {
  if (Array.isArray(value))
    return value.filter(v => typeof v === 'string' && v.trim().length > 0)
  if (typeof value === 'string' && value.trim().length > 0)
    return [value.trim()]
  return fallback
}

function getEnvFileGlobs(root: string) {
  const config = vscode.workspace.getConfiguration('env-preview', vscode.Uri.file(root))
  const include = getGlobList(config.get('include'), ['.env', '**/.env', '**/.env.*'])
  const exclude = getGlobList(config.get('exclude'), [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
  ])
  return { include, exclude }
}

function getActiveRootPath() {
  return getRootPath() || process.cwd()
}

function isEnvLikePath(filepath: string) {
  return /\.env(?:\.|$)/.test(filepath)
}

function resolveRootForPath(filepath: string, knownRoots: string[]) {
  const normalizedFile = path.resolve(filepath)
  const matched = knownRoots
    .map(r => path.resolve(r))
    .filter(r => normalizedFile === r || normalizedFile.startsWith(r + path.sep))
    .sort((a, b) => b.length - a.length)[0]
  return matched
}

export async function loadEnvFiles(root = getActiveRootPath()) {
  // include plain .env and any .env* files
  const { include, exclude } = getEnvFileGlobs(root)
  const files = await glob(include, { onlyFiles: true, cwd: root, absolute: true, dot: true, ignore: exclude })

  // read files in parallel but skip cached entries
  await Promise.all(
    files
      .filter(filepath => !envCacheMap.has(filepath))
      .map(filepath => readEnv(filepath).catch(err => console.error('readEnv failed', filepath, err))),
  )

  // batch rapid change/delete events from the watcher
  let changeSet = new Set<string>()
  let deleteSet = new Set<string>()
  let timer: NodeJS.Timeout | undefined
  const flush = () => {
    // process deletes first
    if (deleteSet.size > 0) {
      for (const p of deleteSet) {
        envCacheMap.delete(p)
      }
      deleteSet = new Set()
    }
    if (changeSet.size > 0) {
      // read all changed files in parallel
      const promises: Promise<any>[] = []
      for (const p of changeSet) {
        promises.push(readEnv(p).catch(err => console.error('readEnv failed on change', p, err)))
      }
      changeSet = new Set()
      Promise.all(promises).catch(() => {})
    }
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const scheduleFlush = () => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(flush, 250)
  }

  return watchFiles(files, {
    onChange(e) {
      changeSet.add(e.path)
      // if a file was previously marked deleted, unmark it
      if (deleteSet.has(e.path))
        deleteSet.delete(e.path)
      scheduleFlush()
    },
    onDelete(e) {
      // if file was recently changed, remove it from changeSet
      if (changeSet.has(e.path))
        changeSet.delete(e.path)
      deleteSet.add(e.path)
      scheduleFlush()
    },
  })
}

export async function readEnv(file: string) {
  // normalize EOL for consistent offset/position calculations (utils split by '\n')
  const content = (await readFile(file, 'utf-8')).replace(/\r\n?/g, '\n')
  try {
    const env = parse(content) // 解析为对象
    envCacheMap.set(file, {
      env,
      content,
      readAt: Date.now(),
    })
    return env
  }
  catch (error) {
    // 文件编辑中可能有错误
    console.error('loadEnvFiles error', error)
  }
}

export async function loadEnv() {
  // Multi-root support: keep a watcher per root that has been activated.
  const disposers = new Map<string, () => void>()
  const reloadTimers = new Map<string, NodeJS.Timeout>()

  const ensureRootLoaded = async (root?: string) => {
    if (!root)
      return
    if (disposers.has(root))
      return
    const dispose = await loadEnvFiles(root)
    disposers.set(root, dispose)
  }

  const scheduleReloadRoot = (root: string) => {
    const prev = reloadTimers.get(root)
    if (prev)
      clearTimeout(prev)
    const t = setTimeout(async () => {
      reloadTimers.delete(root)
      const prevDispose = disposers.get(root)
      if (prevDispose) {
        try {
          prevDispose()
        }
        catch {}
      }
      const nextDispose = await loadEnvFiles(root)
      disposers.set(root, nextDispose)
    }, 300)
    reloadTimers.set(root, t)
  }

  // initial load (best-effort; depends on active editor)
  await ensureRootLoaded(getActiveRootPath())

  addEventListener('file-create', ({ files }) => {
    for (const file of files) {
      const newUri = file.path
      if (!isEnvLikePath(newUri))
        continue
      const root = resolveRootForPath(newUri, [...disposers.keys()]) || getActiveRootPath()
      void ensureRootLoaded(root).then(() => scheduleReloadRoot(root))
      break
    }
  })

  addEventListener('activeText-change', () => {
    const root = getRootPath()
    if (root)
      void ensureRootLoaded(root)
  })

  addEventListener('config-change', (e: any) => {
    if (e?.affectsConfiguration?.('env-preview')) {
      for (const root of disposers.keys()) {
        void ensureRootLoaded(root).then(() => scheduleReloadRoot(root))
      }
    }
  })

  addEventListener('rename', ({ files }) => {
    const knownRoots = [...disposers.keys()]
    const rootsToReload = new Set<string>()
    for (const file of files) {
      const oldUri = file.oldUri.path
      const newUri = file.newUri.path
      if (envCacheMap.has(oldUri))
        envCacheMap.delete(oldUri)

      if (isEnvLikePath(newUri)) {
        const root = resolveRootForPath(newUri, knownRoots) || getActiveRootPath()
        rootsToReload.add(root)
      }
      if (isEnvLikePath(oldUri)) {
        const root = resolveRootForPath(oldUri, knownRoots) || getActiveRootPath()
        rootsToReload.add(root)
      }
    }
    for (const root of rootsToReload) {
      void ensureRootLoaded(root).then(() => scheduleReloadRoot(root))
    }
  })
}
