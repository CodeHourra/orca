import { stripLeadingAgentTitleDecoration } from '../../../../shared/agent-title-decoration'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'

/** What the strip draws for a terminal or native chat tab; never a source of agent identity. */
export type SortableTabModel = Pick<
  TerminalTab,
  'id' | 'worktreeId' | 'title' | 'customTitle' | 'color' | 'shellOverride' | 'launchAgent'
>

/**
 * The strip's label for one terminal tab: the caller's agent-aware title, with the agent's own
 * leading glyph stripped when a provider icon already shows it.
 */
export function resolveSortableTabDisplayTitle(
  tab: SortableTabModel,
  agent: unknown,
  resolvedTitle: string | undefined
): string {
  const title = resolvedTitle ?? tab.title
  return tab.customTitle ?? (agent ? stripLeadingAgentTitleDecoration(title) : title)
}
