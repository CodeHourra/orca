import type { RefObject } from 'react'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { WORKSPACE_FILE_PATH_MIME, WORKSPACE_FILE_PATHS_MIME } from '@/lib/workspace-file-drag'
import type { PtyTransport } from './pty-transport-types'
import { handleInternalTerminalFileDrop } from './terminal-drop-handler'

/** The pane body: owns the container the manager renders terminals into, plus workspace file drops. */
export function TerminalPaneDropSurface({
  setContainerRef,
  tabId,
  chatView,
  expectedLayoutLeafIdsAttr,
  titleUsesLightSurface,
  containerStyle,
  onContextMenuCapture,
  onMouseDownCapture,
  onAuxClickCapture,
  managerRef,
  paneTransportsRef,
  worktreeId,
  cwd
}: {
  setContainerRef: (element: HTMLDivElement | null) => void
  tabId: string
  chatView: boolean
  expectedLayoutLeafIdsAttr: string | undefined
  titleUsesLightSurface: boolean
  containerStyle: React.CSSProperties
  onContextMenuCapture: React.MouseEventHandler<HTMLDivElement>
  onMouseDownCapture: React.MouseEventHandler<HTMLDivElement>
  onAuxClickCapture: React.MouseEventHandler<HTMLDivElement>
  managerRef: RefObject<PaneManager | null>
  paneTransportsRef: RefObject<Map<number, PtyTransport>>
  worktreeId: string
  cwd: string | undefined
}): React.JSX.Element {
  return (
    <div
      ref={setContainerRef}
      className="absolute inset-0 min-h-0 min-w-0"
      data-terminal-tab-id={tabId}
      data-terminal-chat-view={chatView ? 'true' : undefined}
      data-terminal-layout-leaf-ids={expectedLayoutLeafIdsAttr}
      data-pane-title-surface={titleUsesLightSurface ? 'light' : 'dark'}
      style={containerStyle}
      onContextMenuCapture={onContextMenuCapture}
      onMouseDownCapture={onMouseDownCapture}
      onAuxClickCapture={onAuxClickCapture}
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes(WORKSPACE_FILE_PATH_MIME) ||
          event.dataTransfer.types.includes(WORKSPACE_FILE_PATHS_MIME)
        ) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(event) => {
        if (
          !event.dataTransfer.types.includes(WORKSPACE_FILE_PATH_MIME) &&
          !event.dataTransfer.types.includes(WORKSPACE_FILE_PATHS_MIME)
        ) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        const manager = managerRef.current
        if (!manager) {
          return
        }
        void handleInternalTerminalFileDrop({
          manager,
          paneTransports: paneTransportsRef.current,
          worktreeId,
          tabId,
          cwd,
          dataTransfer: event.dataTransfer,
          dropTarget: event.target
        })
      }}
    />
  )
}
