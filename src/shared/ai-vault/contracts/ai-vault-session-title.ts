import type { AiVaultSessionTitleKind } from './ai-vault-types'
import type { ExecutionHostId } from '../../execution-host'

export const AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT = 64

// Why: the session-title reader folds a conversation name out of the provider's
// own transcript, so it admits exactly the agents whose recorded transcript the
// scanner can name. `pi` and `omp` share the message-graph parser
// (`createMessageGraphSessionResumeState`); OMP additionally persists an explicit
// `session.title`/`title_change` name. Both report a `transcriptPath` from their
// hooks, which is what the reader parses.
//
// The first two entries are the frozen v1.4.x wire vocabulary: an older host's
// `aiVault.resolveSessionTitles` schema accepts only `claude` and `codex`, so a
// newer client must not send `pi`/`omp` to it (see `AI_VAULT_SESSION_TITLE_AGENTS_V1`).
export const AI_VAULT_SESSION_TITLE_AGENTS = ['claude', 'codex', 'pi', 'omp'] as const

/** The agent set every released host already accepts; usable without negotiation. */
export const AI_VAULT_SESSION_TITLE_AGENTS_V1: readonly (typeof AI_VAULT_SESSION_TITLE_AGENTS)[number][] =
  ['claude', 'codex']

export type AiVaultSessionTitle = {
  agent: (typeof AI_VAULT_SESSION_TITLE_AGENTS)[number]
  sessionId: string
  title: string
  /** Absent from older hosts and saved tabs: unclassified, ranked like a fallback. */
  kind?: AiVaultSessionTitleKind
}

export type AiVaultSessionTitleRequest = {
  agent: AiVaultSessionTitle['agent']
  sessionId: string
  transcriptPath?: string
}

export type AiVaultSessionTitlesArgs = {
  executionHostScope?: ExecutionHostId
  requests: AiVaultSessionTitleRequest[]
}

export type AiVaultSessionTitlesResult = {
  titles: AiVaultSessionTitle[]
}

export function isAiVaultTitleAgent(agent: unknown): agent is AiVaultSessionTitle['agent'] {
  return AI_VAULT_SESSION_TITLE_AGENTS.some((candidate) => candidate === agent)
}

/** Kind is compared too, so a title whose text is unchanged can still become a known name. */
export function sameAiVaultSessionTitle(
  a: AiVaultSessionTitle | null | undefined,
  b: AiVaultSessionTitle | null | undefined
): boolean {
  return (
    a?.agent === b?.agent &&
    a?.sessionId === b?.sessionId &&
    a?.title === b?.title &&
    a?.kind === b?.kind
  )
}
