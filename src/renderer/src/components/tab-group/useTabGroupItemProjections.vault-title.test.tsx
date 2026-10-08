// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { resolveTerminalTabTitle } from '../../../../shared/tab-title-resolution'
import { useAppStore } from '../../store'
import { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'

const WORKTREE_ID = 'wt-1'
const TAB_ID = 'tab-1'
const UNIFIED_TAB_ID = 'u-1'

/**
 * The strip does not read `tabsByWorktree`: `useTabGroupItemProjections` rebuilds a terminal
 * tab from the unified-tab model, and the AI Vault name lives on both stores' tabs. Dropping
 * it here leaves the resolver's vault branch empty, so an edited session name never reaches
 * the strip and the label falls through to Orca's generated title.
 */
function seedStores(): void {
  const terminalTab = {
    id: TAB_ID,
    ptyId: 'pty-1',
    worktreeId: WORKTREE_ID,
    title: '⠋ OMP - Old OSC - orca',
    aiVaultTitle: { agent: 'omp', sessionId: 's-1', title: 'Old vault name' },
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    defaultTitle: 'Terminal 2'
  } as unknown as TerminalTab
  const unifiedTab = {
    id: UNIFIED_TAB_ID,
    entityId: TAB_ID,
    groupId: 'g-1',
    worktreeId: WORKTREE_ID,
    contentType: 'terminal',
    label: '⠋ OMP - Old OSC - orca',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    isPinned: false,
    aiVaultTitle: { agent: 'omp', sessionId: 's-1', title: 'Old vault name' },
    generatedLabel: 'IMPORTANT User invoked the upstream'
  } as unknown as Tab
  useAppStore.setState(
    (state) =>
      ({
        ...state,
        groupsByWorktree: {
          [WORKTREE_ID]: [
            { id: 'g-1', worktreeId: WORKTREE_ID, activeTabId: UNIFIED_TAB_ID, tabOrder: [TAB_ID] }
          ]
        },
        unifiedTabsByWorktree: { [WORKTREE_ID]: [unifiedTab] },
        tabsByWorktree: { [WORKTREE_ID]: [terminalTab] },
        openFiles: [],
        browserTabsByWorktree: { [WORKTREE_ID]: [] },
        expandedPaneByTabId: {},
        // Why: on, or the generated title would not outrank the stripped live title and the bug hides.
        settings: { ...state.settings, tabAutoGenerateTitle: true }
      }) as never
  )
}

function stripTitle(): string {
  const { result } = renderHook(() =>
    useTabGroupWorkspaceModel({ groupId: 'g-1', worktreeId: WORKTREE_ID })
  )
  const derived = result.current.terminalTabs[0] as unknown as TerminalTab
  return resolveTerminalTabTitle(derived, true, derived.title, {
    agentType: 'omp',
    providerSessionId: 's-1'
  })
}

afterEach(() => {
  useAppStore.setState({ tabsByWorktree: {}, unifiedTabsByWorktree: {} })
})

describe('tab strip terminal projection', () => {
  it('carries the store-only AI Vault name, so an edited session name reaches the strip', () => {
    seedStores()

    expect(stripTitle()).toBe('Old vault name')

    useAppStore.getState().setAiVaultTabTitle(TAB_ID, {
      agent: 'omp',
      sessionId: 's-1',
      title: 'New vault name'
    } as never)

    expect(stripTitle()).toBe('New vault name')
  })
})
