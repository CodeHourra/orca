import type { AgentType } from './agent-status-types'
import { formatAgentTypeLabel } from './agent-type-label'
import { conversationNameFromLiveTitle } from './live-title-conversation-name'
import { isMeaningfulOpenCodeTerminalTitle } from './opencode-terminal-title'
import type { Tab } from './tab-types'
import type { TerminalTab } from './terminal-tab-types'

/** The agent a tab currently hosts, so its title can mirror the agent row's. */
export type TabTitleAgentContext = { agentType: AgentType; providerSessionId?: string }

export function resolveTerminalTabTitle(
  tab: Pick<
    TerminalTab,
    | 'customTitle'
    | 'quickCommandLabel'
    | 'aiVaultTitle'
    | 'generatedTitle'
    | 'title'
    | 'defaultTitle'
  >,
  generatedTitlesEnabled: boolean,
  fallback = '',
  owner?: TabTitleAgentContext
): string {
  const liveTitle = tab.title?.trim() ?? ''
  if (owner) {
    // Why: with the agent known, mirror the agent row — the vault title must belong
    // to this session, and a live title that is only status/identity yields nothing,
    // so the tab falls back to its own default title instead of echoing "⠋ Claude Code".
    const aiVaultTitle = tab.aiVaultTitle
    const ownedVaultTitle =
      aiVaultTitle &&
      aiVaultTitle.agent === owner.agentType &&
      aiVaultTitle.sessionId === owner.providerSessionId
        ? aiVaultTitle.title.trim()
        : ''
    return (
      tab.customTitle?.trim() ||
      tab.quickCommandLabel?.trim() ||
      (isMeaningfulOpenCodeTerminalTitle(liveTitle) ? liveTitle : '') ||
      ownedVaultTitle ||
      (generatedTitlesEnabled ? tab.generatedTitle?.trim() : '') ||
      conversationNameFromLiveTitle(
        liveTitle,
        owner.agentType,
        formatAgentTypeLabel(owner.agentType).toLowerCase(),
        tab.defaultTitle
      ) ||
      tab.defaultTitle?.trim() ||
      liveTitle ||
      fallback
    )
  }
  return (
    tab.customTitle?.trim() ||
    tab.quickCommandLabel?.trim() ||
    (isMeaningfulOpenCodeTerminalTitle(liveTitle) ? liveTitle : '') ||
    tab.aiVaultTitle?.title.trim() ||
    (generatedTitlesEnabled ? tab.generatedTitle?.trim() : '') ||
    liveTitle ||
    fallback
  )
}

export function resolveUnifiedTabLabel(
  tab:
    | Pick<Tab, 'customLabel' | 'quickCommandLabel' | 'aiVaultTitle' | 'generatedLabel' | 'label'>
    | undefined,
  generatedTitlesEnabled: boolean,
  fallback = ''
): string {
  const liveLabel = tab?.label?.trim() ?? ''
  return (
    tab?.customLabel?.trim() ||
    tab?.quickCommandLabel?.trim() ||
    (isMeaningfulOpenCodeTerminalTitle(liveLabel) ? liveLabel : '') ||
    tab?.aiVaultTitle?.title.trim() ||
    (generatedTitlesEnabled ? tab?.generatedLabel?.trim() : '') ||
    liveLabel ||
    fallback
  )
}
