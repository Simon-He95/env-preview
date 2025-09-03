import { describe, expect, it } from 'vitest'
import { formatHoverMarkdown } from '../src/hoverFormatter'

describe('formatHoverMarkdown', () => {
  it('wraps values in code block and includes commands', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: 'secretValue', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results)
    expect(md).toContain('### FOO')
    expect(md).toContain('```text')
    expect(md).toContain('secretValue')
    expect(md).toContain('command:env-preview.open')
    expect(md).toContain('command:env-preview.copy')
  })

  it('masks secrets when requested', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: 'verylongsecretvalue', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results, { maskSecrets: true, maskHead: 3, maskTail: 2 })
    // masked display should be present (e.g., ver...ue)
    expect(md).toMatch(/\w{3}\.\.\./)
    // the copy command should still be available (may contain encoded raw value)
    expect(md).toContain('command:env-preview.copy')
  })
})
