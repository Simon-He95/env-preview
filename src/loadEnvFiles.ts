// loadEnvFiles 加载所有 .env.xxx 的文件
import { addEventListener, getRootPath, watchFiles } from '@vscode-use/utils';
import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { parse } from 'dotenv';

const cwd = getRootPath()!
export const envCacheMap = new Map()
export async function loadEnvFiles() {
  const files = await glob('**/.env.*', { onlyFiles: true, cwd, absolute: true })

  files.forEach(filepath => {
    // 如果已经在缓存中就跳过
    if (envCacheMap.has(filepath))
      return

    readEnv(filepath)
  })
  return watchFiles(files, {
    onChange(e) {
      const filepath = e.path
      // 更新文件
      readEnv(filepath)
    },
    onDelete(e) {
      envCacheMap.delete(e.path)
    }
  })
}

export async function readEnv(file: string) {
  const content = await readFile(file, 'utf-8')
  try {
    const envObject = parse(content); // 解析为对象
    envCacheMap.set(file, envObject)
    return envObject;
  } catch (error) {
    // 文件编辑中可能有错误
  }
}

export async function loadEnv() {
  // 监听 .env.xx 文件的新增，然后重新执行 loadEnvFiles()
  let dispose = await loadEnvFiles()
  addEventListener('file-create', async (files) => {
    let isNeedUpdate = false
    files.forEach((file: any) => {
      const newUri = file.path
      if (/\.env\.*/.test(newUri)) {
        isNeedUpdate = true
      }
    })
    if (isNeedUpdate) {
      dispose()
      dispose = await loadEnvFiles()
    }
  })

  addEventListener('rename', async (files) => {
    let isNeedUpdate = false
    files.forEach((file: any) => {
      const oldUri = file.oldUri.path
      const newUri = file.newUri.path
      if (envCacheMap.has(oldUri)) {
        envCacheMap.delete(oldUri)
      }
      if (/\.env\.*/.test(newUri)) {
        isNeedUpdate = true
      }
    })
    if (isNeedUpdate) {
      dispose()
      dispose = await loadEnvFiles()
    }
  })
}
