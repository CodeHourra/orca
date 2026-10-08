import { describe, expect, it } from 'vitest'
import { parseAiVaultSessionTitlesResult } from './session-title-result-validation'

describe('parseAiVaultSessionTitlesResult', () => {
  it('accepts the widened message-graph agents', () => {
    expect(
      parseAiVaultSessionTitlesResult({
        titles: [
          { agent: 'pi', sessionId: 'pi-1', title: 'Fix the login bug' },
          { agent: 'omp', sessionId: 'omp-1', title: 'Investigate replay bug' }
        ]
      })
    ).toEqual({
      titles: [
        { agent: 'pi', sessionId: 'pi-1', title: 'Fix the login bug' },
        { agent: 'omp', sessionId: 'omp-1', title: 'Investigate replay bug' }
      ]
    })
  })

  it.each([{ agent: 'gemini' }, { agent: 'future-agent' }, { agent: '' }, { agent: 7 }])(
    'rejects an unknown agent arm %j',
    (partial) => {
      expect(() =>
        parseAiVaultSessionTitlesResult({
          titles: [{ ...partial, sessionId: 's-1', title: 'Name' }]
        })
      ).toThrow('invalid session title')
    }
  )
})
