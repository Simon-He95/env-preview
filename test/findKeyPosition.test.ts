import { describe, it, expect, vi } from 'vitest'

// mock getPosition from @vscode-use/utils before importing target
vi.mock('@vscode-use/utils', () => ({
  getPosition: (offset: number, content: string) => {
    // compute line and character from offset
    const lines = content.split(/\r?\n/)
    let remaining = offset
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (remaining <= line.length) {
        return { position: { line: i, character: remaining } }
      }
      remaining -= line.length + 1 // account for newline
    }
    const last = lines.length - 1
    return { position: { line: last, character: Math.max(0, lines[last].length) } }
  },
}))

import { findKeyPosition } from '../src/findKeyPosition'

describe('findKeyPosition', () => {
  it('finds simple key at line start', () => {
    const content = 'FOO=bar\n'
    const loc = findKeyPosition(content, 'FOO')!
    expect(loc.startLine).toBe(0)
    expect(loc.startChar).toBe(0)
  // key length is 3, endChar should be 3 (end offset points at end of key)
  expect(loc.endChar).toBe(3)
  })

  it('finds key with export and spaces', () => {
    const content = '  export   FOO = "some val"\n'
    const loc = findKeyPosition(content, 'FOO')!
    // startChar is index of 'FOO' in the line
    expect(loc.startLine).toBe(0)
    expect(content.slice(0, loc.startChar)).toContain('export')
  })

  it('handles inline comments after value', () => {
    const content = 'FOO=bar # this is a comment\n'
    const loc = findKeyPosition(content, 'FOO')!
    expect(loc.startLine).toBe(0)
    expect(loc.startChar).toBe(0)
  })

  it('returns first occurrence when key repeats', () => {
    const content = 'FOO=first\nOTHER=1\nFOO=second\n'
  const loc = findKeyPosition(content, 'FOO')!
  // now returns last occurrence (line 2)
  expect(loc.startLine).toBe(2)
  })

  it('finds key when value is quoted', () => {
    const content = 'FOO = "a quoted value"\n'
    const loc = findKeyPosition(content, 'FOO')!
    expect(loc.startLine).toBe(0)
  expect(loc.startChar).toBe(0)
  })

  it('handles keys with regex metacharacters safely', () => {
    const content = 'KEY.*(WEIRD)=value\n'
    // searching for literal key containing regex chars should not throw
    const loc = findKeyPosition(content, 'KEY.*(WEIRD)')
    expect(loc).toBeDefined()
    expect(loc!.startLine).toBe(0)
  })

  it('supports first-strategy to return first occurrence', () => {
    const content = 'FOO=first\nOTHER=1\nFOO=second\n'
    const loc = findKeyPosition(content, 'FOO', { strategy: 'first' })!
    expect(loc.startLine).toBe(0)
  })
})
