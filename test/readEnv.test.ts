import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { envCacheMap, readEnv } from '../src/loadEnvFiles'

// mock vscode module (extension runtime only) for tests
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({ get: () => undefined, update: () => Promise.resolve() }),
  },
  Uri: { file: (p: string) => ({ fsPath: p }) },
}))

// mock vscode utilities to avoid requiring 'vscode' in tests
vi.mock('@vscode-use/utils', () => ({
  getRootPath: () => process.cwd(),
  watchFiles: () => {
    return () => { }
  },
  addEventListener: () => { },
}))

describe('readEnv', () => {
  const tmpDir = path.resolve(__dirname, '.tmp')
  const tmpFile = path.join(tmpDir, '.env.test')

  beforeAll(() => {
    try {
      mkdirSync(tmpDir)
    }
    catch {} // ignore
  })
  afterAll(() => {
    try {
      rmSync(tmpFile)
    }
    catch {}
    try {
      rmSync(tmpDir)
    }
    catch {}
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

  it('normalizes CRLF to LF in cached content', async () => {
    writeFileSync(tmpFile, 'FOO=bar\r\nBAZ=qux\r\n')
    await readEnv(tmpFile)
    expect(envCacheMap.get(tmpFile)!.content).toBe('FOO=bar\nBAZ=qux\n')
  })
})
