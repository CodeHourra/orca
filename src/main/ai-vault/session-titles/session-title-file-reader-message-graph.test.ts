import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readAiVaultSessionTitlesFromFiles } from './session-title-file-reader'

function write(name: string, records: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'orca-reader-title-'))
  const path = join(dir, name)
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`)
  return path
}

describe('readAiVaultSessionTitlesFromFiles', () => {
  // Why real files: the widened agent set (pi/omp) is only useful if the reader
  // actually folds a name out of their recorded transcript, not merely admits them.
  it('resolves an OMP persisted title', async () => {
    const path = write('omp-1.jsonl', [
      {
        type: 'session',
        id: 'omp-1',
        cwd: '/repo',
        title: 'Investigate replay bug',
        titleSource: 'user'
      },
      { type: 'message', message: { role: 'user', content: 'first prompt' } }
    ])
    await expect(
      readAiVaultSessionTitlesFromFiles([
        { agent: 'omp', sessionId: 'omp-1', transcriptPath: path }
      ])
    ).resolves.toEqual({
      titles: [{ agent: 'omp', sessionId: 'omp-1', title: 'Investigate replay bug' }]
    })
  })

  it('resolves a Pi session from its first user prompt', async () => {
    const path = write('pi-1.jsonl', [
      { type: 'session', id: 'pi-1', cwd: '/repo' },
      { type: 'message', message: { role: 'user', content: 'Fix the login bug' } }
    ])
    await expect(
      readAiVaultSessionTitlesFromFiles([{ agent: 'pi', sessionId: 'pi-1', transcriptPath: path }])
    ).resolves.toEqual({
      titles: [{ agent: 'pi', sessionId: 'pi-1', title: 'Fix the login bug' }]
    })
  })
})
