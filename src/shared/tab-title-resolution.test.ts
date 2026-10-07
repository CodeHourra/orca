import { describe, expect, it } from 'vitest'
import { resolveTerminalTabTitle } from './tab-title-resolution'

describe('tab title resolution with an agent context', () => {
  it('accepts an AI Vault title only for the owning session', () => {
    const tab = {
      customTitle: null,
      aiVaultTitle: { agent: 'claude' as const, sessionId: 's-1', title: 'Investigate replay bug' },
      title: '⠋ Claude Code'
    }
    expect(
      resolveTerminalTabTitle(tab, false, '', { agentType: 'claude', providerSessionId: 's-1' })
    ).toBe('Investigate replay bug')
  })

  it('vetoes a status-only live title to the tab default when the vault title is another session', () => {
    const tab = {
      customTitle: null,
      aiVaultTitle: { agent: 'claude' as const, sessionId: 'other', title: 'Someone else' },
      defaultTitle: 'Terminal 1',
      title: '⠋ Claude Code'
    }
    expect(
      resolveTerminalTabTitle(tab, false, '', { agentType: 'claude', providerSessionId: 's-1' })
    ).toBe('Terminal 1')
  })

  it('keeps a real live conversation name under an agent context', () => {
    expect(
      resolveTerminalTabTitle({ customTitle: null, title: '✳ Investigate replay bug' }, false, '', {
        agentType: 'claude'
      })
    ).toBe('Investigate replay bug')
  })

  it('keeps today behavior when the context cannot name the live title', () => {
    expect(
      resolveTerminalTabTitle({ customTitle: null, title: '⠋ Claude Code' }, false, '', {
        agentType: 'claude'
      })
    ).toBe('⠋ Claude Code')
  })

  it('keeps today raw-title behavior when no context is given', () => {
    expect(resolveTerminalTabTitle({ customTitle: null, title: '⠋ Claude Code' }, false)).toBe(
      '⠋ Claude Code'
    )
  })
})
