import { describe, expect, it } from 'vitest'

import { collectRootEnvKeys, collectViteEnvKeys, detectEnvCompletionContext } from '../src/completions'
import { getViteEnvFiles } from '../src/viteEnv'

describe('completions', () => {
  it('detects dot and bracket completion contexts', () => {
    expect(detectEnvCompletionContext('x process.env.')).toEqual({ kind: 'process-dot', partial: '' })
    expect(detectEnvCompletionContext('x process.env.FO')).toEqual({ kind: 'process-dot', partial: 'FO' })
    expect(detectEnvCompletionContext('x process.env?.FO')).toEqual({ kind: 'process-dot', partial: 'FO' })
    expect(detectEnvCompletionContext('x process.env[\"FO')).toEqual({ kind: 'process-bracket', partial: 'FO', quote: '"' })
    expect(detectEnvCompletionContext('x process.env?.[FO')).toEqual({ kind: 'process-bracket', partial: 'FO' })
    expect(detectEnvCompletionContext('x import.meta.env.')).toEqual({ kind: 'import-dot', partial: '' })
    expect(detectEnvCompletionContext('x import.meta.env?.[\"VITE_')).toEqual({ kind: 'import-bracket', partial: 'VITE_', quote: '"' })
    expect(detectEnvCompletionContext('x Bun.env.FO')).toEqual({ kind: 'bun-dot', partial: 'FO' })
    expect(detectEnvCompletionContext('x Deno.env.get(\"FO')).toEqual({ kind: 'deno-get', partial: 'FO', quote: '"' })
  })

  it('collects keys under root prefix', () => {
    const cache = new Map<string, any>()
    cache.set('/repo/.env', { env: { A: '1', B: '2' }, content: '', readAt: 0 })
    cache.set('/repo/sub/.env', { env: { C: '3' }, content: '', readAt: 0 })
    cache.set('/other/.env', { env: { D: '4' }, content: '', readAt: 0 })
    expect(collectRootEnvKeys(cache as any, '/repo')).toEqual(['A', 'B', 'C'])
  })

  it('collects Vite keys filtered by envPrefix', () => {
    const root = '/repo'
    const mode = 'development'
    const files = getViteEnvFiles(root, mode, '', { includeLocalInTest: false })
    const cache = new Map<string, any>()
    cache.set(files[0], { env: { VITE_A: '1', PUBLIC_B: '2', MODE: 'dev' }, content: '', readAt: 0 })
    const keys = collectViteEnvKeys(cache as any, root, mode, '', false, ['VITE_'])
    expect(keys).toEqual(['VITE_A'])
  })
})
