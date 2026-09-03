// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { NativeChatContextMenuActions } from '../native-chat/use-native-chat-context-menu'
import type { TerminalPaneController } from './use-terminal-pane-controller'
import { TerminalPaneNativeChatPortal } from './TerminalPaneNativeChatPortal'

const captured = vi.hoisted(() => ({
  actions: null as NativeChatContextMenuActions | null
}))

vi.mock('../native-chat/NativeChatView', () => ({
  default: ({ contextMenuActions }: { contextMenuActions: NativeChatContextMenuActions }) => {
    captured.actions = contextMenuActions
    return null
  }
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: object) => unknown) => selector({})
}))
vi.mock('./pane-agent-session-id', () => ({
  resolvePaneAgentSessionId: () => 'provider-session'
}))

afterEach(() => {
  cleanup()
  captured.actions = null
})

it.each([null, 'structured-session'])(
  'preserves explanation and session-copy actions for chat session %s',
  (structuredSessionId) => {
    const onExplainSelection = vi.fn()
    const onCopyAgentSessionId = vi.fn()
    const runForPane = vi.fn((_paneId: number, action: () => unknown) => action())
    const controller = {
      chatPane: {
        id: 7,
        leafId: '11111111-1111-4111-8111-111111111111',
        container: document.createElement('div')
      },
      effectiveChatViewMode: true,
      managedPanes: [{ id: 7 }],
      expandedPaneId: null,
      structuredChatAgent: 'codex',
      structuredChatTarget: { kind: 'local' },
      structuredSessionId,
      tabId: 'tab-7',
      unifiedTabId: 'tab-7',
      resolveAgentForLeaf: () => 'codex',
      contextMenu: { runForPane, onExplainSelection, onCopyAgentSessionId }
    } as unknown as TerminalPaneController

    render(<TerminalPaneNativeChatPortal controller={controller} />)

    expect(captured.actions?.canCopyAgentSessionId).toBe(true)
    captured.actions?.onExplainSelection?.('selected output', 'surrounding context')
    captured.actions?.onCopyAgentSessionId()
    expect(onExplainSelection).toHaveBeenCalledWith(
      'selected output',
      'codex',
      'surrounding context'
    )
    expect(onCopyAgentSessionId).toHaveBeenCalledOnce()
    expect(runForPane.mock.calls.map(([paneId]) => paneId)).toEqual([7, 7])
  }
)
