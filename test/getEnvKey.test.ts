import { describe, it, expect, vi } from 'vitest'

let currentLineText = ''
let currentKeyWords: string[] = []

// Provide a mutable mock for @vscode-use/utils used by getEnvKey
vi.mock('@vscode-use/utils', () => ({
  getLineText: () => currentLineText,
  getKeyWords: () => currentKeyWords,
}))

import { getEnvKey } from '../src/getEnvKey'

describe('getEnvKey', () => {
  it('parses process.env.FOO when cursor on FOO', () => {
    currentLineText = 'const a = process.env.FOO'
    currentKeyWords = ['FOO']
    const pos = { line: 0, character: 'const a = process.env.'.length + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses import.meta.env.VITE_API when cursor on API', () => {
    currentLineText = 'const req = import.meta.env.VITE_API'
    currentKeyWords = ['VITE_API']
    const pos = { line: 0, character: 'const req = import.meta.env.'.length + 2 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('VITE_API')
  })

  it('returns undefined when no env-like pattern exists', () => {
    currentLineText = 'const x = 42'
    currentKeyWords = []
    const pos = { line: 0, character: 5 }
    const res = getEnvKey(pos as any)
    expect(res).toBeUndefined()
  })

  it('rejects lowercase keywords from getKeyWords', () => {
    currentLineText = 'const val = process.env.foo'
    currentKeyWords = ['foo']
    const pos = { line: 0, character: 'const val = process.env.'.length + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBeUndefined()
  })
})
