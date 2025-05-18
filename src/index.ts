import { createExtension, registerHoverProvider } from '@vscode-use/utils'
import { loadEnv } from './loadEnvFiles'

export = createExtension(async () => {
  await loadEnv()
  registerHoverProvider('*', () => {
    // 监听 hover 变量前是否是 import.meta. 或 process.env 再继续
  })
}, () => {

})
