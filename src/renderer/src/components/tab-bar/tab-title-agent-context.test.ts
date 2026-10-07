import { describe, expect, it } from 'vitest'
import type { AgentProviderSessionMetadata } from '../../../../shared/agent-session-resume'
import type { AgentStatusEntry, AgentType } from '../../../../shared/agent-status-types'
import type { TerminalLayoutSnapshot } from '../../../../shared/terminal-tab-types'
import {
  createTabTitleAgentContextSelector,
  selectTabTitleAgentContextByTabId
} from './tab-title-agent-context'

// Why: a full AgentStatusEntry needs a dozen unrelated fields; the selector reads only these.
function entry(partial: {
  agentType?: AgentType
  providerSession?: AgentProviderSessionMetadata
  updatedAt?: number
}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    stateHistory: [],
    paneKey: 'pane',
    ...partial
  }
}

const SESSION = (id: string): AgentProviderSessionMetadata => ({ key: 'session_id', id })

function splitLayout(activeLeafId: string | null): TerminalLayoutSnapshot {
  return {
    root: {
      type: 'split',
      direction: 'horizontal',
      first: { type: 'leaf', leafId: 'leaf-a' },
      second: { type: 'leaf', leafId: 'leaf-b' }
    },
    activeLeafId,
    expandedLeafId: null
  }
}

describe('selectTabTitleAgentContextByTabId', () => {
  it('carries the active leaf agent and its provider session id', () => {
    const projection = selectTabTitleAgentContextByTabId(
      {
        'tab-1:leaf-a': entry({ agentType: 'claude' }),
        'tab-1:leaf-b': entry({ agentType: 'codex', providerSession: SESSION('s-2') })
      },
      { 'tab-1': splitLayout('leaf-b') }
    )

    expect(projection).toEqual({ 'tab-1': { agentType: 'codex', providerSessionId: 's-2' } })
  })

  it('omits a tab whose entry has no agent type', () => {
    expect(
      selectTabTitleAgentContextByTabId({ 'tab-1:leaf-a': entry({ agentType: undefined }) })
    ).toEqual({})
  })

  it('keeps a session-less entry as agent type only', () => {
    expect(
      selectTabTitleAgentContextByTabId({ 'tab-1:leaf-a': entry({ agentType: 'claude' }) })
    ).toEqual({ 'tab-1': { agentType: 'claude', providerSessionId: undefined } })
  })

  it('reuses each tab context object while the pair is unchanged', () => {
    const select = createTabTitleAgentContextSelector()
    const firstStatuses = {
      'tab-1:leaf-a': entry({ agentType: 'claude', providerSession: SESSION('s-1') })
    }
    const secondStatuses = {
      'tab-1:leaf-a': entry({
        agentType: 'claude',
        providerSession: SESSION('s-1'),
        updatedAt: 99
      })
    }
    const first = select({ agentStatusByPaneKey: firstStatuses })
    const second = select({ agentStatusByPaneKey: secondStatuses })

    expect(second['tab-1']).toBe(first['tab-1'])
    // Same source maps: the record itself is returned as-is.
    expect(select({ agentStatusByPaneKey: secondStatuses })).toBe(second)
  })
})
