import { readFile } from 'node:fs/promises'
// loadEnvFiles 加载所有 .env.xxx 的文件
import { addEventListener, getRootPath, watchFiles } from '@vscode-use/utils'
import { parse } from 'dotenv'
import { glob } from 'tinyglobby'

const cwd = getRootPath()!
export const envCacheMap = new Map<string, { env: Record<string, string>, content: string }>()
export async function loadEnvFiles() {
  // include plain .env and any .env* files
  const files = await glob(['.env', '**/.env*'], { onlyFiles: true, cwd, absolute: true })

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
  const content = await readFile(file, 'utf-8')
  try {
    const env = parse(content) // 解析为对象
    envCacheMap.set(file, {
      env,
      content,
    })
    return env
  }
  catch (error) {
    // 文件编辑中可能有错误
    console.error('loadEnvFiles error', error)
  }
}

export async function loadEnv() {
  // 监听 .env.xx 文件的新增，然后重新执行 loadEnvFiles()
  let dispose = await loadEnvFiles()
  // debounce full reload on file-create/rename events
  let reloadTimer: NodeJS.Timeout | undefined
  const scheduleReload = async () => {
    if (reloadTimer)
      clearTimeout(reloadTimer)
    reloadTimer = setTimeout(async () => {
      try {
        dispose()
      }
      catch {}
      dispose = await loadEnvFiles()
      reloadTimer = undefined
    }, 300)
  }

  addEventListener('file-create', ({ files }) => {
    for (const file of files) {
      const newUri = file.path
      if (/\.env(?:\.|$)/.test(newUri)) {
        scheduleReload()
        break
      }
    }
  })

  addEventListener('rename', ({ files }) => {
    let shouldReload = false
    for (const file of files) {
      const oldUri = file.oldUri.path
      const newUri = file.newUri.path
      if (envCacheMap.has(oldUri)) {
        envCacheMap.delete(oldUri)
      }
      if (/\.env(?:\.|$)/.test(newUri) || /\.env(?:\.|$)/.test(oldUri)) {
        shouldReload = true
      }
    }
    if (shouldReload)
      scheduleReload()
  })
}
