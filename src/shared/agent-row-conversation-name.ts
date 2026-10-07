// Resolves the stable "conversation name" an agent row can show instead of the
// live last-message preview. Sources, in the same precedence the tab bar uses
// (tab-title-resolution.ts): manual rename → quick-command label → OpenCode's
// semantic session title → provider session title → Orca's generated title →
// the agent-set live title.
// Live titles are accepted only when they carry a real name — pure status,
// identity-echo, and spinner/cwd titles yield null so callers keep the
// last-message label.
import type { AgentType } from './agent-status-types'
import { formatAgentTypeLabel } from './agent-type-label'
import { conversationNameFromLiveTitle } from './live-title-conversation-name'
import { isMeaningfulOpenCodeTerminalTitle } from './opencode-terminal-title'
import type { TerminalTab } from './terminal-tab-types'

export type ConversationNameTab = Pick<
  TerminalTab,
  'customTitle' | 'quickCommandLabel' | 'aiVaultTitle' | 'generatedTitle' | 'title' | 'defaultTitle'
>

/**
 * The conversation name for an agent row, or null when no usable name exists
 * and the caller should keep its last-message label.
 */
export function getAgentRowConversationName(
  tab: ConversationNameTab,
  agentType: AgentType | null | undefined,
  generatedTitlesEnabled: boolean,
  // Why: `tab.title` carries only the FOCUSED pane's title, so in a split tab it
  // names one pane and mislabels its siblings. Callers on a multi-pane tab pass
  // this row's own pane title, or `null` when none resolves; `undefined` (a
  // single-pane tab) keeps the tab title. Tab-owned names above are unaffected:
  // the user gave those to the whole tab and they do not flip on focus.
  paneLiveTitle?: string | null,
  providerSessionId?: string
): string | null {
  const customTitle = tab.customTitle?.trim()
  if (customTitle) {
    return customTitle
  }
  const quickCommandLabel = tab.quickCommandLabel?.trim()
  if (quickCommandLabel) {
    return quickCommandLabel
  }
  const liveTitle =
    paneLiveTitle === undefined ? (tab.title?.trim() ?? '') : (paneLiveTitle?.trim() ?? '')
  if (isMeaningfulOpenCodeTerminalTitle(liveTitle)) {
    return liveTitle
  }
  // Provider titles belong to their session, not every pane in the tab.
  const aiVaultTitle = tab.aiVaultTitle
  const providerTitle = aiVaultTitle?.title.trim()
  if (
    aiVaultTitle &&
    providerTitle &&
    aiVaultTitle.agent === agentType &&
    aiVaultTitle.sessionId === providerSessionId
  ) {
    return providerTitle
  }
  const generatedTitle = generatedTitlesEnabled ? tab.generatedTitle?.trim() : ''
  if (generatedTitle) {
    return generatedTitle
  }
  if (!liveTitle) {
    return null
  }
  return conversationNameFromLiveTitle(
    liveTitle,
    agentType,
    formatAgentTypeLabel(agentType).toLowerCase(),
    tab.defaultTitle
  )
}
