import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { TabTitleAgentContext } from '../../../../shared/tab-title-resolution'
import type { TerminalLayoutSnapshot } from '../../../../shared/terminal-tab-types'
import { resolveNativeChatActiveLayoutLeafId } from '../native-chat/native-chat-leaf-routing'

export type TabTitleAgentContextByTabId = Record<string, TabTitleAgentContext>

export type TabTitleAgentContextState = {
  agentStatusByPaneKey?: Record<string, AgentStatusEntry>
  terminalLayoutsByTabId?: Record<string, TerminalLayoutSnapshot>
}

const EMPTY_CONTEXT_BY_TAB_ID: TabTitleAgentContextByTabId = Object.freeze({})
const EMPTY_AGENT_STATUS_BY_PANE_KEY: Record<string, AgentStatusEntry> = Object.freeze({})
const EMPTY_TERMINAL_LAYOUTS_BY_TAB_ID: Record<string, TerminalLayoutSnapshot> = Object.freeze({})

/**
 * Project `agentStatusByPaneKey` down to each tab's hosting agent, so the tab
 * strip can resolve its title the same way the agent row does: the vault title
 * must belong to this session, and a status-only live title is refused.
 *
 * Same active-leaf preference and `${tabId}:` claim shape as
 * `projectTabAgentTypesByTabId`. Tabs with no agent, or one with no `agentType`,
 * get no entry — the resolver then keeps today's behavior.
 */
export function selectTabTitleAgentContextByTabId(
  agentStatusByPaneKey: Record<string, AgentStatusEntry>,
  terminalLayoutsByTabId: Record<string, TerminalLayoutSnapshot> = EMPTY_TERMINAL_LAYOUTS_BY_TAB_ID
): TabTitleAgentContextByTabId {
  const byTabId: TabTitleAgentContextByTabId = {}
  const claimed = new Set<string>()
  for (const [tabId, layout] of Object.entries(terminalLayoutsByTabId)) {
    if (!layout.root && !layout.activeLeafId) {
      continue
    }
    claimed.add(tabId)
    const activeLeafId = resolveNativeChatActiveLayoutLeafId(layout)
    if (!activeLeafId) {
      continue
    }
    const entry = agentStatusByPaneKey[`${tabId}:${activeLeafId}`]
    if (entry?.agentType) {
      byTabId[tabId] = {
        agentType: entry.agentType,
        providerSessionId: entry.providerSession?.id
      }
    }
  }
  for (const [paneKey, entry] of Object.entries(agentStatusByPaneKey)) {
    const colon = paneKey.indexOf(':')
    if (colon <= 0) {
      continue
    }
    const tabId = paneKey.slice(0, colon)
    if (claimed.has(tabId)) {
      continue
    }
    claimed.add(tabId)
    if (entry.agentType) {
      byTabId[tabId] = {
        agentType: entry.agentType,
        providerSessionId: entry.providerSession?.id
      }
    }
  }
  return byTabId
}

/**
 * Memoized form for `useShallow`: the hot maps get a new identity on every
 * status transition, so a per-tab context object is reused whenever its
 * `(agentType, providerSessionId)` pair is unchanged, keeping the strip's row
 * memo from re-rendering on unrelated churn.
 */
export function createTabTitleAgentContextSelector(): (
  state: TabTitleAgentContextState
) => TabTitleAgentContextByTabId {
  let cachedStatuses: Record<string, AgentStatusEntry> | null = null
  let cachedLayouts: Record<string, TerminalLayoutSnapshot> | null = null
  let cachedResult = EMPTY_CONTEXT_BY_TAB_ID

  return (state) => {
    const statuses = state.agentStatusByPaneKey ?? EMPTY_AGENT_STATUS_BY_PANE_KEY
    const layouts = state.terminalLayoutsByTabId ?? EMPTY_TERMINAL_LAYOUTS_BY_TAB_ID
    if (statuses === cachedStatuses && layouts === cachedLayouts) {
      return cachedResult
    }
    const reused: TabTitleAgentContextByTabId = {}
    for (const [tabId, context] of Object.entries(
      selectTabTitleAgentContextByTabId(statuses, layouts)
    )) {
      const previous = cachedResult[tabId]
      reused[tabId] =
        previous &&
        previous.agentType === context.agentType &&
        previous.providerSessionId === context.providerSessionId
          ? previous
          : context
    }
    cachedStatuses = statuses
    cachedLayouts = layouts
    cachedResult = reused
    return reused
  }
}

// Why: every retained TabBar requests the same global projection tuple.
export const selectTabBarTitleAgentContext = createTabTitleAgentContextSelector()
