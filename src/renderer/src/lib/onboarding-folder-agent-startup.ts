import { isTuiAgentEnabled } from '../../../shared/tui-agent-selection'
import type { AgentStartedTelemetry } from '@/lib/worktree-startup-payload'
import type { StartupCommandDelivery } from '../../../shared/codex-startup-delivery'
import type { SleepingAgentLaunchConfig } from '../../../shared/agent-session-resume'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { OnboardingState } from '../../../shared/onboarding-state-types'
import type { TuiAgent } from '../../../shared/tui-agent'
import type { SessionOptionValue } from '../../../shared/native-chat-session-options'
import { buildDefaultAgentStartupPayload } from '@/lib/default-agent-startup-payload'
import {
  hasExplicitTuiLaunchCustomization,
  resolveAgentLaunchRoute,
  type AgentLaunchRoute
} from '@/lib/agent-launch-routing'
import { readLocalRuntimeCapabilities } from '@/runtime/local-runtime-capabilities'

export type OnboardingFolderAgentStartup = {
  command: string
  env?: Record<string, string>
  launchConfig?: SleepingAgentLaunchConfig
  launchAgent?: TuiAgent
  startupCommandDelivery?: StartupCommandDelivery
  sessionOptions?: Record<string, SessionOptionValue>
  telemetry: AgentStartedTelemetry
}

function getClientPlatform(): NodeJS.Platform {
  if (navigator.userAgent.includes('Windows')) {
    return 'win32'
  }
  return navigator.userAgent.includes('Mac') ? 'darwin' : 'linux'
}

export function buildOnboardingFolderAgentStartup(
  settings: GlobalSettings | null,
  nativeChatTranscriptIsLocalReadable = true
): OnboardingFolderAgentStartup | undefined {
  const agent = settings?.defaultTuiAgent
  if (
    !settings ||
    !agent ||
    agent === 'blank' ||
    !isTuiAgentEnabled(agent, settings.disabledTuiAgents)
  ) {
    return undefined
  }

  const startup = buildDefaultAgentStartupPayload({
    agent,
    settings,
    launchSource: 'onboarding',
    nativeChatTranscriptIsLocalReadable,
    platform: getClientPlatform()
  })
  if (!startup?.telemetry) {
    return undefined
  }
  return { ...startup, telemetry: startup.telemetry }
}

export function shouldSeedFolderAgentAfterDismissedOnboarding(
  onboarding: OnboardingState | null,
  hasExistingProject: boolean
): boolean {
  return (
    onboarding?.outcome === 'dismissed' &&
    !hasExistingProject &&
    !onboarding.checklist.addedRepo &&
    !onboarding.checklist.addedFolder
  )
}

export function buildDismissedOnboardingFolderAgentStartup(
  settings: GlobalSettings | null,
  onboarding: OnboardingState | null,
  hasExistingProject: boolean,
  nativeChatTranscriptIsLocalReadable = true
): OnboardingFolderAgentStartup | undefined {
  if (!shouldSeedFolderAgentAfterDismissedOnboarding(onboarding, hasExistingProject)) {
    return undefined
  }
  return buildOnboardingFolderAgentStartup(settings, nativeChatTranscriptIsLocalReadable)
}

export function resolveDismissedOnboardingFolderAgentLaunch(args: {
  settings: GlobalSettings | null
  onboarding: OnboardingState | null
  hasExistingProject: boolean
  executionHostId: string
  nativeChatTranscriptIsLocalReadable?: boolean
}): {
  agent: TuiAgent | null
  route: AgentLaunchRoute
  startup?: OnboardingFolderAgentStartup
  fallbackStartup?: OnboardingFolderAgentStartup
} {
  const startup = buildDismissedOnboardingFolderAgentStartup(
    args.settings,
    args.onboarding,
    args.hasExistingProject,
    args.nativeChatTranscriptIsLocalReadable
  )
  const agent = startup?.launchAgent ?? null
  if (!startup || !agent) {
    return { agent: null, route: 'terminal-tui' }
  }
  const route = resolveAgentLaunchRoute({
    agent,
    settings: args.settings,
    executionHostId: args.executionHostId,
    platform: getClientPlatform(),
    hostCapabilities: readLocalRuntimeCapabilities(),
    workspaceKind: 'folder',
    nativeChatTranscriptIsLocalReadable: args.nativeChatTranscriptIsLocalReadable,
    requiresTuiLaunchCustomization: hasExplicitTuiLaunchCustomization(args.settings, agent),
    initialSessionOptions: startup.sessionOptions
  })
  return {
    agent,
    route,
    ...(route === 'structured-native-chat' ? { fallbackStartup: startup } : { startup })
  }
}
