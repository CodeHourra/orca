import { readDetectedAgentsForWorktree } from '@/lib/agent-detection-target-inventory'
import { resolveAgentLaunchExecutionContext } from '@/lib/launch-agent-execution-context'
import { buildAgentStartupPlan } from '@/lib/tui-agent-startup'
import { tuiAgentToAgentKind } from '@/lib/telemetry'
import { isTuiAgentEnabled, pickTuiAgent } from '../../../shared/tui-agent-selection'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../shared/tui-agent-launch-defaults'
import { useAppStore } from '@/store'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { AgentStartupShell } from '../../../shared/tui-agent-startup-shell'
import type { LaunchSource } from '../../../shared/telemetry-events'
import type { TuiAgent } from '../../../shared/tui-agent'
import type { WorktreeStartupPayload } from '@/lib/worktree-startup-payload'

export function resolveEmptyWorktreeDefaultAgent(args: {
  settings: Pick<GlobalSettings, 'defaultTuiAgent' | 'disabledTuiAgents'> | null | undefined
  detectedAgentIds: readonly TuiAgent[] | null | undefined
}): TuiAgent | null {
  const preferred = args.settings?.defaultTuiAgent
  if (preferred === 'blank') {
    return null
  }
  if (preferred) {
    return isTuiAgentEnabled(preferred, args.settings?.disabledTuiAgents) ? preferred : null
  }
  return pickTuiAgent(null, args.detectedAgentIds ?? [], args.settings?.disabledTuiAgents)
}

export function buildDefaultAgentStartupPayload(args: {
  agent: TuiAgent
  settings: GlobalSettings
  launchSource: LaunchSource
  platform: NodeJS.Platform
  isRemote: boolean
  shell?: AgentStartupShell
}): WorktreeStartupPayload | undefined {
  const { agent, settings, launchSource, platform, isRemote, shell } = args
  const startupPlan = buildAgentStartupPlan({
    agent,
    prompt: '',
    cmdOverrides: settings.agentCmdOverrides ?? {},
    agentArgs: resolveTuiAgentLaunchArgs(agent, settings),
    agentEnv: resolveTuiAgentLaunchEnv(agent, settings, platform),
    platform,
    ...(shell ? { shell } : {}),
    isRemote,
    allowEmptyPromptLaunch: true
  })
  if (!startupPlan) {
    return undefined
  }
  return {
    command: startupPlan.launchCommand,
    ...(startupPlan.env ? { env: startupPlan.env } : {}),
    launchConfig: startupPlan.launchConfig,
    launchAgent: agent,
    ...(startupPlan.sessionOptions ? { sessionOptions: startupPlan.sessionOptions } : {}),
    ...(startupPlan.startupCommandDelivery
      ? { startupCommandDelivery: startupPlan.startupCommandDelivery }
      : {}),
    telemetry: {
      agent_kind: tuiAgentToAgentKind(agent),
      launch_source: launchSource,
      request_kind: 'new'
    }
  }
}

/**
 * Why: an activation that seeds a plain shell for a never-visited workspace must follow
 * Settings → Agents instead, so clicking an empty worktree matches the configured default.
 */
export function buildEmptyWorktreeDefaultAgentStartup(
  worktreeId: string
): WorktreeStartupPayload | undefined {
  const state = useAppStore.getState()
  const settings = state.settings
  if (!settings) {
    return undefined
  }
  const agent = resolveEmptyWorktreeDefaultAgent({
    settings,
    detectedAgentIds: readDetectedAgentsForWorktree(state, worktreeId)
  })
  if (!agent) {
    return undefined
  }
  const context = resolveAgentLaunchExecutionContext(state, { worktreeId })
  if (!context) {
    return undefined
  }
  return buildDefaultAgentStartupPayload({
    agent,
    settings,
    launchSource: 'sidebar',
    platform: context.resolvedLaunchPlatform,
    isRemote: context.isRemote,
    ...(context.queuedShell ? { shell: context.queuedShell } : {})
  })
}
