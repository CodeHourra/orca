import { describe, expect, it } from 'vitest'
import {
  AI_VAULT_SESSION_TITLE_AGENTS,
  AI_VAULT_SESSION_TITLE_AGENTS_V1,
  isAiVaultTitleAgent
} from './ai-vault-session-title'

describe('AI Vault session title agents', () => {
  it('admits the message-graph providers alongside claude and codex', () => {
    expect(AI_VAULT_SESSION_TITLE_AGENTS).toEqual(['claude', 'codex', 'pi', 'omp'])
  })

  it('keeps the released wire vocabulary as the v1 subset', () => {
    // Why: an older host's `aiVault.resolveSessionTitles` schema accepts only these,
    // so the sync's v1 tier must stay exactly this set.
    expect(AI_VAULT_SESSION_TITLE_AGENTS_V1).toEqual(['claude', 'codex'])
    for (const agent of AI_VAULT_SESSION_TITLE_AGENTS_V1) {
      expect(AI_VAULT_SESSION_TITLE_AGENTS).toContain(agent)
    }
  })

  it.each([
    { agent: 'claude', expected: true },
    { agent: 'codex', expected: true },
    { agent: 'pi', expected: true },
    { agent: 'omp', expected: true },
    { agent: 'gemini', expected: false },
    { agent: 'future-agent', expected: false },
    { agent: '', expected: false },
    { agent: undefined, expected: false },
    { agent: null, expected: false },
    { agent: 7, expected: false }
  ])('narrows $agent to $expected', ({ agent, expected }) => {
    expect(isAiVaultTitleAgent(agent)).toBe(expected)
  })
})
