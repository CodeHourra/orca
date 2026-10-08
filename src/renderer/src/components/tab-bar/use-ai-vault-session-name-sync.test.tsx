// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store'
import { useAiVaultSessionNameSync } from './use-ai-vault-session-name-sync'
import type { TabBarItem } from './tab-bar-item-model'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const TAB_ID = 'terminal-1'
const PANE_KEY = `${TAB_ID}:leaf-1`

function terminalItem(): TabBarItem {
  return {
    type: 'terminal',
    id: TAB_ID,
    unifiedTabId: TAB_ID,
    isPinned: false,
    data: {
      id: TAB_ID,
      ptyId: null,
      worktreeId: 'wt-1',
      title: 'zsh',
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 1
    }
  }
}

function agentStatusEntry(sessionId: string) {
  return {
    state: 'done' as const,
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    stateHistory: [],
    agentType: 'claude',
    paneKey: PANE_KEY,
    tabId: TAB_ID,
    worktreeId: 'wt-1',
    providerSession: { key: 'session_id' as const, id: sessionId, transcriptPath: '/s/x.jsonl' }
  }
}

let root: Root | null = null
let seen: (() => void) | undefined

function HandlerProbe(): null {
  seen = useAiVaultSessionNameSync(terminalItem())
  return null
}

function renderProbe(): void {
  if (!root) {
    root = createRoot(document.createElement('div'))
  }
  act(() => {
    root!.render(createElement(HandlerProbe))
  })
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  seen = undefined
  useAppStore.setState({ agentStatusByPaneKey: {}, terminalLayoutsByTabId: {} })
})

describe('useAiVaultSessionNameSync', () => {
  it('offers no handler for a tab whose pane has no agent session', () => {
    useAppStore.setState({ agentStatusByPaneKey: {} })
    renderProbe()
    expect(seen).toBeUndefined()
  })

  it('offers the handler once the pane reports an AI Vault agent session', () => {
    useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: agentStatusEntry('s-1') } })
    renderProbe()
    expect(typeof seen).toBe('function')
  })

  it('offers no handler for an agent the title reader cannot name', () => {
    useAppStore.setState({
      agentStatusByPaneKey: { [PANE_KEY]: { ...agentStatusEntry('s-1'), agentType: 'gemini' } }
    })
    renderProbe()
    expect(seen).toBeUndefined()
  })

  it('offers no handler when the pane has no provider session to read', () => {
    const entry = agentStatusEntry('s-1')
    delete (entry as { providerSession?: unknown }).providerSession
    useAppStore.setState({ agentStatusByPaneKey: { [PANE_KEY]: entry } })
    renderProbe()
    expect(seen).toBeUndefined()
  })
})
