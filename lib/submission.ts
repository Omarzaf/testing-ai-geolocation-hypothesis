export const EXPECTED_PROMPT_COUNT = 15;

export const ACCESS_TYPE_VALUES = ["Free", "Paid", "Not sure"] as const;
export const UI_LANGUAGE_VALUES = ["en", "ur"] as const;
export const PLATFORM_VALUES = ["web", "ios", "android", "desktop"] as const;
export const REASONING_TOGGLE_VALUES = ["on", "off", "unavailable", "unsure"] as const;
export const VPN_USED_VALUES = ["yes", "no", "unsure"] as const;
export const CONFIGURATION_STATE_VALUES = ["off", "on", "unsure"] as const;
export const SESSION_VARIANT_VALUES = ["A", "B"] as const;
export const RESPONSE_SECONDS_BUCKET_VALUES = ["lt5", "5to15", "15to60", "gt60"] as const;
export const FEEDBACK_REASON_VALUES = ["", "unclear", "answer disputed", "technical issue", "too long"] as const;

export type AccessType = (typeof ACCESS_TYPE_VALUES)[number];
export type UiLanguage = (typeof UI_LANGUAGE_VALUES)[number];
export type Platform = (typeof PLATFORM_VALUES)[number];
export type ReasoningToggle = (typeof REASONING_TOGGLE_VALUES)[number];
export type VpnUsed = (typeof VPN_USED_VALUES)[number];
export type ConfigurationState = (typeof CONFIGURATION_STATE_VALUES)[number];
export type SessionVariant = (typeof SESSION_VARIANT_VALUES)[number];
export type ResponseSecondsBucket = (typeof RESPONSE_SECONDS_BUCKET_VALUES)[number];
export type FeedbackReason = (typeof FEEDBACK_REASON_VALUES)[number];
export type BinaryFlag = 0 | 1;

export type ValidatedResponseInput = {
  promptId: string;
  responseText: string;
  regenerated: BinaryFlag;
  responseSecondsBucket: ResponseSecondsBucket;
};

export type ValidatedFeedbackInput = {
  clarityRating: number;
  confusingPromptId: string;
  reason: FeedbackReason;
};

export type ValidatedSubmission = {
  city: string;
  country: string;
  provider: string;
  model: string;
  accessType: AccessType;
  planLabel: string;
  uiLanguage: UiLanguage;
  platform: Platform;
  reasoningToggle: ReasoningToggle;
  vpnUsed: VpnUsed;
  memoryPersonalization: ConfigurationState;
  customInstructions: ConfigurationState;
  promptsTranslated: BinaryFlag;
  completedInOneSitting: BinaryFlag;
  sessionVariant: SessionVariant;
  promptOrder: string[];
  clientTimezone: string;
  benchmarkVersion: string;
  responses: ValidatedResponseInput[];
  feedback: ValidatedFeedbackInput;
  website: string;
  turnstileToken: string;
};

export type SubmissionValidationResult =
  | { ok: true; value: ValidatedSubmission }
  | { ok: false; error: SubmissionValidationError };

const ISO_COUNTRY_CODES = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO " +
    "JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR " +
    "MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO " +
    "RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV " +
    "TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" "),
);

const ROOT_KEYS = [
  "city",
  "country",
  "provider",
  "model",
  "accessType",
  "planLabel",
  "uiLanguage",
  "platform",
  "reasoningToggle",
  "vpnUsed",
  "memoryPersonalization",
  "customInstructions",
  "promptsTranslated",
  "completedInOneSitting",
  "sessionVariant",
  "promptOrder",
  "clientTimezone",
  "benchmarkVersion",
  "responses",
  "feedback",
  "website",
  "turnstileToken",
] as const;

const RESPONSE_KEYS = ["promptId", "responseText", "regenerated", "responseSecondsBucket"] as const;
const FEEDBACK_KEYS = ["clarityRating", "confusingPromptId", "reason"] as const;

/** Describes one strict payload-contract failure. */
export class SubmissionValidationError extends Error {
  readonly code = "INVALID_SUBMISSION_PAYLOAD";
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.name = "SubmissionValidationError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new SubmissionValidationError(path, message);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "Expected an object.");
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedKeys);
  const unknownKey = Object.keys(record).find((key) => !allowed.has(key));
  if (unknownKey) {
    fail(path ? `${path}.${unknownKey}` : unknownKey, "Unknown field.");
  }

  const missingKey = allowedKeys.find((key) => !Object.hasOwn(record, key));
  if (missingKey) {
    fail(path ? `${path}.${missingKey}` : missingKey, "Required field is missing.");
  }
}

