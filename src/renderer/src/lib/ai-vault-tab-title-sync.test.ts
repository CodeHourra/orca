import { describe, expect, it, vi } from 'vitest'
import type {
  AiVaultSessionTitle,
  AiVaultSessionTitlesResult
} from '../../../shared/ai-vault-session-title'
import { resolveTerminalTabTitle } from '../../../shared/tab-title-resolution'
import type { TerminalTab } from '../../../shared/terminal-tab-types'
import {
  collectAiVaultTitleRequests,
  type AiVaultTitleRequest
} from './ai-vault-tab-title-requests'
import {
  batchAiVaultTitleRequests,
  settleAiVaultTitleRequestBatches
} from './ai-vault-tab-title-batches'
import { refreshAiVaultTabTitle, startAiVaultTabTitleSync } from './ai-vault-tab-title-sync'
import type { AppState } from '@/store/types'

function terminalTab(worktreeId: string, aiVaultTitle?: TerminalTab['aiVaultTitle']): TerminalTab {
  return {
    id: 'tab-1',
    ptyId: null,
    worktreeId,
    title: '⠋ albacore',
    aiVaultTitle,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
}

function titleResult(
  agent: AiVaultSessionTitle['agent'],
  title: string
): AiVaultSessionTitlesResult {
  return { titles: [{ agent, sessionId: `${agent}-session`, title }] }
}

function makeState(args: {
  agent?: AiVaultSessionTitle['agent']
  aiVaultTitle?: TerminalTab['aiVaultTitle']
  executionHostId: 'ssh:dev-box' | 'runtime:server-1'
  sleeping?: boolean
  path: string
  worktreeId: string
}) {
  const agent = args.agent ?? 'codex'
  const tab = terminalTab(args.worktreeId, args.aiVaultTitle)
  const listeners = new Set<(state: AppState, previous: AppState) => void>()
  const providerSession = {
    key: 'session_id' as const,
    id: `${agent}-session`,
    transcriptPath: `/sessions/${agent}.jsonl`
  }
  const statusEntry = {
    state: 'done' as const,
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    agentType: agent,
    paneKey: 'tab-1:leaf-1',
    tabId: 'tab-1',
    worktreeId: args.worktreeId,
    providerSession,
    stateHistory: []
  }
  let state = {
    activeWorktreeId: args.worktreeId,
    activeWorkspaceExecutionHostId: args.executionHostId,
    agentStatusByPaneKey: args.sleeping ? {} : { 'tab-1:leaf-1': statusEntry },
    retainedAgentsByPaneKey: {},
    sleepingAgentSessionsByPaneKey: args.sleeping
      ? {
          'tab-1:leaf-1': {
            paneKey: 'tab-1:leaf-1',
            tabId: 'tab-1',
            worktreeId: args.worktreeId,
            agent,
            providerSession,
            prompt: '',
            state: 'done',
            capturedAt: 1,
            updatedAt: 1,
            origin: 'worktree-sleep'
          }
        }
      : {},
    tabsByWorktree: { [args.worktreeId]: [tab] },
    terminalLayoutsByTabId: {
      'tab-1': {
        root: { type: 'leaf', leafId: 'leaf-1' },
        activeLeafId: 'leaf-1',
        expandedLeafId: null
      }
    },
    worktreesByRepo: {},
    detectedWorktreesByRepo: {},
    folderWorkspaces: [],
    getKnownWorktreeById: () => ({ path: args.path }),
    setAiVaultTabTitle: (tabId: string, aiVaultTitle: TerminalTab['aiVaultTitle'] | null) => {
      const previous = state
      state = {
        ...state,
        tabsByWorktree: {
          [args.worktreeId]: state.tabsByWorktree[args.worktreeId].map((entry: TerminalTab) =>
            entry.id === tabId ? { ...entry, aiVaultTitle } : entry
          )
        }
      }
      for (const listener of listeners) {
        listener(state, previous)
      }
    }
  } as unknown as AppState
  return {
    getState: () => state,
    pingAgentStatus: () => {
      const previous = state
      state = {
        ...state,
        agentStatusByPaneKey: Object.fromEntries(
          Object.entries(state.agentStatusByPaneKey).map(([paneKey, entry]) => [
            paneKey,
            { ...entry, updatedAt: entry.updatedAt + 1 }
          ])
        )
      }
      for (const listener of listeners) {
        listener(state, previous)
      }
    },
    setProviderSessionId: (sessionId: string) => {
      const previous = state
      state = {
        ...state,
        agentStatusByPaneKey: Object.fromEntries(
          Object.entries(state.agentStatusByPaneKey).map(([paneKey, entry]) => {
            if (!entry.providerSession) {
              return [paneKey, entry]
            }
            return [
              paneKey,
              { ...entry, providerSession: { ...entry.providerSession, id: sessionId } }
            ]
          })
        )
      }
      for (const listener of listeners) {
        listener(state, previous)
      }
    },
    setWorkspacePath: (path: string) => {
      args.path = path
      const previous = state
      state = { ...state, worktreesByRepo: { changed: [] } }
      for (const listener of listeners) {
        listener(state, previous)
      }
    },
    removeSleepingRecord: () => {
      const previous = state
      state = { ...state, sleepingAgentSessionsByPaneKey: {} }
      for (const listener of listeners) {
        listener(state, previous)
      }
    },
    subscribe: (listener: (next: AppState, previous: AppState) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}

describe('AI Vault tab title sync', () => {
  it.each(['claude', 'codex', 'pi', 'omp'] as const)(
    'projects the canonical %s AI Vault session title',
    async (agent) => {
      const store = makeState({
        agent,
        executionHostId: 'ssh:dev-box',
        worktreeId: 'worktree-1',
        path: '/workspace/albacore'
      })
      const resolveSessionTitles = vi.fn(async () => titleResult(agent, `${agent} conversation`))
      const stop = startAiVaultTabTitleSync({ ...store, resolveSessionTitles })

      await vi.waitFor(() =>
        expect(store.getState().tabsByWorktree['worktree-1'][0].aiVaultTitle).toEqual({
          agent,
          sessionId: `${agent}-session`,
          title: `${agent} conversation`
        })
      )
      expect(resolveSessionTitles).toHaveBeenCalledWith({
        executionHostScope: 'ssh:dev-box',
        requests: [
          {
            agent,
            sessionId: `${agent}-session`,
            transcriptPath: `/sessions/${agent}.jsonl`
          }
        ]
      })
      stop()
    }
  )

  it('uses runtime host authority for folder workspaces', () => {
    const store = makeState({
      executionHostId: 'runtime:server-1',
      worktreeId: 'folder:folder-1',
      path: '/srv/folders/albacore'
    })

    expect(collectAiVaultTitleRequests(store.getState())).toEqual([
      expect.objectContaining({
        executionHostId: 'runtime:server-1',
        tabId: 'tab-1',
        worktreeId: 'folder:folder-1'
      })
    ])
  })

  it('retains a recovered sleeping title after its lifecycle record disappears', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore',
      sleeping: true
    })
    const stop = startAiVaultTabTitleSync({
      ...store,
      resolveSessionTitles: async () => titleResult('codex', 'Stable conversation')
    })

    await vi.waitFor(() =>
      expect(store.getState().tabsByWorktree['worktree-1'][0].aiVaultTitle).toBeTruthy()
    )
    store.removeSleepingRecord()
    const restored = store.getState().tabsByWorktree['worktree-1'][0] as TerminalTab
    expect(resolveTerminalTabTitle(restored, false)).toBe('Stable conversation')
    stop()
  })

  it('refreshes a live title when the AI Vault name changes', async () => {
    const store = makeState({
      aiVaultTitle: { agent: 'codex', sessionId: 'codex-session', title: 'First name' },
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    let title = 'First name'
    let refresh: (() => void) | undefined
    const stop = startAiVaultTabTitleSync({
      ...store,
      resolveSessionTitles: async () => titleResult('codex', title),
      setTimer: (callback, delay) => {
        expect(delay).toBe(5 * 60_000)
        refresh = callback
        return 1
      },
      clearTimer: () => {}
    })

    await vi.waitFor(() => expect(refresh).toBeTypeOf('function'))
    title = 'Renamed conversation'
    refresh?.()
    await vi.waitFor(() =>
      expect(store.getState().tabsByWorktree['worktree-1'][0].aiVaultTitle?.title).toBe(
        'Renamed conversation'
      )
    )
    stop()
  })

  it('retries a missing live title without waiting for the long refresh', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    let refreshDelay: number | undefined
    const stop = startAiVaultTabTitleSync({
      ...store,
      resolveSessionTitles: async () => ({ titles: [] }),
      setTimer: (_callback, delay) => {
        refreshDelay = delay
        return 1
      },
      clearTimer: () => {}
    })

    await vi.waitFor(() => expect(refreshDelay).toBe(20_000))
    stop()
  })

  it('defers title reads through the configured background scheduler', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    const resolveSessionTitles = vi.fn(async () => titleResult('codex', 'Deferred conversation'))
    let runScheduled: (() => void) | undefined
    const cancelScheduled = vi.fn()
    const stop = startAiVaultTabTitleSync({
      ...store,
      resolveSessionTitles,
      scheduleReconcile: (callback) => {
        runScheduled = callback
        return cancelScheduled
      }
    })

    expect(resolveSessionTitles).not.toHaveBeenCalled()
    runScheduled?.()
    await vi.waitFor(() => expect(resolveSessionTitles).toHaveBeenCalledTimes(1))
    stop()
  })

  it('does not reread when a live status ping preserves title inputs', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    const resolveSessionTitles = vi.fn(async () => titleResult('codex', 'Stable conversation'))
    const stop = startAiVaultTabTitleSync({ ...store, resolveSessionTitles })

    await vi.waitFor(() => expect(resolveSessionTitles).toHaveBeenCalledTimes(1))
    store.pingAgentStatus()
    await Promise.resolve()
    await Promise.resolve()

    expect(resolveSessionTitles).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not reread titles when only the worktree path changes', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    const resolveSessionTitles = vi.fn(async () => titleResult('codex', 'Stable conversation'))
    const stop = startAiVaultTabTitleSync({ ...store, resolveSessionTitles })

    await vi.waitFor(() => expect(resolveSessionTitles).toHaveBeenCalledTimes(1))
    store.setWorkspacePath('/workspace/renamed-albacore')
    await Promise.resolve()
    await Promise.resolve()

    expect(resolveSessionTitles).toHaveBeenCalledTimes(1)
    stop()
  })

  it('reconciles immediately when the provider session identity changes', async () => {
    const store = makeState({
      executionHostId: 'ssh:dev-box',
      worktreeId: 'worktree-1',
      path: '/workspace/albacore'
    })
    const resolveSessionTitles = vi.fn(async () => titleResult('codex', 'Original conversation'))
    const stop = startAiVaultTabTitleSync({ ...store, resolveSessionTitles })

    await vi.waitFor(() => expect(resolveSessionTitles).toHaveBeenCalledTimes(1))
    store.setProviderSessionId('codex-session-2')

    await vi.waitFor(() => expect(resolveSessionTitles).toHaveBeenCalledTimes(2))
    expect(store.getState().tabsByWorktree['worktree-1'][0].aiVaultTitle).toBeNull()
    stop()
  })

  it('batches title identities per host within the wire bound', () => {
    const request = (index: number): AiVaultTitleRequest => ({
      agent: 'codex',
      executionHostId: 'ssh:dev-box',
      providerSession: { key: 'session_id', id: `session-${index}` },
      refresh: true,
      tabId: `tab-${index}`,
      worktreeId: `worktree-${index}`
    })
    const groups = batchAiVaultTitleRequests(
      Array.from({ length: 65 }, (_, index) => request(index))
    )

    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveLength(64)
    expect(groups[1]).toHaveLength(1)
  })

  it('runs hosts concurrently while serializing each host wire', async () => {
    const request = (executionHostId: AiVaultTitleRequest['executionHostId'], index: number) => ({
      agent: 'codex' as const,
      executionHostId,
      providerSession: { key: 'session_id' as const, id: `session-${index}` },
      refresh: true,
      tabId: `tab-${index}`,
      worktreeId: `worktree-${index}`
    })
    const requests = [
      ...Array.from({ length: 65 }, (_, index) => request('ssh:dev-box', index)),
      request('runtime:server-1', 100)
    ]
    const calls: AiVaultTitleRequest[][] = []
    const completions: (() => void)[] = []
    const pending = settleAiVaultTitleRequestBatches(
      requests,
      (batch) =>
        new Promise<void>((resolve) => {
          calls.push(batch)
          completions.push(resolve)
        })
    )

    await vi.waitFor(() => expect(calls).toHaveLength(2))
    expect(calls.map((batch) => batch[0]!.executionHostId)).toEqual([
      'ssh:dev-box',
      'runtime:server-1'
    ])
    completions[0]!()
    await vi.waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[2]).toHaveLength(1)
    completions[1]!()
    completions[2]!()
    await pending
  })

  it('keeps the released agent tier apart from the widened one', () => {
    const request = (
      agent: AiVaultTitleRequest['agent'],
      executionHostId: AiVaultTitleRequest['executionHostId'],
      index: number
    ): AiVaultTitleRequest => ({
      agent,
      executionHostId,
      providerSession: { key: 'session_id', id: `session-${index}` },
      refresh: true,
      tabId: `tab-${index}`,
      worktreeId: `worktree-${index}`
    })
    const groups = batchAiVaultTitleRequests([
      request('claude', 'runtime:server-1', 1),
      request('omp', 'runtime:server-1', 2),
      request('pi', 'runtime:server-1', 3),
      request('codex', 'runtime:server-1', 4)
    ])

    // Why split: an older host's closed `agent` enum rejects the whole request, so a
    // mixed batch would lose the claude/codex titles along with the widened ones.
    expect(groups).toHaveLength(2)
    expect(groups[0]!.map((entry) => entry.agent)).toEqual(['claude', 'codex'])
    expect(groups[1]!.map((entry) => entry.agent)).toEqual(['omp', 'pi'])
  })

  describe('refreshAiVaultTabTitle', () => {
    it('replaces a stale stored name with the provider transcript\u2019s current one', async () => {
      const store = makeState({
        executionHostId: 'ssh:dev-box',
        worktreeId: 'worktree-1',
        path: '/workspace/albacore'
      })
      store.getState().setAiVaultTabTitle('tab-1', {
        agent: 'codex',
        sessionId: 'codex-session',
        title: 'Stale name Orca cached earlier'
      })
      const resolveSessionTitles = vi.fn(async () =>
        titleResult('codex', 'Renamed in the transcript')
      )

      await expect(
        refreshAiVaultTabTitle({ ...store, resolveSessionTitles, tabId: 'tab-1' })
      ).resolves.toBe(true)

      expect(resolveSessionTitles).toHaveBeenCalledWith({
        executionHostScope: 'ssh:dev-box',
        requests: [
          {
            agent: 'codex',
            sessionId: 'codex-session',
            transcriptPath: '/sessions/codex.jsonl'
          }
        ]
      })
      expect(store.getState().tabsByWorktree['worktree-1'][0]?.aiVaultTitle).toEqual({
        agent: 'codex',
        sessionId: 'codex-session',
        title: 'Renamed in the transcript'
      })
    })

    it('keeps the stored name when the host answers with no title', async () => {
      const store = makeState({
        executionHostId: 'ssh:dev-box',
        worktreeId: 'worktree-1',
        path: '/workspace/albacore'
      })
      store.getState().setAiVaultTabTitle('tab-1', {
        agent: 'codex',
        sessionId: 'codex-session',
        title: 'Keep me'
      })

      await expect(
        refreshAiVaultTabTitle({
          ...store,
          // Why: a host without the session, an unreadable transcript, or a rejected
          // request all answer with an empty list rather than throwing.
          resolveSessionTitles: async () => ({ titles: [] }),
          tabId: 'tab-1'
        })
      ).resolves.toBe(false)

      expect(store.getState().tabsByWorktree['worktree-1'][0]?.aiVaultTitle?.title).toBe('Keep me')
    })

    it('answers false for a tab with no agent session, without asking the host', async () => {
      const store = makeState({
        executionHostId: 'ssh:dev-box',
        worktreeId: 'worktree-1',
        path: '/workspace/albacore'
      })
      const resolveSessionTitles = vi.fn(async () => titleResult('codex', 'Unused'))

      await expect(
        refreshAiVaultTabTitle({ ...store, resolveSessionTitles, tabId: 'no-such-tab' })
      ).resolves.toBe(false)
      expect(resolveSessionTitles).not.toHaveBeenCalled()
    })
  })
})
