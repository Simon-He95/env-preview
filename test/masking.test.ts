import { describe, expect, it } from 'vitest'

import { shouldMaskKey } from '../src/masking'

describe('shouldMaskKey', () => {
  it('masks everything when maskSecrets=true', () => {
    expect(shouldMaskKey('FOO', { maskSecrets: true })).toBe(true)
    expect(shouldMaskKey('TOKEN', { maskSecrets: true, maskKeyPattern: 'TOKEN' })).toBe(true)
  })

  it('does not mask when pattern is empty or invalid', () => {
    expect(shouldMaskKey('TOKEN', { maskSecrets: false, maskKeyPattern: '' })).toBe(false)
    expect(shouldMaskKey('TOKEN', { maskSecrets: false, maskKeyPattern: '(' })).toBe(false)
  })

  it('masks keys matching maskKeyPattern', () => {
    expect(shouldMaskKey('API_KEY', { maskSecrets: false, maskKeyPattern: 'KEY$' })).toBe(true)
    expect(shouldMaskKey('PUBLIC_URL', { maskSecrets: false, maskKeyPattern: 'KEY$' })).toBe(false)
  })

  it('unmasks keys matching unmaskKeyPattern', () => {
    expect(shouldMaskKey('PUBLIC_API_KEY', { maskSecrets: false, maskKeyPattern: 'KEY$', unmaskKeyPattern: '^PUBLIC_' })).toBe(false)
    expect(shouldMaskKey('PRIVATE_API_KEY', { maskSecrets: false, maskKeyPattern: 'KEY$', unmaskKeyPattern: '^PUBLIC_' })).toBe(true)
  })
})
