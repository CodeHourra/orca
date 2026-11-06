import type { AiVaultSessionTitle } from './ai-vault/contracts/ai-vault-session-title'
import type { AgentType } from './agent-status/contracts/agent-status-types'
import { formatAgentTypeLabel } from './agent-status/presentation/agent-type-label'
import { conversationNameFromLiveTitle } from './agent-status/presentation/agent-row-conversation-name'
import { isMeaningfulOpenCodeTerminalTitle } from './agent-status/title/providers/opencode-terminal-title'
import type { Tab } from './tab-types'
import type { TerminalTab } from './workspace-layout/terminal-tab-types'

/** The agent a tab currently hosts, so its title can mirror the agent row's. */
export type TabTitleAgentContext = { agentType: AgentType; providerSessionId?: string }

export type TabNameSources = {
  /** A name the user typed into the tab. */
  customTitle?: string | null
  quickCommandLabel?: string | null
  /** The program's own terminal title right now. */
  liveTitle: string
  /** The agent session's title, already checked to belong to this tab's session. */
  sessionTitle?: Pick<AiVaultSessionTitle, 'title' | 'kind'> | null
  generatedTitle?: string | null
}

/** The one name order every tab and agent-row surface uses; '' leaves the plain live title to the caller. */
export function resolveTabNameSource(
  sources: TabNameSources,
  generatedTitlesEnabled: boolean
): string {
  const sessionTitle = sources.sessionTitle?.title.trim() ?? ''
  // Why: a quick-command label only names the tab until the session has a name of its own (a rename or
  // a provider-generated name); a first-prompt stand-in does not replace it. A typed tab name wins over both.
  const sessionNamed = sources.sessionTitle?.kind === 'named'
  return (
    sources.customTitle?.trim() ||
    (isMeaningfulOpenCodeTerminalTitle(sources.liveTitle) ? sources.liveTitle : '') ||
    (sessionNamed ? sessionTitle : '') ||
    sources.quickCommandLabel?.trim() ||
    sessionTitle ||
    (generatedTitlesEnabled ? sources.generatedTitle?.trim() : '') ||
    ''
  )
}

export function resolveTerminalTabTitle(
  tab: Pick<
    TerminalTab,
    'quickCommandLabel' | 'aiVaultTitle' | 'generatedTitle' | 'title' | 'defaultTitle'
  > & { customTitle?: string | null },
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
    resolveTabNameSource(
      {
        customTitle: tab.customTitle,
        quickCommandLabel: tab.quickCommandLabel,
        liveTitle,
        sessionTitle: tab.aiVaultTitle,
        generatedTitle: tab.generatedTitle
      },
      generatedTitlesEnabled
    ) ||
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
    resolveTabNameSource(
      {
        customTitle: tab?.customLabel,
        quickCommandLabel: tab?.quickCommandLabel,
        liveTitle: liveLabel,
        sessionTitle: tab?.aiVaultTitle,
        generatedTitle: tab?.generatedLabel
      },
      generatedTitlesEnabled
    ) ||
    liveLabel ||
    fallback
  )
}
