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

  it('uses a longer code fence when value contains backticks', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: 'a```b', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results)
    expect(md).toContain('````text')
    expect(md).toContain('a```b')
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

  it('renders summary block when provided', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: '1', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results, { summary: { title: 'Effective', value: '2', copyValue: '2' } })
    expect(md).toContain('**Effective**')
    expect(md).toContain('2')
    expect(md).toContain('Copy Effective')
  })

  it('renders secondary copy action when provided', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: '1', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results, {
      summary: {
        title: 'Effective',
        value: 'expanded',
        copyValue: 'expanded',
        secondaryCopy: { label: 'Copy Raw Effective', value: 'raw' },
      },
    })
    expect(md).toContain('Copy Raw Effective')
  })

  it('renders meta lines when provided', () => {
    const results = [
      { fileUrl: '/path/.env', envValue: '1', selection: [0, 0, 0, 3] as any },
    ]
    const md = formatHoverMarkdown('FOO', results, { meta: { title: 'Chain', lines: ['.env: effective'] } })
    expect(md).toContain('**Chain**')
    expect(md).toContain('- .env: effective')
  })
})
