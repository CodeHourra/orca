import type { RefObject } from 'react'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import type { PaneCwdMap } from './resolve-split-cwd'
import {
  createExplainSelectionHandler,
  type ExplainSelectionHandler
} from './terminal-agent-explanation-fork'

export type ExplainSelectionState = {
  canExplainSelection: boolean
  onExplainSelection: ExplainSelectionHandler
}

export function useExplainSelection(deps: {
  resolvePane: () => ManagedPane | null
  tabId: string
  worktreeId: string
  paneCwdRef: RefObject<PaneCwdMap>
  fallbackCwd: string
  menuPane: ManagedPane | null
}): ExplainSelectionState {
  return {
    canExplainSelection: Boolean(deps.menuPane?.terminal.getSelection().trim()),
    onExplainSelection: createExplainSelectionHandler({
      resolvePane: deps.resolvePane,
      tabId: deps.tabId,
      worktreeId: deps.worktreeId,
      cwdFor: (pane) => deps.paneCwdRef.current.get(pane.id)?.cwd ?? deps.fallbackCwd
    })
  }
}
