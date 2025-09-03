import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// mock vscode utilities to avoid requiring 'vscode' in tests
vi.mock('@vscode-use/utils', () => ({
  getRootPath: () => process.cwd(),
  watchFiles: () => {
    return () => {}
  },
  addEventListener: () => {},
}))
import { writeFileSync, rmSync, mkdirSync } from 'fs'
import path from 'path'

import { readEnv, envCacheMap } from '../src/loadEnvFiles'

describe('readEnv', () => {
  const tmpDir = path.resolve(__dirname, '.tmp')
  const tmpFile = path.join(tmpDir, '.env.test')

  beforeAll(() => {
    try { mkdirSync(tmpDir) } catch {} // ignore
  })
  afterAll(() => {
    try { rmSync(tmpFile) } catch {}
    try { rmSync(tmpDir) } catch {}
  })

  it('parses .env file and stores in cache', async () => {
    writeFileSync(tmpFile, 'FOO=bar\nBAZ=qux')
    const env = await readEnv(tmpFile)
    expect(env).toBeDefined()
    expect(env!.FOO).toBe('bar')
    expect(envCacheMap.has(tmpFile)).toBe(true)
    const cached = envCacheMap.get(tmpFile)!
    expect(cached.env.FOO).toBe('bar')
  })
})
