import assert from "node:assert/strict";
import test from "node:test";
import {
  ELIGIBLE_FOR_PUBLIC_AGGREGATE_STATUSES,
  isEligibleForPublicAggregate,
} from "../lib/qualityStatus.ts";

test("public aggregates include eligible and flagged_repetition rows only", () => {
  assert.equal(isEligibleForPublicAggregate("eligible"), true);
  assert.equal(isEligibleForPublicAggregate("flagged_repetition"), true);
  assert.equal(isEligibleForPublicAggregate("excluded_protocol"), false);
  assert.equal(isEligibleForPublicAggregate("excluded_floor"), false);
  assert.equal(isEligibleForPublicAggregate("anything-else"), false);
  assert.equal(isEligibleForPublicAggregate(null), false);
  assert.equal(isEligibleForPublicAggregate(undefined), false);
  assert.deepEqual(ELIGIBLE_FOR_PUBLIC_AGGREGATE_STATUSES, ["eligible", "flagged_repetition"]);
});
