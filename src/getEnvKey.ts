import type { Position } from 'vscode'
import { getKeyWords, getLineText } from '@vscode-use/utils'

export function getEnvKey(position: Position): string | undefined {
  const regexPatterns = [
    'import\\.meta\\.env\\??\\.([A-Z0-9_]+)',
    'import\\.meta\\.env(?:\\?\\.)?\\[[\'"]([A-Z0-9_]+)[\'"]\\]',
    'process\\.env\\??\\.([A-Z0-9_]+)',
    'process\\.env(?:\\?\\.)?\\[[\'"]([A-Z0-9_]+)[\'"]\\]',
    'Deno\\.env\\.get\\([\'"]([A-Z0-9_]+)[\'"]\\)',
    'Bun\\.env\\??\\.([A-Z0-9_]+)',
  ]
  const viteBuiltins = new Set(['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'])
  const { line, character } = position
  const lineText = getLineText(line) || ''
  for (const pattern of regexPatterns) {
    const regex = new RegExp(pattern, 'g')
    // use matchAll with a fresh global regex to iterate matches reliably

    for (const match of lineText.matchAll(regex)) {
      const fullMatchStart = match.index ?? -1
      if (fullMatchStart < 0)
        continue
      const groupText = match[1]
      // ignore Vite built-in import.meta.env.* values (these are not sourced from .env)
      if (pattern.startsWith('import\\.meta\\.env') && viteBuiltins.has(groupText))
        continue
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
  // ignore Vite built-in import.meta.env.* values when we only have a keyword fallback
  if (lineText.includes('import.meta.env') && viteBuiltins.has(candidate))
    return undefined
  if (candidate.toLowerCase() === candidate)
    return undefined

  return candidate
}
