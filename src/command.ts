import path from 'node:path'
import process from 'node:process'
import { createInput, createRange, createSelect, getConfiguration, getRootPath, jumpToLine, message, registerCommands, setConfiguration, setCopyText } from '@vscode-use/utils'
import * as vscode from 'vscode'
import { readEnv } from './loadEnvFiles'
import { discoverViteModes, getViteEnvFiles } from './viteEnv'

export function runCommands() {
  return registerCommands([
    [
      'env-preview.open',
      async (fileUrl, selection: [number, number, number, number]) => {
        jumpToLine(createRange(...selection), fileUrl)
      },
    ],
    [
      'env-preview.copy',
      (envValue: string) => {
        setCopyText(envValue).then(() => {
          message('复制成功')
        })
      },
    ],
    [
      'env-preview.setViteMode',
      async (root?: string, envDir?: string) => {
        const resolvedRoot = root ? path.resolve(root) : (getRootPath() || process.cwd())
        const folder = vscode.workspace.workspaceFolders?.find(f => path.resolve(f.uri.fsPath) === resolvedRoot)
        const scopedConfig = folder ? vscode.workspace.getConfiguration('env-preview', folder.uri) : undefined
        const resolvedEnvDir = typeof envDir === 'string'
          ? envDir
          : (scopedConfig?.get('viteEnvDir') ?? getConfiguration('env-preview.viteEnvDir', ''))
        const modes = await discoverViteModes(resolvedRoot, resolvedEnvDir)
        if (modes.length === 0) {
          message('未发现可用的 Vite mode（未找到 .env.<mode> 文件）')
          return
        }
        const current = (scopedConfig?.get('viteMode') ?? getConfiguration('env-preview.viteMode', 'development')) as string
        const picked = await createSelect(modes, { placeholder: `Select Vite mode (current: ${current})` })
        if (!picked)
          return
        if (scopedConfig)
          await scopedConfig.update('viteMode', picked, vscode.ConfigurationTarget.WorkspaceFolder)
        else
          await setConfiguration('env-preview.viteMode', picked, vscode.ConfigurationTarget.Workspace)

        // warm cache for the newly selected mode
        const includeLocalInTest = (scopedConfig?.get('viteIncludeLocalInTest') ?? getConfiguration('env-preview.viteIncludeLocalInTest', false)) as boolean
        const files = getViteEnvFiles(resolvedRoot, picked, resolvedEnvDir, { includeLocalInTest })
        await Promise.all(files.map(f => readEnv(f).catch(() => undefined)))

        message(`已切换 Vite mode: ${picked}`)
      },
    ],
    [
      'env-preview.setViteEnvDir',
      async (root?: string) => {
        const resolvedRoot = root ? path.resolve(root) : (getRootPath() || process.cwd())
        const folder = vscode.workspace.workspaceFolders?.find(f => path.resolve(f.uri.fsPath) === resolvedRoot)
        const scopedConfig = folder ? vscode.workspace.getConfiguration('env-preview', folder.uri) : undefined

        const current = (scopedConfig?.get('viteEnvDir') ?? getConfiguration('env-preview.viteEnvDir', '')) as string
        const picked = await createInput({
          title: 'Env Preview: Set Vite envDir',
          value: current || '',
          placeHolder: 'Vite envDir (absolute or relative to workspace folder); empty to clear',
        })
        if (picked === undefined)
          return
        const next = picked.trim()
        if (scopedConfig)
          await scopedConfig.update('viteEnvDir', next.length > 0 ? next : undefined, vscode.ConfigurationTarget.WorkspaceFolder)
        else
          await setConfiguration('env-preview.viteEnvDir', next.length > 0 ? next : undefined, vscode.ConfigurationTarget.Workspace)
        message(`已更新 Vite envDir${next ? `: ${next}` : '（已清空）'}`)
      },
    ],
    [
      'env-preview.setViteEnvPrefix',
      async (root?: string) => {
        const resolvedRoot = root ? path.resolve(root) : (getRootPath() || process.cwd())
        const folder = vscode.workspace.workspaceFolders?.find(f => path.resolve(f.uri.fsPath) === resolvedRoot)
        const scopedConfig = folder ? vscode.workspace.getConfiguration('env-preview', folder.uri) : undefined

        const current = (scopedConfig?.get('viteEnvPrefix') ?? getConfiguration('env-preview.viteEnvPrefix', ['VITE_'])) as any
        const currentStr = Array.isArray(current) ? current.join(',') : String(current || '')
        const picked = await createInput({
          title: 'Env Preview: Set Vite envPrefix',
          value: currentStr,
          placeHolder: 'Comma-separated prefixes, e.g. VITE_,PUBLIC_ ; empty to clear',
        })
        if (picked === undefined)
          return
        const nextStr = picked.trim()
        const next = nextStr.length === 0
          ? undefined
          : nextStr.split(',').map(s => s.trim()).filter(Boolean)

        if (scopedConfig)
          await scopedConfig.update('viteEnvPrefix', next, vscode.ConfigurationTarget.WorkspaceFolder)
        else
          await setConfiguration('env-preview.viteEnvPrefix', next, vscode.ConfigurationTarget.Workspace)

        message(`已更新 Vite envPrefix${next ? `: ${next.join(', ')}` : '（已清空）'}`)
      },
    ],
  ])
}
