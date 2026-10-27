import { useAppStore } from '@/store'
import { persistAgentLaunchTabOrder } from '@/lib/launch-agent-tab-order'
import { tuiAgentToAgentKind } from '@/lib/telemetry'
import { runtimeEnvironmentIdOrLocalUnlessTwin } from '@/lib/worktree-runtime-owner'
import { createWebRuntimeSessionTerminal } from '@/runtime/web-runtime-terminal-creation'
import { isWebRuntimeSessionActive } from '@/runtime/web-runtime-session-environment'
import type { AiVaultAgent } from '../../../shared/ai-vault-types'
import { isAiVaultTitleAgent } from '../../../shared/ai-vault-session-title'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentLaunchConfig
} from '../../../shared/agent-session-resume'
import type { TabSplitDirection } from '@/store/slices/tabs'
import type { WebRuntimeTerminalCreateOutcome } from '@/runtime/web-runtime-session-types'

export type LaunchAiVaultSessionInNewTabResult =
  | { tabId: string }
  | { tabId: null; runtimeLaunch: Promise<WebRuntimeTerminalCreateOutcome> }

function seedAiVaultResumeTabTitle(args: {
  agent: AiVaultAgent
  tabId: string
  title?: string
  sessionId?: string
}): void {
  const title = args.title?.trim()
  if (!title) {
    return
  }
  const store = useAppStore.getState()
  if (isAiVaultTitleAgent(args.agent) && args.sessionId?.trim()) {
    store.setAiVaultTabTitle(args.tabId, {
      agent: args.agent,
      sessionId: args.sessionId.trim(),
      title
    })
    return
  }
  // Why: aiVaultTitle only models Claude/Codex, and a live OSC title outranks the
  // plain tab title — every other agent would overwrite the resumed conversation
  // name seconds after launch. customTitle is the only field that survives it.
  store.setTabCustomTitle(args.tabId, title, { recordInteraction: false })
}

export function launchAiVaultSessionInNewTab(args: {
  agent: AiVaultAgent
  worktreeId: string
  command: string
  cwd?: string
  env?: Record<string, string>
  envToDelete?: string[]
  launchConfig?: SleepingAgentLaunchConfig
  providerSession?: AgentProviderSessionMetadata
  title?: string
  sessionId?: string
  targetGroupId?: string
  splitDirection?: TabSplitDirection
}): LaunchAiVaultSessionInNewTabResult {
  const store = useAppStore.getState()
  // Why both paths split: the runtime path used to return first and drop the split (#22791).
  const split =
    args.splitDirection && args.targetGroupId
      ? { sourceGroupId: args.targetGroupId, splitDirection: args.splitDirection }
      : undefined
  const runtimeEnvironmentId = runtimeEnvironmentIdOrLocalUnlessTwin(store, args.worktreeId)
  if (isWebRuntimeSessionActive(runtimeEnvironmentId)) {
    // Why an empty group first: the paired host creates the tab after a round trip.
    const splitGroupId = split
      ? store.createEmptySplitGroup(args.worktreeId, split.sourceGroupId, split.splitDirection)
      : null
    const targetGroupId = splitGroupId ?? args.targetGroupId
    const runtimeLaunch = createWebRuntimeSessionTerminal(
      {
        worktreeId: args.worktreeId,
        environmentId: runtimeEnvironmentId,
        ...(targetGroupId ? { targetGroupId } : {}),
        agentSessionKind: 'resume',
        launchAgent: args.agent,
        command: args.command,
        ...(args.cwd ? { cwd: args.cwd } : {}),
        ...(args.env ? { env: args.env } : {}),
        ...(args.envToDelete ? { envToDelete: args.envToDelete } : {}),
        ...(args.launchConfig ? { launchConfig: args.launchConfig } : {}),
        ...(args.providerSession ? { providerSession: args.providerSession } : {}),
        ...(args.launchConfig ? { agentArgs: args.launchConfig.agentArgs } : {}),
        activate: true
      },
      { notifyFailure: false }
    )
    const observedRuntimeLaunch = runtimeLaunch.then((outcome) => {
      if (outcome.status === 'created') {
        useAppStore.getState().setActiveTabType('terminal', args.worktreeId)
      } else if (splitGroupId) {
        // A refused or failed drop must not leave a blank pane behind.
        useAppStore.getState().closeEmptyGroup(args.worktreeId, splitGroupId)
      }
      return outcome
    })
    return { tabId: null, runtimeLaunch: observedRuntimeLaunch }
  }

  const tab = store.createTab(args.worktreeId, args.targetGroupId, undefined, {
    ...(split ? { split } : {}),
    ...(args.cwd ? { startupCwd: args.cwd } : {}),
    launchAgent: args.agent,
    pendingStartup: {
      command: args.command,
      ...(args.env ? { env: args.env } : {}),
      ...(args.envToDelete ? { envToDelete: args.envToDelete } : {}),
      ...(args.launchConfig ? { launchConfig: args.launchConfig, launchAgent: args.agent } : {}),
      ...(args.providerSession ? { resumeProviderSession: args.providerSession } : {}),
      telemetry: {
        agent_kind: tuiAgentToAgentKind(args.agent),
        launch_source: 'sidebar',
        request_kind: 'resume'
      }
    },
    // Why: the claim must ride tab creation — the resumed shell is spawned with the tab.
    ...(args.providerSession
      ? {
          automaticResumeClaim: {
            worktreeId: args.worktreeId,
            launchAgent: args.agent,
            providerSession: args.providerSession
          }
        }
      : {})
  })
  seedAiVaultResumeTabTitle({
    agent: args.agent,
    tabId: tab.id,
    ...(args.title ? { title: args.title } : {}),
    ...(args.sessionId ? { sessionId: args.sessionId } : {})
  })
  store.setActiveTabType('terminal', args.worktreeId)

  persistAgentLaunchTabOrder(args.worktreeId, tab.id)

  return { tabId: tab.id }
}
