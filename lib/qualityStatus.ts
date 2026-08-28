/**
 * Terminal `submissions.quality_status` values that a run may carry without
 * ever being excluded from public aggregates. Model performance must never
 * decide this list: a run is only left out for a protocol failure the
 * participant controlled (language, VPN, memory/custom instructions,
 * translation, regeneration, completing in one sitting), never for how well
 * the model answered.
 */
export const ELIGIBLE_FOR_PUBLIC_AGGREGATE_STATUSES = ["eligible", "flagged_repetition"] as const;

export function isEligibleForPublicAggregate(status: unknown): boolean {
  return typeof status === "string" &&
    (ELIGIBLE_FOR_PUBLIC_AGGREGATE_STATUSES as readonly string[]).includes(status);
}
