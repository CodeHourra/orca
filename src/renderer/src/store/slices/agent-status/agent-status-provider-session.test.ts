import { normalizeHookPayload } from '../../../../../shared/agent-hook-listener/normalization/normalize-hook-payload'
import { createHookListenerState } from '../../../../../shared/agent-hook-listener/listener-state'
import { applyProviderSessionOnlyUpdate } from '../../../hooks/ipc-events/agent-status-partial-updates'
import { describe, expect, it } from 'vitest'

import type { SleepingAgentSessionRecord } from '../../../../../shared/agent-session/lifecycle/agent-session-resume'
import type { AppState } from '../../types'
import { getProviderSessionClaimKey } from '../../../../../shared/sleeping-record-legacy-pane-key'
import { createTestStore, seedStore } from '../store-test-helpers'
import { makeTab } from '../store-session-test-harness'
import '../../../../../shared/workspace-layout/stable-pane-id'

const PI_COMPATIBLE_CASES = [
  { agent: 'pi' as const, label: 'Pi' },
  { agent: 'omp' as const, label: 'OMP' },
  { agent: 'prime-agent' as const, label: 'Prime Agent' }
]

function makePiCompatibleProviderSession(agent: 'pi' | 'omp' | 'prime-agent') {
  return {
    key: 'session_id' as const,
    id: `${agent}-session-1`,
    transcriptPath: `/tmp/${agent}-session-1.jsonl`
  }
}

