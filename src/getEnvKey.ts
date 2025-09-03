import type { Position } from 'vscode'
import { getKeyWords, getLineText } from '@vscode-use/utils'

export function getEnvKey(position: Position): string | undefined {
  const regexPatterns = [
    'import\\.meta\\.env\\.(VITE_[A-Z0-9_]*)',
    'process\\.env\\.([A-Z0-9_]+)',
  ]
  const { line, character } = position
  const lineText = getLineText(line) || ''
  for (const pattern of regexPatterns) {
    const regex = new RegExp(pattern, 'g')
    // use matchAll with a fresh global regex to iterate matches reliably

    for (const match of lineText.matchAll(regex)) {
      const fullMatchStart = (match as any).index as number
      const groupText = match[1]
      const groupRelativeIndex = match[0].indexOf(groupText)
      const groupStart = fullMatchStart + (groupRelativeIndex === -1 ? 0 : groupRelativeIndex)
      const groupEnd = groupStart + groupText.length
      if (character >= groupStart && character <= groupEnd) {
        return groupText
      }
    }
  }
  const keyWords = getKeyWords(position)
  if (!keyWords || !Array.isArray(keyWords))
    return undefined

  // only accept PascalCase/UPPERCASE style env-like identifiers
  const candidate = keyWords[0]
  if (!candidate)
    return undefined
  if (candidate.toLowerCase() === candidate)
    return undefined

  return candidate
}
