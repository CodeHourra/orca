import { toast } from 'sonner'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { buildAgentExplanationForkPrompt } from '@/lib/agent-session-fork-context'
import { isFloatingWorkspacePanelVisible } from '@/lib/floating-workspace-terminal-actions'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { useAppStore } from '@/store'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { getLocalProjectExecutionRuntimeContext } from '@/lib/local-preflight-context'
import { translate } from '@/i18n/i18n'
import { getForkAgentLaunchPlatform, resolveTuiAgent } from './terminal-agent-session-fork'

type ExplainAgentSelectionFromPaneArgs = {
  pane: ManagedPane
  tabId: string
  worktreeId: string
  groupId: string | null
  selectedText: string
  cwd: string
  agentOverride?: TuiAgent | null
  capturedText?: string
}

type ExplainAgentSelectionArgs = {
  agent: TuiAgent | null
  worktreeId: string
  selectedText: string
  cwd?: string
  capturedText?: string
  sourceLabel?: string
  remote?: boolean
  restoreFocus?: () => void
}

function resolvePaneAgent(pane: ManagedPane, tabId: string, worktreeId: string): TuiAgent | null {
  const state = useAppStore.getState()
  const sourceAgent = resolveTuiAgent(
    state.agentStatusByPaneKey[makePaneKey(tabId, pane.leafId)]?.agentType
  )
  const tabAgent = resolveTuiAgent(
    state.tabsByWorktree[worktreeId]?.find((tab) => tab.id === tabId)?.launchAgent
  )
  return sourceAgent ?? tabAgent
}

export async function explainAgentSelectionFromPane({
  pane,
  tabId,
  worktreeId,
  selectedText,
  cwd,
  agentOverride,
  capturedText
}: ExplainAgentSelectionFromPaneArgs): Promise<boolean> {
  const agent = agentOverride ?? resolvePaneAgent(pane, tabId, worktreeId)
  return explainAgentSelection({
    agent,
    worktreeId,
    selectedText,
    cwd,
    capturedText: capturedText ?? pane.serializeAddon.serialize({ scrollback: 800 }),
    sourceLabel: makePaneKey(tabId, pane.leafId),
    restoreFocus: () => pane.terminal.focus()
  })
}

export async function explainAgentSelection({
  agent,
  worktreeId,
  selectedText,
  cwd,
  capturedText = '',
  sourceLabel,
  remote = false,
  restoreFocus
}: ExplainAgentSelectionArgs): Promise<boolean> {
  const state = useAppStore.getState()
  if (state.settings?.floatingTerminalEnabled !== true) {
    toast.error(
      translate(
        'components.terminal.agentExplanationFork.floatingWorkspaceDisabled',
        'Enable Floating Workspace to use Expand on this.'
      )
    )
    restoreFocus?.()
    return false
  }
  const sourceWorktree = state.getKnownWorktreeById(worktreeId)
  const sourceRepo = sourceWorktree
    ? state.repos.find((repo) => repo.id === sourceWorktree.repoId)
    : null
  const launchPlatform = getForkAgentLaunchPlatform({
    repo: sourceRepo,
    worktreePath: sourceWorktree?.path,
    projectRuntime: getLocalProjectExecutionRuntimeContext(state, worktreeId)
  })
  // Floating Workspace is local-only; launching remote context there would target the wrong host.
  if (remote || launchPlatform === 'linux') {
    toast.error(
      translate(
        'components.terminal.agentExplanationFork.remoteUnavailable',
        'Expand on this is not yet available for SSH or WSL sessions.'
      )
    )
    restoreFocus?.()
    return false
  }
  if (!agent) {
    toast.error(
      translate(
        'components.terminal.agentExplanationFork.agentUnavailable',
        'Could not identify the Agent for this selection.'
      )
    )
    restoreFocus?.()
    return false
  }
  const prompt = buildAgentExplanationForkPrompt({
    capturedText,
    selectedText,
    cwd,
    sourceLabel,
    agentLabel: agent
  })
  if (!prompt) {
    restoreFocus?.()
    return false
  }
  const result = launchAgentInNewTab({
    agent,
    worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
    initialCwd: cwd,
    prompt,
    promptDelivery: 'submit-after-ready',
    launchSource: 'terminal_context_menu'
  })
  if (!result) {
    toast.error(
      translate(
        'components.terminal.agentExplanationFork.launchFailed',
        'Could not open the explanation session.'
      )
    )
    restoreFocus?.()
    return false
  }
  if (!isFloatingWorkspacePanelVisible()) {
    window.dispatchEvent(new Event(TOGGLE_FLOATING_TERMINAL_EVENT))
  }
  if (result.promptDeliveryResult) {
    const delivery = await result.promptDeliveryResult
    if (!delivery.delivered) {
      return false
    }
  }
  return true
}