describe('recordAgentProviderSession', () => {
  it('does not capture a structured native owner for terminal resume on restart', () => {
    const store = createTestStore()
    const paneKey = 'structured-tab:leaf-1'
    const providerSession = { key: 'session_id' as const, id: 'provider-session-uuid' }

    store
      .getState()
      .setAgentStatus(
        paneKey,
        { state: 'working', prompt: 'keep going', agentType: 'claude' },
        'Claude Chat',
        undefined,
        { tabId: 'structured-tab', worktreeId: 'wt-1' },
        { providerSession, terminalResumeEligible: false }
      )
    store.getState().captureAllSleepingAgentSessions('quit')

    expect(store.getState().agentStatusByPaneKey[paneKey]?.providerSession).toEqual(providerSession)
    expect(store.getState().sleepingAgentSessionsByPaneKey[paneKey]).toBeUndefined()
  })

  // Repeated metadata-less done repaints/reconnects must retain resting session too, beyond the first done (#10630).
  it('keeps the provider session across repeated metadata-less done pings', () => {
    const store = createTestStore()
    const providerSession = { key: 'session_id' as const, id: 'claude-session-1' }

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'summarize the diff', agentType: 'claude' },
        'Claude',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession }
      )
    for (const prompt of ['summarize the diff', 'summarize the diff again']) {
      store
        .getState()
        .setAgentStatus('tab-1:leaf-1', { state: 'done', prompt, agentType: 'claude' })
    }

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toEqual(
      providerSession
    )
  })

  // Retention ends at turn boundary; fresh working after done must not inherit finished session.
  it('does not carry a completed session into the next turn', () => {
    const store = createTestStore()

    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'first', agentType: 'claude' },
        'Claude',
        { updatedAt: 10, stateStartedAt: 10 },
        undefined,
        { providerSession: { key: 'session_id' as const, id: 'claude-session-1' } }
      )
    store
      .getState()
      .setAgentStatus('tab-1:leaf-1', { state: 'done', prompt: 'first', agentType: 'claude' })
    store
      .getState()
      .setAgentStatus('tab-1:leaf-1', { state: 'working', prompt: 'second', agentType: 'claude' })

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.providerSession).toBeUndefined()
  })

  it('uses the session file as part of transcript-based resume ownership only', () => {
    const base = {
      paneKey: 'tab-1:leaf-1',
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      prompt: '',
      state: 'working' as const,
      capturedAt: 10,
      updatedAt: 10,
      origin: 'live' as const
    }
    const makeRecord = (
      agent: 'pi' | 'prime-agent' | 'omp' | 'claude',
      transcriptPath: string
    ): SleepingAgentSessionRecord => ({
      ...base,
      agent,
      providerSession: { key: 'session_id', id: 'session-1', transcriptPath }
    })

    expect(getProviderSessionClaimKey(makeRecord('pi', '/tmp/first.jsonl'))).not.toBe(
      getProviderSessionClaimKey(makeRecord('pi', '/tmp/second.jsonl'))
    )
    expect(getProviderSessionClaimKey(makeRecord('prime-agent', '/tmp/first.jsonl'))).not.toBe(
      getProviderSessionClaimKey(makeRecord('prime-agent', '/tmp/second.jsonl'))
    )
    // Why: OMP stays UUID-keyed (omp-resume-transcript-locator.md); a later hook adding the path
    // must not split one provider session into two claim identities.
    expect(getProviderSessionClaimKey(makeRecord('omp', '/tmp/first.jsonl'))).toBe(
      getProviderSessionClaimKey(makeRecord('omp', '/tmp/second.jsonl'))
    )
    expect(getProviderSessionClaimKey(makeRecord('claude', '/tmp/first.jsonl'))).toBe(
      getProviderSessionClaimKey(makeRecord('claude', '/tmp/second.jsonl'))
    )
  })
  it('keeps Pi session identity durable without fabricating a visible turn', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      }
    } as Partial<AppState>)
    const launchConfig = {
      agentCommand: "pi '--model' 'anthropic/claude-sonnet-4'",
      agentArgs: '--model anthropic/claude-sonnet-4',
      agentEnv: { PI_CODING_AGENT_DIR: '/tmp/pi-agent' }
    }
    const providerSession = {
      key: 'session_id' as const,
      id: 'pi-session-1',
      transcriptPath: '/tmp/pi-session-1.jsonl'
    }

    store.getState().registerAgentLaunchConfig('tab-1:leaf-1', launchConfig, {
      agentType: 'pi',
      launchToken: 'pi-launch-1',
      tabId: 'tab-1',
      leafId: 'leaf-1'
    })
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'stale turn', agentType: 'pi' },
        'Pi',
        { updatedAt: 10, stateStartedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1' }
      )

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'pi',
        providerSession,
        { updatedAt: 20 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: null },
        { launchToken: 'pi-launch-1' }
      )

    expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']).toBeUndefined()
    expect(store.getState().retainedAgentsByPaneKey['tab-1:leaf-1']).toBeUndefined()
    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      paneKey: 'tab-1:leaf-1',
      tabId: 'tab-1',
      worktreeId: 'wt-1',
      agent: 'pi',
      providerSession,
      launchConfig,
      origin: 'live'
    })

    const liveRecord = store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']
    store.getState().captureAllSleepingAgentSessions('periodic')
    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toBe(liveRecord)

    store.getState().captureSleepingAgentSessionsByWorktree('wt-1', ['tab-1:leaf-1'])
    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      providerSession,
      launchConfig,
      origin: 'worktree-sleep'
    })
  })

  it('does not reuse Pi launch config when the session file identity changes', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      },
      sleepingAgentSessionsByPaneKey: {
        'tab-1:leaf-1': {
          paneKey: 'tab-1:leaf-1',
          tabId: 'tab-1',
          worktreeId: 'wt-1',
          agent: 'pi',
          providerSession: {
            key: 'session_id',
            id: 'pi-session-1',
            transcriptPath: '/tmp/pi-session-old.jsonl'
          },
          prompt: '',
          state: 'working',
          capturedAt: 10,
          updatedAt: 10,
          launchConfig: { agentArgs: '--model old', agentEnv: { PI_PROFILE: 'old' } },
          origin: 'live'
        }
      }
    } as Partial<AppState>)

    store.getState().recordAgentProviderSession(
      'tab-1:leaf-1',
      'pi',
      {
        key: 'session_id',
        id: 'pi-session-1',
        transcriptPath: '/tmp/pi-session-new.jsonl'
      },
      { updatedAt: 20 },
      { tabId: 'tab-1', worktreeId: 'wt-1' }
    )

    expect(
      store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']?.launchConfig
    ).toBeUndefined()
  })

  it.each(PI_COMPATIBLE_CASES)(
    'keeps a completed $label session resumable through manual worktree sleep',
    async ({ agent, label }) => {
      const store = createTestStore()
      store.setState({
        tabsByWorktree: {
          'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
        }
      } as Partial<AppState>)
      const providerSession = makePiCompatibleProviderSession(agent)

      store
        .getState()
        .recordAgentProviderSession(
          'tab-1:leaf-1',
          agent,
          providerSession,
          { updatedAt: 10 },
          { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'working', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 20, stateStartedAt: 20 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )
      store
        .getState()
        .setAgentStatus(
          'tab-1:leaf-1',
          { state: 'done', prompt: 'finish the task', agentType: agent },
          label,
          { updatedAt: 30, stateStartedAt: 30 },
          { tabId: 'tab-1', worktreeId: 'wt-1' },
          { providerSession }
        )

      expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']?.state).toBe('done')
      const liveRecord = store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']
      expect(liveRecord).toMatchObject({
        agent,
        providerSession,
        connectionId: 'ssh-connection-1',
        state: 'done',
        origin: 'live'
      })

      store.getState().captureAllSleepingAgentSessions('periodic')
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toBe(liveRecord)

      await store.getState().shutdownWorktreeTerminals('wt-1', {
        keepIdentifiers: true,
        shutdownReason: 'manual-sleep',
        sleepingPaneKeys: ['tab-1:leaf-1']
      })

      expect(store.getState().agentStatusByPaneKey['tab-1:leaf-1']).toBeUndefined()
      expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
        agent,
        providerSession,
        connectionId: 'ssh-connection-1',
        state: 'working',
        origin: 'worktree-sleep'
      })
    }
  )

  it('does not downgrade a quit recovery record on a same-session update', () => {
    const store = createTestStore()
    store.setState({
      tabsByWorktree: {
        'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })]
      }
    } as Partial<AppState>)
    const providerSession = makePiCompatibleProviderSession('pi')

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'pi',
        providerSession,
        { updatedAt: 10 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'working', prompt: 'finish the task', agentType: 'pi' },
        'Pi',
        { updatedAt: 20, stateStartedAt: 20 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        { providerSession }
      )
    store
      .getState()
      .setAgentStatus(
        'tab-1:leaf-1',
        { state: 'done', prompt: 'finish the task', agentType: 'pi' },
        'Pi',
        { updatedAt: 30, stateStartedAt: 30 },
        { tabId: 'tab-1', worktreeId: 'wt-1' },
        { providerSession }
      )
    store.getState().captureAllSleepingAgentSessions('quit')

    store
      .getState()
      .recordAgentProviderSession(
        'tab-1:leaf-1',
        'pi',
        providerSession,
        { updatedAt: 40 },
        { tabId: 'tab-1', worktreeId: 'wt-1', connectionId: 'ssh-connection-1' }
      )

    expect(store.getState().sleepingAgentSessionsByPaneKey['tab-1:leaf-1']).toMatchObject({
      providerSession,
      state: 'done',
      origin: 'quit'
    })
  })
})

