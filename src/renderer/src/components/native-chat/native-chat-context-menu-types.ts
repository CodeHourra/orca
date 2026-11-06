import type { RefObject } from 'react'
import type { NativeChatComposerHandle } from './native-chat-composer-types'
import type { NativeChatContextMenuTarget } from './native-chat-context-menu-target'
import type { NativeChatCopyImage } from './native-chat-image-copy'
import type { NativeChatFileLinkContext } from './native-chat-file-link'
import type { NativeChatMessageListHandle } from './use-native-chat-reveal-latest'
import type { NativeChatRewindSurface } from './use-native-chat-rewind'
import type { NativeChatSessionMenuSource } from './use-native-chat-session-context-actions'

export type NativeChatContextMenuState = {
  open: boolean
  point: { x: number; y: number }
  selectedText: string
  canPaste: boolean
  image?: NativeChatCopyImage
  target: NativeChatContextMenuTarget
  returnFocusTo: Element | null
}

export type NativeChatContextMenuTargetArgs = {
  messageListRef?: RefObject<Pick<NativeChatMessageListHandle, 'messageCopyText'> | null>
  fileLinkContext?: NativeChatFileLinkContext | null
  rewind?: NativeChatRewindSurface
  onFind?: (returnFocusTo: Element | null) => void
}

export type NativeChatContextMenuActions = {
  onPaste: () => void
  onExplainSelection?: (selectedText: string, capturedText?: string) => void
  onSplitRight: () => void
  onSplitDown: () => void
  canEqualizePaneSizes: boolean
  onEqualizePaneSizes: () => void
  canExpandPane: boolean
  isPaneExpanded: boolean
  onToggleExpand: () => void
  canContinueAgentSessionInNewSession: boolean
  onContinueAgentSessionInNewSession: () => void
  onCopyAgentSessionContext: () => void
  onSetTitle: () => void
  canClearPaneTitle: boolean
  onClearPaneTitle: () => void
  onCopyTerminalId: () => void
  onCopyPaneId: () => void
  canCopyAgentSessionId: boolean
  onCopyAgentSessionId: () => void
  canClosePane: boolean
  onClosePane: () => void
}

export type UseNativeChatContextMenuArgs = {
  rootRef: RefObject<HTMLElement | null>
  composerRef: RefObject<NativeChatComposerHandle | null>
  enabled?: boolean
  /** Bridge-only escape hatch; structured sessions have no terminal view. */
  onSwitchToTerminal?: () => void
  /** Hand off a standalone structured chat; terminal panes supply their own action. */
  onHandOff?: () => void
  handOffDisabled?: boolean
  actions: NativeChatContextMenuActions
  explanationContext?: string
  showTerminalPaneActions?: boolean
  splitShortcutLabels?: { right: string; down: string }
  chatPane?: { tabId: string; worktreeId: string; groupId: string; sessionId: string }
  chatSession?: NativeChatSessionMenuSource
  /** A structured chat tab's Orca session ID; a chat in a terminal pane is that terminal's agent. */
  resolveOrcaSessionId?: () => Promise<string | null>
} & NativeChatContextMenuTargetArgs
