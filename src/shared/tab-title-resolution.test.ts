import { describe, expect, it } from 'vitest'
import { resolveTerminalTabTitle, resolveUnifiedTabLabel } from './tab-title-resolution'

describe('tab title resolution', () => {
  it('uses live terminal titles when generated titles are disabled', () => {
    expect(
      resolveTerminalTabTitle(
        { customTitle: null, generatedTitle: 'Refactor auth', title: 'Claude working' },
        false
      )
    ).toBe('Claude working')
  })

  it('places generated titles between manual and live titles when enabled', () => {
    expect(
      resolveTerminalTabTitle(
        { customTitle: null, generatedTitle: 'Refactor auth', title: 'Claude working' },
        true
      )
    ).toBe('Refactor auth')
    expect(
      resolveTerminalTabTitle(
        { customTitle: 'Payments', generatedTitle: 'Refactor auth', title: 'Claude working' },
        true
      )
    ).toBe('Payments')
  })

  it('uses meaningful native OpenCode session titles before generated titles', () => {
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: null,
          generatedTitle: 'Refactor auth',
          title: 'OC | Native Stable Session'
        },
        true
      )
    ).toBe('OC | Native Stable Session')
  })

  it('keeps generated titles ahead of generic OpenCode titles', () => {
    expect(
      resolveTerminalTabTitle(
        { customTitle: null, generatedTitle: 'Refactor auth', title: 'OpenCode' },
        true
      )
    ).toBe('Refactor auth')
  })

  it('places quick command labels between manual and generated titles', () => {
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: null,
          quickCommandLabel: 'Run tests',
          generatedTitle: 'Refactor auth',
          title: 'pnpm test'
        },
        true
      )
    ).toBe('Run tests')
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: 'Manual label',
          quickCommandLabel: 'Run tests',
          generatedTitle: 'Refactor auth',
          title: 'pnpm test'
        },
        true
      )
    ).toBe('Manual label')
  })

  it('keeps a Codex thread name stable across activity plus project OSC titles', () => {
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: null,
          aiVaultTitle: {
            agent: 'codex',
            sessionId: 'codex-session',
            title: 'Repair provider-native tab titles'
          },
          title: '⠋ albacore'
        },
        false
      )
    ).toBe('Repair provider-native tab titles')
  })

  it('keeps manual and quick-command labels ahead of AI Vault titles', () => {
    const aiVaultTitle = {
      agent: 'claude' as const,
      sessionId: 'claude-session',
      title: 'Claude conversation'
    }
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: 'Manual label',
          quickCommandLabel: 'Run tests',
          aiVaultTitle,
          title: 'claude working'
        },
        false
      )
    ).toBe('Manual label')
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: null,
          quickCommandLabel: 'Run tests',
          aiVaultTitle,
          title: 'claude working'
        },
        false
      )
    ).toBe('Run tests')
  })

  it('keeps OpenCode native and Orca-generated title behavior intact', () => {
    const aiVaultTitle = {
      agent: 'codex' as const,
      sessionId: 'codex-session',
      title: 'Codex conversation'
    }
    expect(
      resolveTerminalTabTitle(
        {
          customTitle: null,
          aiVaultTitle,
          generatedTitle: 'Orca generated',
          title: 'OC | OpenCode native'
        },
        true
      )
    ).toBe('OC | OpenCode native')
    expect(
      resolveTerminalTabTitle(
        { customTitle: null, generatedTitle: 'Orca generated', title: '⠋ albacore' },
        true
      )
    ).toBe('Orca generated')
  })

  it('uses the same priority for unified tab labels', () => {
    expect(
      resolveUnifiedTabLabel(
        { customLabel: null, generatedLabel: 'Fix flaky tests', label: 'Codex working' },
        true
      )
    ).toBe('Fix flaky tests')
  })

  it('uses quick command labels before generated unified labels', () => {
    expect(
      resolveUnifiedTabLabel(
        {
          customLabel: null,
          quickCommandLabel: 'Run build',
          generatedLabel: 'Fix flaky tests',
          label: 'Codex working'
        },
        true
      )
    ).toBe('Run build')
  })

  it('uses meaningful native OpenCode labels before generated unified labels', () => {
    expect(
      resolveUnifiedTabLabel(
        {
          customLabel: null,
          generatedLabel: 'Fix flaky tests',
          label: 'OC | Native Stable Session'
        },
        true
      )
    ).toBe('OC | Native Stable Session')
  })

  it('keeps manual and quick command labels ahead of native OpenCode labels', () => {
    expect(
      resolveUnifiedTabLabel(
        {
          customLabel: 'Manual label',
          quickCommandLabel: 'Run build',
          generatedLabel: 'Fix flaky tests',
          label: 'OC | Native Stable Session'
        },
        true
      )
    ).toBe('Manual label')
    expect(
      resolveUnifiedTabLabel(
        {
          customLabel: null,
          quickCommandLabel: 'Run build',
          generatedLabel: 'Fix flaky tests',
          label: 'OC | Native Stable Session'
        },
        true
      )
    ).toBe('Run build')
  })
})

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
