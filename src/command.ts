import { createRange, jumpToLine, message, registerCommands, setCopyText } from '@vscode-use/utils'

export function runCommands() {
  registerCommands([
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
  ])
}