function requireString(
  value: unknown,
  path: string,
  options: { minLength?: number; maxLength: number; collapseWhitespace?: boolean },
): string {
  if (typeof value !== "string") {
    return fail(path, "Expected a string.");
  }
  const trimmed = value.trim();
  const normalized = options.collapseWhitespace ? trimmed.replace(/\s+/g, " ") : trimmed;
  if (normalized.length < (options.minLength ?? 0)) {
    fail(path, `Must contain at least ${options.minLength ?? 0} characters.`);
  }
  if (normalized.length > options.maxLength) {
    fail(path, `Must contain no more than ${options.maxLength} characters.`);
  }
  return normalized;
}

function requireSafeLabel(
  value: unknown,
  path: string,
  options: { minLength: number; maxLength: number },
): string {
  const label = requireString(value, path, { ...options, collapseWhitespace: true });
  if (/[<>{}\u0000-\u001F\u007F]/u.test(label)) {
    fail(path, "Contains unsupported markup or control characters.");
  }
  return label;
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  path: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value as T[number])) {
    return fail(path, `Expected one of: ${values.join(", ")}.`);
  }
  return value as T[number];
}

function requireBinaryFlag(value: unknown, path: string): BinaryFlag {
  if (value !== 0 && value !== 1) {
    return fail(path, "Expected 0 or 1.");
  }
  return value;
}

function requireInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    return fail(path, `Expected an integer from ${minimum} to ${maximum}.`);
  }
  return value as number;
}

function assertRequiredPromptIds(requiredPromptIds: readonly string[]): Set<string> {
  if (requiredPromptIds.length !== EXPECTED_PROMPT_COUNT) {
    throw new RangeError(`requiredPromptIds must contain exactly ${EXPECTED_PROMPT_COUNT} prompt IDs.`);
  }
  const ids = requiredPromptIds.map((id) => {
    if (typeof id !== "string" || !id.trim() || id.length > 80) {
      throw new TypeError("requiredPromptIds must contain non-empty strings of at most 80 characters.");
    }
    return id.trim();
  });
  const set = new Set(ids);
  if (set.size !== EXPECTED_PROMPT_COUNT) {
    throw new RangeError("requiredPromptIds must be unique.");
  }
  return set;
}

function requireExactPromptSet(value: unknown, requiredIds: Set<string>, path: string): string[] {
  if (!Array.isArray(value) || value.length !== requiredIds.size) {
    return fail(path, `Expected exactly ${requiredIds.size} prompt IDs.`);
  }
  const ids = value.map((item, index) => requireString(item, `${path}[${index}]`, { minLength: 1, maxLength: 80 }));
  const received = new Set(ids);
  if (received.size !== requiredIds.size || ids.some((id) => !requiredIds.has(id))) {
    fail(path, "Prompt IDs must be unique and match the required benchmark set exactly.");
  }
  return ids;
}

function parseResponses(value: unknown, requiredIds: Set<string>): ValidatedResponseInput[] {
  if (!Array.isArray(value) || value.length !== requiredIds.size) {
    return fail("responses", `Expected exactly ${requiredIds.size} responses.`);
  }

  const responses = value.map((item, index): ValidatedResponseInput => {
    const path = `responses[${index}]`;
    const record = requireRecord(item, path);
    requireExactKeys(record, RESPONSE_KEYS, path);
    const promptId = requireString(record.promptId, `${path}.promptId`, { minLength: 1, maxLength: 80 });
    if (!requiredIds.has(promptId)) {
      fail(`${path}.promptId`, "Prompt ID is not part of this benchmark version.");
    }
    return {
      promptId,
      responseText: requireString(record.responseText, `${path}.responseText`, {
        minLength: 1,
        maxLength: 6_000,
      }),
      regenerated: requireBinaryFlag(record.regenerated, `${path}.regenerated`),
      responseSecondsBucket: requireEnum(
        record.responseSecondsBucket,
        RESPONSE_SECONDS_BUCKET_VALUES,
        `${path}.responseSecondsBucket`,
      ),
    };
  });

  if (new Set(responses.map(({ promptId }) => promptId)).size !== requiredIds.size) {
    fail("responses", "Responses must contain each required prompt ID exactly once.");
  }
  return responses;
}

function parseFeedback(value: unknown, requiredIds: Set<string>): ValidatedFeedbackInput {
  const record = requireRecord(value, "feedback");
  requireExactKeys(record, FEEDBACK_KEYS, "feedback");
  const confusingPromptId = requireString(record.confusingPromptId, "feedback.confusingPromptId", {
    maxLength: 80,
  });
  if (confusingPromptId && !requiredIds.has(confusingPromptId)) {
    fail("feedback.confusingPromptId", "Prompt ID is not part of this benchmark version.");
  }
  return {
    clarityRating: requireInteger(record.clarityRating, "feedback.clarityRating", 0, 5),
    confusingPromptId,
    reason: requireEnum(record.reason, FEEDBACK_REASON_VALUES, "feedback.reason"),
  };
}