it('retains recorded Jcode session-start identity without a status row', () => {
  const store = createTestStore()
  seedStore(store, { tabsByWorktree: { 'wt-1': [makeTab({ id: 'tab-1', worktreeId: 'wt-1' })] } })
  const paneKey = 'tab-1:11111111-1111-4111-8111-111111111111'
  // Jcode 0.87.1 captured input.
  const payload = {
    hook_event_name: 'session_start',
    event: 'session_start',
    session_id: 'session_jc_5',
    model: 'claude-haiku-4-5',
    source: 'create'
  }
  const event = normalizeHookPayload(
    createHookListenerState(),
    'jcode',
    { paneKey, payload },
    'production'
  )
  if (!event) {
    throw new Error('Recorded session_start was rejected')
  }
  expect(event.providerSessionOnly).toBe(true)
  applyProviderSessionOnlyUpdate({
    store: store.getState(),
    batch: undefined,
    paneKey,
    routing: { tabId: 'tab-1', worktreeId: 'wt-1' },
    data: { ...event, ...event.payload, receivedAt: 1, stateStartedAt: 1 }
  })
  expect(store.getState().agentStatusByPaneKey).toEqual({})
  expect(store.getState().agentConversationsByPaneKey[paneKey]).toMatchObject({
    agent: 'jcode',
    providerSession: { key: 'session_id', id: 'session_jc_5' }
  })
})

it('replaces only the captured pane resume handle and keeps a newer session through manual sleep', () => {
  const store = createTestStore()
  const paneKey = 'tab-1:leaf-1'
  const captured = {
    paneKey,
    worktreeId: 'wt-1',
    agent: 'codex' as const,
    providerSession: { key: 'session_id' as const, id: 'old' },
    prompt: '',
    state: 'done' as const,
    origin: 'live' as const,
    capturedAt: 1,
    updatedAt: 1
  }
  store.getState().rememberSleepingAgentSession(captured)
  const resumed = { ...captured, origin: 'quit' as const, restoreOnTabOpenOnly: true }
  store.getState().rememberSleepingAgentSession(resumed, captured)
  expect(store.getState().sleepingAgentSessionsByPaneKey[paneKey]).toBe(resumed)
  const newer = { ...resumed, providerSession: { ...captured.providerSession, id: 'new' } }
  store.getState().rememberSleepingAgentSession(newer, resumed)
  store.getState().rememberSleepingAgentSession(resumed, captured)
  store.getState().captureSleepingAgentSessionsByWorktree('wt-1')
  expect(store.getState().sleepingAgentSessionsByPaneKey[paneKey]).toBe(newer)
  store.getState().clearSleepingAgentSession(paneKey)
  store.getState().rememberSleepingAgentSession(resumed, newer)
  expect(store.getState().sleepingAgentSessionsByPaneKey[paneKey]).toBeUndefined()
})
