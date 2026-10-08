import {
  AI_VAULT_SESSION_TITLE_AGENTS_V1,
  AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT
} from '../../../shared/ai-vault-session-title'
import type { ExecutionHostId } from '../../../shared/execution-host'
import type { AiVaultTitleRequest } from './ai-vault-tab-title-requests'

/**
 * Batch per host, keeping the agent tiers apart.
 *
 * Why the tiers: `aiVault.resolveSessionTitles` validates `agent` with a closed
 * enum, so a host that predates `pi`/`omp` rejects the WHOLE request. Batched
 * together, one widened agent would take every `claude`/`codex` title in the same
 * request down with it. Sent apart, a newer client still gets v1 titles from an
 * older host while the widened batch degrades on its own.
 */
export function batchAiVaultTitleRequests(
  requests: AiVaultTitleRequest[]
): AiVaultTitleRequest[][] {
  const byHost = new Map<
    ExecutionHostId,
    { v1: AiVaultTitleRequest[]; widened: AiVaultTitleRequest[] }
  >()
  for (const request of requests) {
    let tiers = byHost.get(request.executionHostId)
    if (!tiers) {
      tiers = { v1: [], widened: [] }
      byHost.set(request.executionHostId, tiers)
    }
    const isV1 = AI_VAULT_SESSION_TITLE_AGENTS_V1.some((agent) => agent === request.agent)
    ;(isV1 ? tiers.v1 : tiers.widened).push(request)
  }
  const batches: AiVaultTitleRequest[][] = []
  for (const tiers of byHost.values()) {
    for (const tier of [tiers.v1, tiers.widened]) {
      for (let index = 0; index < tier.length; index += AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT) {
        batches.push(tier.slice(index, index + AI_VAULT_SESSION_TITLE_REQUEST_MAX_COUNT))
      }
    }
  }
  return batches
}

export async function settleAiVaultTitleRequestBatches(
  requests: AiVaultTitleRequest[],
  resolveBatch: (batch: AiVaultTitleRequest[]) => Promise<void>
): Promise<void> {
  const batchesByHost = new Map<ExecutionHostId, AiVaultTitleRequest[][]>()
  for (const batch of batchAiVaultTitleRequests(requests)) {
    const executionHostId = batch[0]!.executionHostId
    const hostBatches = batchesByHost.get(executionHostId) ?? []
    hostBatches.push(batch)
    batchesByHost.set(executionHostId, hostBatches)
  }
  await Promise.all(
    [...batchesByHost.values()].map(async (hostBatches) => {
      for (const batch of hostBatches) {
        try {
          await resolveBatch(batch)
        } catch {
          // One unavailable host/batch must not suppress later exact identities.
        }
      }
    })
  )
}