/** Parses one complete core-2 submission and rejects all unknown or malformed fields. */
export function parseSubmissionPayload(
  input: unknown,
  requiredPromptIds: readonly string[],
): ValidatedSubmission {
  const requiredIds = assertRequiredPromptIds(requiredPromptIds);
  const record = requireRecord(input, "payload");
  requireExactKeys(record, ROOT_KEYS, "payload");

  const city = requireString(record.city, "payload.city", {
    minLength: 2,
    maxLength: 80,
    collapseWhitespace: true,
  });
  if (/[<>{}]/.test(city)) {
    fail("payload.city", "City contains unsupported characters.");
  }

  const country = requireString(record.country, "payload.country", {
    minLength: 2,
    maxLength: 2,
  }).toUpperCase();
  if (!ISO_COUNTRY_CODES.has(country)) {
    fail("payload.country", "Expected an ISO 3166-1 alpha-2 country code.");
  }

  const clientTimezone = requireString(record.clientTimezone, "payload.clientTimezone", {
    minLength: 1,
    maxLength: 100,
  });
  if (!/^[A-Za-z0-9_+.\/-]+$/.test(clientTimezone)) {
    fail("payload.clientTimezone", "Expected an IANA-style timezone identifier.");
  }

  const benchmarkVersion = requireString(record.benchmarkVersion, "payload.benchmarkVersion", {
    minLength: 1,
    maxLength: 40,
  });
  if (!/^[A-Za-z0-9._-]+$/.test(benchmarkVersion)) {
    fail("payload.benchmarkVersion", "Benchmark version contains unsupported characters.");
  }

  const promptOrder = requireExactPromptSet(record.promptOrder, requiredIds, "payload.promptOrder");
  const responses = parseResponses(record.responses, requiredIds);
  if (responses.some(({ promptId }, index) => promptId !== promptOrder[index])) {
    fail("payload.responses", "Responses must follow promptOrder exactly.");
  }

  return {
    city,
    country,
    provider: requireSafeLabel(record.provider, "payload.provider", {
      minLength: 1,
      maxLength: 80,
    }),
    model: requireSafeLabel(record.model, "payload.model", {
      minLength: 1,
      maxLength: 120,
    }),
    accessType: requireEnum(record.accessType, ACCESS_TYPE_VALUES, "payload.accessType"),
    planLabel: requireSafeLabel(record.planLabel, "payload.planLabel", {
      minLength: 1,
      maxLength: 100,
    }),
    uiLanguage: requireEnum(record.uiLanguage, UI_LANGUAGE_VALUES, "payload.uiLanguage"),
    platform: requireEnum(record.platform, PLATFORM_VALUES, "payload.platform"),
    reasoningToggle: requireEnum(
      record.reasoningToggle,
      REASONING_TOGGLE_VALUES,
      "payload.reasoningToggle",
    ),
    vpnUsed: requireEnum(record.vpnUsed, VPN_USED_VALUES, "payload.vpnUsed"),
    memoryPersonalization: requireEnum(
      record.memoryPersonalization,
      CONFIGURATION_STATE_VALUES,
      "payload.memoryPersonalization",
    ),
    customInstructions: requireEnum(
      record.customInstructions,
      CONFIGURATION_STATE_VALUES,
      "payload.customInstructions",
    ),
    promptsTranslated: requireBinaryFlag(record.promptsTranslated, "payload.promptsTranslated"),
    completedInOneSitting: requireBinaryFlag(
      record.completedInOneSitting,
      "payload.completedInOneSitting",
    ),
    sessionVariant: requireEnum(record.sessionVariant, SESSION_VARIANT_VALUES, "payload.sessionVariant"),
    promptOrder,
    clientTimezone,
    benchmarkVersion,
    responses,
    feedback: parseFeedback(record.feedback, requiredIds),
    website: requireString(record.website, "payload.website", { maxLength: 200 }),
    turnstileToken: requireString(record.turnstileToken, "payload.turnstileToken", {
      minLength: 1,
      maxLength: 4_096,
    }),
  };
}

/** Returns a discriminated result for API handlers that should not throw on invalid input. */
export function validateSubmissionPayload(
  input: unknown,
  requiredPromptIds: readonly string[],
): SubmissionValidationResult {
  try {
    return { ok: true, value: parseSubmissionPayload(input, requiredPromptIds) };
  } catch (error) {
    if (error instanceof SubmissionValidationError) {
      return { ok: false, error };
    }
    throw error;
  }
}
