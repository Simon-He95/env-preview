import { describe, it, expect } from 'vitest'
import { escapeRegExp } from '../src/utils/regex'

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    const input = 'a.*+?^${}()|[]\\'
    const out = escapeRegExp(input)
    // should not equal input and should contain backslashes
    expect(out).not.toBe(input)
    expect(out).toContain('\\*')
    expect(out).toContain('\\(')
  })
})
