import { describe, expect, it, vi } from 'vitest'

import { getEnvKey } from '../src/getEnvKey'

let currentLineText = ''
let currentKeyWords: string[] = []

// Provide a mutable mock for @vscode-use/utils used by getEnvKey
vi.mock('@vscode-use/utils', () => ({
  getLineText: () => currentLineText,
  getKeyWords: () => currentKeyWords,
}))

describe('getEnvKey', () => {
  it('parses process.env.FOO when cursor on FOO', () => {
    currentLineText = 'const a = process.env.FOO'
    currentKeyWords = ['FOO']
    const pos = { line: 0, character: 'const a = process.env.'.length + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses process.env?.FOO when cursor on FOO', () => {
    currentLineText = 'const a = process.env?.FOO'
    currentKeyWords = ['FOO']
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses process.env[\"FOO\"] when cursor on FOO', () => {
    currentLineText = 'const a = process.env[\"FOO\"]'
    currentKeyWords = []
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses process.env?.[\"FOO\"] when cursor on FOO', () => {
    currentLineText = 'const a = process.env?.[\"FOO\"]'
    currentKeyWords = []
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
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

  it('parses import.meta.env?.VITE_API when cursor on API', () => {
    currentLineText = 'const req = import.meta.env?.VITE_API'
    currentKeyWords = ['VITE_API']
    const pos = { line: 0, character: currentLineText.indexOf('VITE_API') + 2 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('VITE_API')
  })

  it('parses import.meta.env.PUBLIC_TOKEN when cursor on TOKEN', () => {
    currentLineText = 'const t = import.meta.env.PUBLIC_TOKEN'
    currentKeyWords = ['PUBLIC_TOKEN']
    const pos = { line: 0, character: currentLineText.indexOf('PUBLIC_TOKEN') + 2 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('PUBLIC_TOKEN')
  })

  it('ignores Vite built-in import.meta.env.MODE', () => {
    currentLineText = 'const mode = import.meta.env.MODE'
    currentKeyWords = ['MODE']
    const pos = { line: 0, character: currentLineText.indexOf('MODE') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBeUndefined()
  })

  it('parses import.meta.env[\"VITE_API\"] when cursor on API', () => {
    currentLineText = 'const req = import.meta.env[\"VITE_API\"]'
    currentKeyWords = []
    const pos = { line: 0, character: currentLineText.indexOf('VITE_API') + 2 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('VITE_API')
  })

  it('parses import.meta.env?.[\"VITE_API\"] when cursor on API', () => {
    currentLineText = 'const req = import.meta.env?.[\"VITE_API\"]'
    currentKeyWords = []
    const pos = { line: 0, character: currentLineText.indexOf('VITE_API') + 2 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('VITE_API')
  })

  it('parses Deno.env.get(\"FOO\") when cursor on FOO', () => {
    currentLineText = 'const a = Deno.env.get(\"FOO\")'
    currentKeyWords = []
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses Bun.env.FOO when cursor on FOO', () => {
    currentLineText = 'const a = Bun.env.FOO'
    currentKeyWords = ['FOO']
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
  })

  it('parses Bun.env?.FOO when cursor on FOO', () => {
    currentLineText = 'const a = Bun.env?.FOO'
    currentKeyWords = ['FOO']
    const pos = { line: 0, character: currentLineText.indexOf('FOO') + 1 }
    const res = getEnvKey(pos as any)
    expect(res).toBe('FOO')
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
