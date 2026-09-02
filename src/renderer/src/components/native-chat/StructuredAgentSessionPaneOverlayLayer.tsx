import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import {
  isAgentSessionHandleProvider,
  type AgentSessionHandleProvider
} from '../../../../shared/agent-session-provider-handle'
import { useAppStore } from '@/store'
import {
  getExecutionHostIdForWorktree,
  getRuntimeEnvironmentIdForWorktree
} from '@/lib/worktree-runtime-owner'
import { getActiveRuntimeTarget, type RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { tabGroupBodyAnchorName } from '../tab-group/tab-group-body-anchor'
import NativeChatView from './NativeChatView'
import { emptyNativeChatContextMenuActions } from './use-native-chat-context-menu'
import { explainAgentSelection } from '../terminal-pane/terminal-agent-explanation-fork'

type StructuredAgentSessionTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: AgentSessionHandleProvider
}

const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

const StructuredAgentSessionOverlaySlot = memo(function StructuredAgentSessionOverlaySlot({
  tab,
  groupId,
  isActive,
  target,
  allowFileUriLinks,
  onFocusOwningGroup
}: {
  tab: StructuredAgentSessionTab
  groupId: string | undefined
  isActive: boolean
  target: RuntimeClientTarget
  allowFileUriLinks: boolean
  onFocusOwningGroup: ((groupId: string) => void) | undefined
}): React.JSX.Element {
  const anchorName = groupId !== undefined ? tabGroupBodyAnchorName(groupId) : undefined
  const style = useMemo<React.CSSProperties>(
    () =>
      anchorName
        ? {
            position: 'absolute',
            positionAnchor: anchorName,
            top: `anchor(${anchorName} top)`,
            left: `anchor(${anchorName} left)`,
            width: `anchor-size(${anchorName} width)`,
            height: `anchor-size(${anchorName} height)`,
            display: isActive ? 'flex' : 'none',
            pointerEvents: isActive ? 'auto' : 'none'
          }
        : { display: 'none' },
    [anchorName, isActive]
  )
  const focusOwningGroup = useCallback(() => {
    if (groupId !== undefined && onFocusOwningGroup) {
      onFocusOwningGroup(groupId)
    }
  }, [groupId, onFocusOwningGroup])
  const cwd = useAppStore(
    (state) => state.getKnownWorktreeById(tab.worktreeId, tab.executionHostId)?.path
  )
  const contextMenuActions = useMemo(
    () => ({
      ...emptyNativeChatContextMenuActions,
      onExplainSelection: (selectedText: string, capturedText?: string) =>
        void explainAgentSelection({
          agent: tab.agentSessionAgent,
          worktreeId: tab.worktreeId,
          selectedText,
          cwd,
          capturedText,
          sourceLabel: tab.id,
          remote: target.kind !== 'local'
        })
    }),
    [cwd, tab.agentSessionAgent, tab.id, tab.worktreeId, target.kind]
  )

  return (
    <div
      style={style}
      className="native-chat-pane-shell z-10 min-h-0 min-w-0"
      data-structured-agent-session-overlay-tab-id={tab.id}
      aria-hidden={!isActive}
      onPointerDown={focusOwningGroup}
      onFocusCapture={focusOwningGroup}
    >
      <NativeChatView
        mode="structured"
        tabId={tab.id}
        sessionId={tab.entityId}
        agent={tab.agentSessionAgent}
        isVisible={isActive}
        target={target}
        allowFileUriLinks={allowFileUriLinks}
        contextMenuActions={contextMenuActions}
      />
    </div>
  )
})

const StructuredAgentSessionPaneOverlayLayer = memo(
  function StructuredAgentSessionPaneOverlayLayer({
    worktreeId,
    isWorktreeActive
  }: {
    worktreeId: string
    isWorktreeActive: boolean
  }): React.JSX.Element {
    const { unifiedTabs, groups, runtimeEnvironmentId, allowFileUriLinks } = useAppStore(
      useShallow((state) => ({
        unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
        groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
        runtimeEnvironmentId: getRuntimeEnvironmentIdForWorktree(state, worktreeId),
        allowFileUriLinks: getExecutionHostIdForWorktree(state, worktreeId) === 'local'
      }))
    )
    const focusGroup = useAppStore((state) => state.focusGroup)
    const target = useMemo(
      () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId: runtimeEnvironmentId }),
      [runtimeEnvironmentId]
    )
    const focusOwningGroup = useCallback(
      (groupId: string) => focusGroup(worktreeId, groupId),
      [focusGroup, worktreeId]
    )
    const groupActiveTabById = useMemo(
      () => new Map(groups.map((group) => [group.id, group.activeTabId] as const)),
      [groups]
    )
    const structuredTabs = useMemo(
      () =>
        unifiedTabs.filter(
          (tab): tab is StructuredAgentSessionTab =>
            tab.contentType === 'agent-session' &&
            isAgentSessionHandleProvider(tab.agentSessionAgent)
        ),
      [unifiedTabs]
    )

    return (
      <>
        {structuredTabs.map((tab) => (
          <StructuredAgentSessionOverlaySlot
            key={tab.id}
            tab={tab}
            groupId={tab.groupId}
            isActive={Boolean(isWorktreeActive && groupActiveTabById.get(tab.groupId) === tab.id)}
            target={target}
            allowFileUriLinks={allowFileUriLinks}
            onFocusOwningGroup={focusOwningGroup}
          />
        ))}
      </>
    )
  }
)

export default StructuredAgentSessionPaneOverlayLayer
