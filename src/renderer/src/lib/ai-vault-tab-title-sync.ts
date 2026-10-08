import type {
  AiVaultSessionTitleRequest,
  AiVaultSessionTitlesArgs,
  AiVaultSessionTitlesResult
} from '../../../shared/ai-vault-session-title'
import type { AppState } from '@/store/types'
import {
  collectAiVaultTitleRequests,
  type AiVaultTitleRequest
} from './ai-vault-tab-title-requests'
import { settleAiVaultTitleRequestBatches } from './ai-vault-tab-title-batches'
import { aiVaultTitleSyncInputsChanged } from './ai-vault-tab-title-sync-inputs'

const MISSING_TITLE_REFRESH_MS = 20_000
const LIVE_TITLE_REFRESH_MS = 5 * 60_000

function requestIdentity(request: AiVaultTitleRequest): string {
  return `${request.executionHostId}\0${request.agent}\0${request.providerSession.id}`
}

/** The wire shape for one request; the host resolves it back by the same identity. */
function toWireTitleRequest(request: AiVaultTitleRequest): AiVaultSessionTitleRequest {
  return {
    agent: request.agent,
    sessionId: request.providerSession.id,
    ...(request.providerSession.transcriptPath
      ? { transcriptPath: request.providerSession.transcriptPath }
      : {})
  }
}

type SyncDependencies = {
  getState: () => AppState
  resolveSessionTitles: (args: AiVaultSessionTitlesArgs) => Promise<AiVaultSessionTitlesResult>
  subscribe: (listener: (state: AppState, previous: AppState) => void) => () => void
  scheduleReconcile?: (callback: () => void) => () => void
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> | number
  clearTimer?: (timer: ReturnType<typeof setTimeout> | number) => void
}

function scheduleMicrotask(callback: () => void): () => void {
  let cancelled = false
  queueMicrotask(() => {
    if (!cancelled) {
      callback()
    }
  })
  return () => {
    cancelled = true
  }
}

function nextLiveRefreshDelay(state: AppState, requests: AiVaultTitleRequest[]): number | null {
  const liveRequests = requests.filter((request) => request.refresh)
  if (liveRequests.length === 0) {
    return null
  }
  const tabsById = new Map(
    Object.values(state.tabsByWorktree)
      .flat()
      .map((tab) => [tab.id, tab] as const)
  )
  const hasMissingTitle = liveRequests.some((request) => {
    const stored = tabsById.get(request.tabId)?.aiVaultTitle
    return (
      stored?.agent !== request.agent ||
      stored.sessionId !== request.providerSession.id ||
      !stored.title.trim()
    )
  })
  return hasMissingTitle ? MISSING_TITLE_REFRESH_MS : LIVE_TITLE_REFRESH_MS
}

/**
 * Re-resolve one tab's AI Vault conversation name on demand.
 *
 * Why: the background sync only re-asks when its inputs change, so a name that has
 * since changed in the provider's own transcript never reaches an already-open tab.
 * The context menu's "Sync Session Name" calls this for the tab it was opened on.
 *
 * Returns false when the tab has no resolvable agent session or the host answered
 * with no title; the stored name is then left as it was rather than cleared.
 */
export async function refreshAiVaultTabTitle(args: {
  getState: () => AppState
  resolveSessionTitles: (args: AiVaultSessionTitlesArgs) => Promise<AiVaultSessionTitlesResult>
  tabId: string
}): Promise<boolean> {
  const request = collectAiVaultTitleRequests(args.getState()).find(
    (candidate) => candidate.tabId === args.tabId
  )
  if (!request) {
    return false
  }
  let result: AiVaultSessionTitlesResult
  try {
    result = await args.resolveSessionTitles({
      executionHostScope: request.executionHostId,
      requests: [toWireTitleRequest(request)]
    })
  } catch {
    return false
  }
  const identity = requestIdentity(request)
  const title = result.titles
    .find((entry) => `${request.executionHostId}\0${entry.agent}\0${entry.sessionId}` === identity)
    ?.title.trim()
  if (!title) {
    return false
  }
  // Why re-collect: the tab may have died, or been reused by another agent
  // session, while the host was reading the transcript.
  const current = collectAiVaultTitleRequests(args.getState()).find(
    (candidate) => candidate.tabId === args.tabId
  )
  if (!current || requestIdentity(current) !== identity) {
    return false
  }
  args.getState().setAiVaultTabTitle(args.tabId, {
    agent: request.agent,
    sessionId: request.providerSession.id,
    title
  })
  return true
}

