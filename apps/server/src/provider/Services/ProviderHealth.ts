/**
 * ProviderHealth - Provider readiness snapshot service.
 *
 * Owns startup-time provider health checks (install/auth reachability) and
 * exposes the cached results to transport layers.
 *
 * @module ProviderHealth
 */
import type { ServerProviderStatus, ServerValidateCodexCliInput } from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface ProviderHealthShape {
  /**
   * Read provider health statuses cached in memory for transport layers.
   */
  readonly getStatuses: Effect.Effect<ReadonlyArray<ServerProviderStatus>, never, never>;
  /**
   * Re-run the Codex CLI health check for the effective config and cache it.
   */
  readonly revalidateCodexStatus: (
    input: ServerValidateCodexCliInput,
  ) => Effect.Effect<ServerProviderStatus, never, never>;
}

export class ProviderHealth extends ServiceMap.Service<ProviderHealth, ProviderHealthShape>()(
  "t3/provider/Services/ProviderHealth",
) {}
