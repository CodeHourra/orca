// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatContextMenuActions } from '../native-chat/use-native-chat-context-menu'
import type { TerminalPaneController } from './use-terminal-pane-controller'

const mocks = vi.hoisted(() => ({
  nativeChatViewProps: null as null | {
    isFocusedGroup: boolean
    contextMenuActions?: NativeChatContextMenuActions
  }
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: object) => unknown) => selector({})
}))

vi.mock('../native-chat/NativeChatView', () => ({
  default: (props: {
    isFocusedGroup: boolean
    contextMenuActions?: NativeChatContextMenuActions
  }) => {
    mocks.nativeChatViewProps = props
    return <span data-focused-group={String(props.isFocusedGroup)} />
  }
}))

vi.mock('./pane-agent-session-id', () => ({
  resolvePaneAgentSessionId: () => 'provider-session'
}))

import { TerminalPaneNativeChatPortal } from './TerminalPaneNativeChatPortal'

afterEach(() => {
  cleanup()
  mocks.nativeChatViewProps = null
})

describe('TerminalPaneNativeChatPortal', () => {
  it.each([
    ['pty-backed', false],
    ['structured', true]
  ] as const)(
    'only gives the %s composer focus ownership to the active split leaf',
    (_, structured) => {
      const portalContainer = document.createElement('div')
      document.body.appendChild(portalContainer)
      const view = render(
        <TerminalPaneNativeChatPortal
          controller={makeController(portalContainer, {
            activePaneIsChatLeaf: false,
            structured
          })}
        />
      )

      expect(mocks.nativeChatViewProps?.isFocusedGroup).toBe(false)

      view.rerender(
        <TerminalPaneNativeChatPortal
          controller={makeController(portalContainer, { activePaneIsChatLeaf: true, structured })}
        />
      )
      expect(mocks.nativeChatViewProps?.isFocusedGroup).toBe(true)

      portalContainer.remove()
    }
  )

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

      const actions = mocks.nativeChatViewProps?.contextMenuActions
      expect(actions?.canCopyAgentSessionId).toBe(true)
      actions?.onExplainSelection?.('selected output', 'surrounding context')
      actions?.onCopyAgentSessionId()
      expect(onExplainSelection).toHaveBeenCalledWith(
        'selected output',
        'codex',
        'surrounding context'
      )
      expect(onCopyAgentSessionId).toHaveBeenCalledOnce()
      expect(runForPane.mock.calls.map(([paneId]) => paneId)).toEqual([7, 7])
    }
  )
})

function makeController(
  portalContainer: HTMLElement,
  overrides: { activePaneIsChatLeaf: boolean; structured: boolean }
): TerminalPaneController {
  const chatPane = {
    id: 1,
    leafId: '11111111-1111-4111-8111-111111111111',
    container: portalContainer
  }
  return {
    chatPane,
    chatPaneLaunchAgent: null,
    chatPaneOwnsTabWideLaunchDraft: false,
    chatPanePtyId: null,
    chatPaneResolvedAgent: null,
    contextMenu: { runForPane: vi.fn() },
    effectiveChatViewMode: true,
    expandedPaneId: null,
    activePaneIsChatLeaf: overrides.activePaneIsChatLeaf,
    isActive: true,
    isRendererVisible: true,
    managedPanes: [chatPane, { id: 2, leafId: '22222222-2222-4222-8222-222222222222' }],
    readNativeChatTerminalScreen: vi.fn(),
    resolveAgentForLeaf: vi.fn(() => null),
    structuredChatAgent: overrides.structured ? 'codex' : null,
    structuredChatTarget: { kind: 'local' },
    structuredSessionId: overrides.structured ? 'session-1' : null,
    switchNativeChatToTerminal: vi.fn(),
    tabId: 'tab-1',
    unifiedTabId: null
  } as unknown as TerminalPaneController
}
