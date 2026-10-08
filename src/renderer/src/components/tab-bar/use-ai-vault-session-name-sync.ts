import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { isAiVaultTitleAgent } from '../../../../shared/ai-vault-session-title'
import { refreshAiVaultTabTitle } from '@/lib/ai-vault-tab-title-sync'
import { selectTabBarTitleAgentContext } from './tab-title-agent-context'
import type { TabBarItem } from './tab-bar-item-model'

/**
 * A handler that re-resolves the context menu's tab name from its provider
 * transcript, or undefined for a tab with no AI Vault agent session — an editor,
 * browser or bare shell tab has no session to sync, so the menu item is hidden
 * rather than offered as a no-op.
 *
 * Why the shared projection rather than the request collector: this runs for every
 * mounted tab row on every store write, and the collector scans every tab and pane.
 * `selectTabBarTitleAgentContext` memoizes that per-tab answer, so the gate stays
 * O(1) per row and survives a store whose tab map is not populated yet.
 */
export function useAiVaultSessionNameSync(item: TabBarItem): (() => void) | undefined {
  const tabId = item.type === 'terminal' ? item.data.id : null
  const canSync = useAppStore((state) => {
    if (tabId === null) {
      return false
    }
    const context = selectTabBarTitleAgentContext(state)[tabId]
    return (
      context !== undefined &&
      isAiVaultTitleAgent(context.agentType) &&
      Boolean(context.providerSessionId)
    )
  })
  return useMemo(
    () =>
      tabId !== null && canSync
        ? () => {
            void refreshAiVaultTabTitle({
              getState: useAppStore.getState,
              resolveSessionTitles: (args) => window.api.aiVault.resolveSessionTitles(args),
              tabId
            })
          }
        : undefined,
    [tabId, canSync]
  )
}
