import { describe, expect, it, vi } from 'vitest'
import { ensureWorktreeHasInitialTerminal } from './worktree-initial-terminal-seeding'
import {
  createMockStore,
  registerWorktreeActivationReset,
  createdTabStartups
} from './worktree-activation.test-fixture'
import { useAppStore } from '@/store'

registerWorktreeActivationReset()

describe('ensureWorktreeHasInitialTerminal default tabs', () => {
  // Regression: the global default agent must not replace configured default tabs.
  it('does not replace configured default tabs with the global default agent', () => {
    useAppStore.setState((state) => ({
      settings: state.settings
        ? { ...state.settings, defaultTuiAgent: 'codex' }
        : ({ defaultTuiAgent: 'codex' } as unknown as typeof state.settings)
    }))
    let createdIndex = 0
    const createTab = vi.fn(() => ({ id: `tab-${++createdIndex}` }))
    const store = createMockStore({ createTab })

    ensureWorktreeHasInitialTerminal(store, 'wt-1', undefined, undefined, undefined, {
      runCommands: true,
      tabs: [{ title: 'Dev', command: 'pnpm dev' }]
    })

    expect(createTab).toHaveBeenCalledTimes(1)
    expect(createTab).toHaveBeenCalledWith('wt-1', undefined, undefined, {
      pendingActivationSpawn: true,
      pendingStartup: { command: 'pnpm dev' },
      recordInteraction: false
    })
    expect(createdTabStartups(store)['tab-1']).toEqual({ command: 'pnpm dev' })
  })
})
