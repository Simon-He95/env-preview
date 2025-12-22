import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { computeViteEffectiveValue, extractViteModesFromFilenames, getViteEnvFiles, resolveViteSearchKey, shouldUseViteMode } from '../src/viteEnv'

describe('viteEnv', () => {
  it('returns Vite env files in correct order', () => {
    const root = '/repo'
    const files = getViteEnvFiles(root, 'development')
    expect(files).toEqual([
      path.join(path.resolve(root), '.env'),
      path.join(path.resolve(root), '.env.local'),
      path.join(path.resolve(root), '.env.development'),
      path.join(path.resolve(root), '.env.development.local'),
    ])
  })

  it('excludes local files in test mode by default', () => {
    const root = '/repo'
    const files = getViteEnvFiles(root, 'test')
    expect(files).toEqual([
      path.join(path.resolve(root), '.env'),
      path.join(path.resolve(root), '.env.test'),
    ])
  })

  it('supports envDir relative to root', () => {
    const root = '/repo'
    const files = getViteEnvFiles(root, 'development', 'apps/web')
    expect(files[0]).toBe(path.join(path.resolve(root), 'apps/web', '.env'))
  })

  it('computes effective value using last match in precedence', () => {
    const root = '/repo'
    const mode = 'production'
    const files = getViteEnvFiles(root, mode)
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { VITE_A: '1' }, content: 'VITE_A=1\n' })
    cache.set(files[2], { env: { VITE_A: '2' }, content: 'VITE_A=2\n' })
    const { effective, effectiveFile } = computeViteEffectiveValue('VITE_A', root, mode, cache)
    expect(effective).toBe('2')
    expect(effectiveFile).toBe(files[2])
  })

  it('expands variables when enabled', () => {
    const root = '/repo'
    const mode = 'development'
    const files = getViteEnvFiles(root, mode)
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { HOST: 'http://x', VITE_URL: '$HOST/api' }, content: '' })
    const { effectiveExpanded } = computeViteEffectiveValue('VITE_URL', root, mode, cache, { expand: true })
    expect(effectiveExpanded).toBe('http://x/api')
  })

  it('resolves to VITE_ key when base key is not found', () => {
    const root = '/repo'
    const mode = 'development'
    const files = getViteEnvFiles(root, mode)
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { VITE_TOKEN: 'x' }, content: 'VITE_TOKEN=x\n' })
    expect(resolveViteSearchKey('TOKEN', root, mode, cache)).toBe('VITE_TOKEN')
  })

  it('auto-detects Vite mode when key exists in Vite env files', () => {
    const root = '/repo'
    const mode = 'development'
    const files = getViteEnvFiles(root, mode)
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { API_URL: 'http://x' }, content: 'API_URL=http://x\n' })
    expect(shouldUseViteMode('API_URL', root, mode, cache)).toBe(true)
  })

  it('auto-detects Vite mode for VITE_ keys even if files are missing', () => {
    const cache = new Map<string, any>()
    expect(shouldUseViteMode('VITE_TOKEN', '/repo', 'development', cache)).toBe(true)
  })

  it('supports custom envPrefix list', () => {
    const root = '/repo'
    const mode = 'development'
    const files = getViteEnvFiles(root, mode)
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { PUBLIC_TOKEN: 'x' }, content: 'PUBLIC_TOKEN=x\n' })
    expect(shouldUseViteMode('PUBLIC_TOKEN', root, mode, cache, { envPrefix: ['PUBLIC_'] })).toBe(true)
    expect(resolveViteSearchKey('TOKEN', root, mode, cache, { envPrefix: ['PUBLIC_'] })).toBe('PUBLIC_TOKEN')
  })

  it('extracts available modes from env filenames', () => {
    const modes = extractViteModesFromFilenames([
      '.env',
      '.env.local',
      '.env.development',
      '.env.development.local',
      '.env.production',
      '.env.production.local',
      'not-env.txt',
    ])
    expect(modes).toEqual(['development', 'production'])
  })
})
