import type { Position } from 'vscode'
import { getKeyWords, getLineText } from '@vscode-use/utils'

export function getEnvKey(position: Position) {
  const regexList = [
    /import\.meta\.env\.(VITE_\w*)/g,
    /process\.env\.([A-Z0-9_]+)/g,
  ]
  const { line, character } = position
  const lineText = getLineText(line)!
  for (const regex of regexList) {
    regex.lastIndex = 0 // 避免 g 标志带来的 lastIndex 问题
    let match
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(lineText)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (character >= start && character <= end) {
        return match[1]
      }
    }
  }
  const keyWords = getKeyWords(position)
  if (!keyWords)
    return

  if (keyWords[0].toLowerCase() === keyWords[0])
    return

  return keyWords
}