export function startAiVaultTabTitleSync(dependencies: SyncDependencies): () => void {
  const setTimer = dependencies.setTimer ?? setTimeout
  const clearTimer =
    dependencies.clearTimer ??
    ((timer: ReturnType<typeof setTimeout> | number) =>
      clearTimeout(timer as ReturnType<typeof setTimeout>))
  let refreshTimer: ReturnType<typeof setTimeout> | number | null = null
  let scanInFlight = false
  let scanAgain = false
  let scheduled = false
  let cancelScheduled: (() => void) | null = null
  let stopped = false
  let writing = false

  const writeTitle = (request: AiVaultTitleRequest, title: string | null): void => {
    writing = true
    try {
      dependencies
        .getState()
        .setAiVaultTabTitle(
          request.tabId,
          title ? { agent: request.agent, sessionId: request.providerSession.id, title } : null
        )
    } finally {
      writing = false
    }
  }

  const resolveBatch = async (requests: AiVaultTitleRequest[]): Promise<void> => {
    const first = requests[0]!
    const result = await dependencies.resolveSessionTitles({
      executionHostScope: first.executionHostId,
      requests: requests.map(toWireTitleRequest)
    })
    if (stopped) {
      return
    }
    const titleByIdentity = new Map<string, string>()
    for (const title of result.titles) {
      if (title.title.trim()) {
        titleByIdentity.set(
          `${first.executionHostId}\0${title.agent}\0${title.sessionId}`,
          title.title.trim()
        )
      }
    }
    const currentByTabId = new Map(
      collectAiVaultTitleRequests(dependencies.getState()).map((request) => [
        request.tabId,
        request
      ])
    )
    for (const request of requests) {
      const current = currentByTabId.get(request.tabId)
      const title = titleByIdentity.get(requestIdentity(request))
      if (current && requestIdentity(current) === requestIdentity(request) && title) {
        writeTitle(request, title)
      }
    }
  }

  const reconcile = async (): Promise<void> => {
    scheduled = false
    if (stopped) {
      return
    }
    if (scanInFlight) {
      scanAgain = true
      return
    }
    if (refreshTimer !== null) {
      clearTimer(refreshTimer)
      refreshTimer = null
    }

    const state = dependencies.getState()
    const tabsById = new Map(
      Object.values(state.tabsByWorktree)
        .flat()
        .map((tab) => [tab.id, tab] as const)
    )
    const requests = collectAiVaultTitleRequests(state)
    const requestsToScan = requests.filter((request) => {
      const stored = tabsById.get(request.tabId)?.aiVaultTitle
      const identityMatches =
        stored?.agent === request.agent && stored.sessionId === request.providerSession.id
      if (stored && !identityMatches) {
        writeTitle(request, null)
      }
      return request.refresh || !identityMatches || !stored?.title.trim()
    })

    if (requestsToScan.length > 0) {
      scanInFlight = true
      await settleAiVaultTitleRequestBatches(requestsToScan, resolveBatch)
      scanInFlight = false
    }

    if (scanAgain) {
      scanAgain = false
      schedule()
    } else if (!stopped) {
      const currentState = dependencies.getState()
      const currentRequests = collectAiVaultTitleRequests(currentState)
      const refreshDelay = nextLiveRefreshDelay(currentState, currentRequests)
      if (refreshDelay !== null) {
        refreshTimer = setTimer(schedule, refreshDelay)
      }
    }
  }

  function schedule(): void {
    if (scheduled || stopped) {
      return
    }
    scheduled = true
    cancelScheduled = (dependencies.scheduleReconcile ?? scheduleMicrotask)(() => {
      cancelScheduled = null
      void reconcile()
    })
  }

  const unsubscribe = dependencies.subscribe((state, previous) => {
    if (!writing && aiVaultTitleSyncInputsChanged(state, previous)) {
      schedule()
    }
  })
  schedule()

  return () => {
    stopped = true
    unsubscribe()
    cancelScheduled?.()
    cancelScheduled = null
    if (refreshTimer !== null) {
      clearTimer(refreshTimer)
    }
  }
}
