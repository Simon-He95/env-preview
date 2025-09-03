import { getPosition as calcPosition } from '@vscode-use/utils'
import { escapeRegExp } from './utils/regex'

export interface KeyLocation {
  startOffset: number
  endOffset: number
  startLine: number
  startChar: number
  endLine: number
  endChar: number
}

// Find the position of a key declaration in a .env file content.
// Supports optional `export`, spaces around `=`, and basic inline comments.
export interface FindKeyOptions { strategy?: 'first' | 'last' }
/**
 * Find the position of a key declaration in a .env file content.
 *
 * Behavior:
 * - Supports optional `export` prefix and flexible spacing around `=`.
 * - Escapes the provided key to avoid RegExp injection.
 * - Returns a KeyLocation for either the first match (strategy: 'first')
 *   or the last match (strategy: 'last', default). The 'last' strategy
 *   follows dotenv-like semantics where later declarations override earlier ones.
 *
 * Notes:
 * - The returned `startOffset`/`endOffset` point to the key text (endOffset is exclusive).
 * - This function intentionally matches per-line; multi-line values are out of scope.
 *
 * @param content full .env file content
 * @param key the literal key to find (will be escaped internally)
 * @param options strategy to choose 'first' or 'last' match (default 'last')
 */
export function findKeyPosition(content: string, key: string, options: FindKeyOptions = {}): KeyLocation | undefined {
  // split by lines to find the exact line
  const lines = content.split(/\r?\n/)
  let offset = 0
  const safeKey = escapeRegExp(key)
  const lineRegex = new RegExp(`^\\s*(?:export\\s+)?(${safeKey})\\s*=\\s*(.*)$`)
  const { strategy = 'last' } = options
  let lastLoc: KeyLocation | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(lineRegex)
    if (m) {
      const matchedLine = line
      // compute start offset based on the matched key group, not the '=' position
      const keyIndex = matchedLine.indexOf(m[1])
      const startOffset = offset + keyIndex
      const endOffset = startOffset + m[1].length
      const startPos = calcPosition(startOffset, content).position
      const endPos = calcPosition(endOffset, content).position
      const loc: KeyLocation = {
        startOffset,
        endOffset,
        startLine: startPos.line,
        startChar: startPos.character,
        endLine: endPos.line,
        endChar: endPos.character,
      }
      if (strategy === 'first')
        return loc
      lastLoc = loc
    }
    // +1 for newline
    offset += line.length + 1
  }
  return lastLoc
}
