"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ACCESS_TYPES,
  BENCHMARK_PROMPTS,
  BENCHMARK_VERSION,
  MODEL_CATALOG,
  getBenchmarkPrompt,
  renderPromptForCopy,
  shufflePromptOrder,
  type BenchmarkVariant,
} from "../lib/benchmark";
import {
  localizeCountryOptions,
} from "../lib/countries";
import type {
  AccessType,
  ConfigurationState,
  FeedbackReason,
  Platform,
  ReasoningToggle,
  ResponseSecondsBucket,
  UiLanguage,
  ValidatedSubmission,
  VpnUsed,
} from "../lib/submission";
import { PROMPT_UI, UI_COPY, type Language } from "../lib/uiCopy";
import { TurnstileWidget } from "./TurnstileWidget";

type Stage = "intro" | "setup" | "run" | "review" | "success" | "results" | "methodology";
type FormError = "" | "location" | "fields" | "protocol" | "consent";
type CopyStatus = "" | "copied" | "blocked";
type BinaryChoice = "" | "0" | "1";
type ResultsVersion = "core-2.0" | "core-1.0";

type ResponseDraft = {
  responseText: string;
  regenerated: boolean;
  responseSecondsBucket: ResponseSecondsBucket | "";
};

type ResultGroup = {
  city: string;
  country: string | null;
  provider: string;
  model: string;
  accessType: string;
  planLabel: string;
  sampleSize: number;
  averageScore: number;
};

type ResultsPayload = {
  overview: { submissions: number; cities: number; models: number };
  groups: ResultGroup[];
  privacyThreshold: number;
  benchmarkVersion: ResultsVersion;
  error?: string;
};

const FEEDBACK_REASONS = ["", "unclear", "answer disputed", "technical issue", "too long"] as const;
const ACCESS_VALUES: readonly AccessType[] = ["Free", "Paid", "Not sure"];
const RESULTS_VERSIONS: readonly ResultsVersion[] = ["core-2.0", "core-1.0"];
function createResponseDrafts(): Record<string, ResponseDraft> {
  return Object.fromEntries(
    BENCHMARK_PROMPTS.map((prompt) => [
      prompt.id,
      { responseText: "", regenerated: false, responseSecondsBucket: "" },
    ]),
  );
}

function binaryFlag(value: Exclude<BinaryChoice, "">): 0 | 1 {
  return value === "1" ? 1 : 0;
}

function responseIsComplete(draft: ResponseDraft | undefined): boolean {
  return Boolean(draft?.responseText.trim() && draft.responseSecondsBucket);
}

export function BenchmarkApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [stage, setStage] = useState<Stage>("intro");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [accessType, setAccessType] = useState<AccessType | "">("");
  const [planLabel, setPlanLabel] = useState("");
  const [uiLanguage, setUiLanguage] = useState<UiLanguage | "">("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [reasoningToggle, setReasoningToggle] = useState<ReasoningToggle | "">("");
  const [vpnUsed, setVpnUsed] = useState<VpnUsed | "">("");
  const [memoryPersonalization, setMemoryPersonalization] = useState<ConfigurationState | "">("");
  const [customInstructions, setCustomInstructions] = useState<ConfigurationState | "">("");
  const [promptsTranslated, setPromptsTranslated] = useState<BinaryChoice>("");
  const [completedInOneSitting, setCompletedInOneSitting] = useState<BinaryChoice>("");
  const [consent, setConsent] = useState(false);
  const [sessionVariant, setSessionVariant] = useState<BenchmarkVariant | null>(null);
  const [promptOrder, setPromptOrder] = useState<string[]>([]);
  const [clientTimezone, setClientTimezone] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>(createResponseDrafts);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("");
  const [formError, setFormError] = useState<FormError>("");
  const [submitError, setSubmitError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [score, setScore] = useState<{ score: number; maxScore: number } | null>(null);
  const [clarityRating, setClarityRating] = useState(0);
  const [confusingPromptId, setConfusingPromptId] = useState("");
  const [feedbackReason, setFeedbackReason] = useState<FeedbackReason>("");
  const [resultsVersion, setResultsVersion] = useState<ResultsVersion>(BENCHMARK_VERSION);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState(false);
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultsRequestRef = useRef(0);

  const copy = UI_COPY[language];
  const countryOptions = localizeCountryOptions(language);
  const isUrdu = language === "ur";
  const forwardArrow = isUrdu ? "←" : "→";
  const backArrow = isUrdu ? "→" : "←";
  const selectedModel = model.startsWith("Other") || model.includes("enter the exact")
    ? customModel.trim()
    : model;
  const fallbackPrompt = BENCHMARK_PROMPTS[0];
  const currentPromptId = promptOrder[promptIndex] ?? fallbackPrompt.id;
  const currentBasePrompt = getBenchmarkPrompt(currentPromptId) ?? fallbackPrompt;
  const currentPrompt = renderPromptForCopy(currentBasePrompt, sessionVariant ?? "A");
  const currentPromptUi = PROMPT_UI[language][currentPrompt.id] ?? {
    capability: currentPrompt.capability,
    title: currentPrompt.title,
  };
  const currentDraft = responses[currentPrompt.id] ?? {
    responseText: "",
    regenerated: false,
    responseSecondsBucket: "" as const,
  };
  const completedCount = BENCHMARK_PROMPTS.filter((prompt) => responseIsComplete(responses[prompt.id])).length;
  const selectedCountryLabel = countryOptions.find((option) => option.code === country)?.label ?? country;
  const testedLanguageLabel = uiLanguage ? copy.setup.optionLabels.uiLanguage[uiLanguage] : "—";
  const platformLabel = platform ? copy.setup.optionLabels.platform[platform] : "—";

  function accessLabel(value: string): string {
    return ACCESS_VALUES.includes(value as AccessType)
      ? copy.access[value as AccessType][0]
      : value;
  }

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isUrdu ? "rtl" : "ltr";
  }, [language, isUrdu]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (stage !== "run") return;
    const focusTimer = window.setTimeout(() => promptHeadingRef.current?.focus(), 120);
    return () => window.clearTimeout(focusTimer);
  }, [stage, promptIndex]);

  async function loadResults(version: ResultsVersion) {
    const requestId = resultsRequestRef.current + 1;
    resultsRequestRef.current = requestId;
    setResults(null);
    setResultsLoading(true);
    setResultsError(false);
    try {
      const response = await fetch(`/api/submissions?benchmarkVersion=${encodeURIComponent(version)}`);
      const payload = (await response.json()) as ResultsPayload;
      if (!response.ok) throw new Error(payload.error ?? "Results are unavailable.");
      if (resultsRequestRef.current === requestId) setResults(payload);
    } catch {
      if (resultsRequestRef.current === requestId) setResultsError(true);
    } finally {
      if (resultsRequestRef.current === requestId) setResultsLoading(false);
    }
  }

  function navigate(nextStage: Stage) {
    setFormError("");
    setStage(nextStage);
    if (nextStage === "results") void loadResults(resultsVersion);
  }

  function selectProvider(value: string) {
    setProvider(value);
    setModel("");
    setCustomModel("");
  }

  function beginBenchmark() {
    if (!country || city.trim().length < 2) {
      setFormError("location");
      return;
    }
    if (!provider || !selectedModel || !accessType || !planLabel.trim()) {
      setFormError("fields");
      return;
    }
    if (
      !uiLanguage ||
      !platform ||
      !reasoningToggle ||
      !vpnUsed ||
      !memoryPersonalization ||
      !customInstructions ||
      !promptsTranslated ||
      !completedInOneSitting
    ) {
      setFormError("protocol");
      return;
    }
    if (!consent) {
      setFormError("consent");
      return;
    }

    if (!sessionVariant || promptOrder.length !== BENCHMARK_PROMPTS.length) {
      const entropy = new Uint32Array(2);
      window.crypto.getRandomValues(entropy);
      const variant: BenchmarkVariant = entropy[0] % 2 === 0 ? "A" : "B";
      const seed = `${entropy[0]}-${entropy[1]}-${Date.now()}`;
      setSessionVariant(variant);
      setPromptOrder(shufflePromptOrder(BENCHMARK_PROMPTS.map((prompt) => prompt.id), seed));
      setResponses(createResponseDrafts());
    }

    setClientTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setFormError("");
    setPromptIndex(0);
    setStage("run");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(currentPrompt.prompt);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("blocked");
    }
  }

  function updateCurrentDraft(patch: Partial<ResponseDraft>) {
    setResponses((current) => ({
      ...current,
      [currentPrompt.id]: { ...current[currentPrompt.id], ...patch },
    }));
  }

  function nextPrompt() {
    if (!responseIsComplete(currentDraft)) return;
    setCopyStatus("");
    if (promptIndex === BENCHMARK_PROMPTS.length - 1) {
      setStage("review");
      return;
    }
    setPromptIndex((index) => index + 1);
  }

  function previousPrompt() {
    if (promptIndex === 0) {
      setStage("setup");
      return;
    }
    setCopyStatus("");
    setPromptIndex((index) => index - 1);
  }

  async function submitBenchmark() {
    if (
      !country ||
      !accessType ||
      !uiLanguage ||
      !platform ||
      !reasoningToggle ||
      !vpnUsed ||
      !memoryPersonalization ||
      !customInstructions ||
      !promptsTranslated ||
      !completedInOneSitting ||
      !sessionVariant ||
      promptOrder.length !== BENCHMARK_PROMPTS.length ||
      !turnstileToken
    ) {
      setSubmitError(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(false);
    try {
      const orderedResponses = promptOrder.map((promptId) => {
        const draft = responses[promptId];
        if (!responseIsComplete(draft) || !draft.responseSecondsBucket) {
          throw new Error("incomplete-response");
        }
        return {
          promptId,
          responseText: draft.responseText,
          regenerated: draft.regenerated ? 1 as const : 0 as const,
          responseSecondsBucket: draft.responseSecondsBucket,
        };
      });

      const body: ValidatedSubmission = {
        city: city.trim(),
        country,
        provider,
        model: selectedModel,
        accessType,
        planLabel: planLabel.trim(),
        uiLanguage,
        platform,
        reasoningToggle,
        vpnUsed,
        memoryPersonalization,
        customInstructions,
        promptsTranslated: binaryFlag(promptsTranslated),
        completedInOneSitting: binaryFlag(completedInOneSitting),
        sessionVariant,
        promptOrder,
        clientTimezone: clientTimezone || "UTC",
        benchmarkVersion: BENCHMARK_VERSION,
        responses: orderedResponses,
        feedback: {
          clarityRating,
          confusingPromptId,
          reason: feedbackReason,
        },
        website: "",
        turnstileToken,
      };

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; score?: number; maxScore?: number };
      if (!response.ok || typeof payload.score !== "number" || typeof payload.maxScore !== "number") {
        throw new Error(payload.error ?? copy.errors.save);
      }

      setScore({ score: payload.score, maxScore: payload.maxScore });
      setTurnstileToken("");
      setResponses(createResponseDrafts());
      setPromptOrder([]);
      setSessionVariant(null);
      setPromptIndex(0);
      setResults(null);
      setStage("success");
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="site-shell" lang={language} dir={isUrdu ? "rtl" : "ltr"}>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => navigate("intro")} aria-label={isUrdu ? "Reasoning Across Borders کا مرکزی صفحہ" : "Reasoning Across Borders home"}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b dir="ltr">Reasoning Across Borders</b><small>{copy.brandSubtitle}</small></span>
        </button>
        <nav aria-label={copy.nav.aria}>
          <button type="button" onClick={() => navigate("intro")}>{copy.nav.contribute}</button>
          <button type="button" onClick={() => navigate("results")}>{copy.nav.results}</button>
          <button type="button" onClick={() => navigate("methodology")}>{copy.nav.methodology}</button>
        </nav>
        <div className="language-toggle" role="group" aria-label="Language / زبان" dir="ltr">
          <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
          <button type="button" aria-pressed={language === "ur"} onClick={() => setLanguage("ur")}>اردو</button>
        </div>
      </header>

      {stage === "intro" && (
        <>
          <section className="hero-page">
            <div className="hero-copy">
              <span className="eyebrow">{copy.intro.eyebrow} · <bdi dir="ltr">v{BENCHMARK_VERSION}</bdi></span>
              <h1>{copy.intro.headline}</h1>
              <p className="hero-lede">{copy.intro.lede}</p>
              <div className="hero-actions">
                <button className="button button-primary" type="button" onClick={() => navigate("setup")}>{copy.intro.start} <span aria-hidden="true">{forwardArrow}</span></button>
                <button className="text-button" type="button" onClick={() => navigate("results")}>{copy.intro.seeResults}</button>
              </div>
              <div className="quick-facts" aria-label={copy.intro.factsAria}>
                {copy.intro.facts.map(([title, detail]) => <span key={title}><strong>{title}</strong><small>{detail}</small></span>)}
              </div>
            </div>
            <figure className="hero-visual">
              <Image src="/images/reasoning-across-cities-sketch.jpg" width={1400} height={840} priority unoptimized alt={copy.intro.heroAlt} />
              <figcaption><b>{copy.intro.hypothesis}</b><span>{copy.intro.disclaimer}</span></figcaption>
            </figure>
          </section>
          <section className="why-section" aria-labelledby="why-collect-title">
            <span className="eyebrow">{copy.intro.whyEyebrow}</span>
            <h2 id="why-collect-title">{copy.intro.whyTitle}</h2>
            <div>{copy.intro.whyBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </section>
          <section className="visual-guide" aria-labelledby="visual-guide-title">
            <div className="visual-guide-heading">
              <span className="eyebrow">{copy.intro.guideEyebrow}</span>
              <h2 id="visual-guide-title">{copy.intro.guideTitle}</h2>
            </div>
            <Image src="/images/how-to-contribute-sketch.jpg" width={1400} height={760} unoptimized alt={copy.intro.guideAlt} />
            <ol dir="ltr">{copy.intro.guideSteps.map((step, index) => <li dir={isUrdu ? "rtl" : "ltr"} key={step}><span>{index + 1}</span>{step}</li>)}</ol>
          </section>
        </>
      )}

      {stage === "setup" && (
        <section className="content-page setup-page">
          <div className="section-heading">
            <span className="eyebrow">{copy.setup.eyebrow}</span>
            <h1>{copy.setup.title}</h1>
            <p>{copy.setup.lede}</p>
          </div>
          <div className="setup-layout">
            <form className="setup-form" onSubmit={(event) => { event.preventDefault(); beginBenchmark(); }}>
              <fieldset className="form-section">
                <legend><span>01</span> {copy.setup.where}</legend>
                <div className="field-grid">
                  <div>
                    <label htmlFor="country">{copy.setup.countryLabel}</label>
                    <select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>
                      <option value="">{copy.setup.countryPlaceholder}</option>
                      {countryOptions.map((option) => <option value={option.code} key={option.code}>{option.label} ({option.code})</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="city">{copy.setup.cityLabel}</label>
                    <input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder={copy.setup.cityPlaceholder} autoComplete="off" maxLength={80} dir="auto" aria-describedby="city-note" />
                  </div>
                </div>
                <p className="field-note" id="city-note">{copy.setup.cityNote}</p>
              </fieldset>

              <fieldset className="form-section">
                <legend><span>02</span> {copy.setup.modelQuestion}</legend>
                <div className="field-grid">
                  <div>
                    <label htmlFor="provider">{copy.setup.providerLabel}</label>
                    <select id="provider" value={provider} onChange={(event) => selectProvider(event.target.value)} dir="ltr">
                      <option value="">{copy.setup.choose}</option>
                      {Object.keys(MODEL_CATALOG).map((name) => <option key={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="model">{copy.setup.modelLabel}</label>
                    <select id="model" value={model} onChange={(event) => setModel(event.target.value)} disabled={!provider} dir="ltr">
                      <option value="">{copy.setup.choose}</option>
                      {(provider ? MODEL_CATALOG[provider] : []).map((name) => <option key={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
                {(model.startsWith("Other") || model.includes("enter the exact")) && (
                  <div className="conditional-field">
                    <label htmlFor="custom-model">{copy.setup.exactModel}</label>
                    <input id="custom-model" value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder={copy.setup.exactPlaceholder} maxLength={120} dir="auto" />
                  </div>
                )}
              </fieldset>

              <fieldset className="form-section">
                <legend><span>03</span> {copy.setup.accessQuestion}</legend>
                <div className="choice-row">
                  {ACCESS_VALUES.map((value) => (
                    <label className={`choice-card ${accessType === value ? "selected" : ""}`} key={value}>
                      <input type="radio" name="access" value={value} checked={accessType === value} onChange={() => setAccessType(value)} />
                      <b>{copy.access[value][0]}</b><small>{copy.access[value][1]}</small>
                    </label>
                  ))}
                </div>
                <label htmlFor="plan">{copy.setup.planLabel}</label>
                <input id="plan" list="access-types" value={planLabel} onChange={(event) => setPlanLabel(event.target.value)} placeholder={copy.setup.planPlaceholder} maxLength={100} dir="auto" />
                <datalist id="access-types">{ACCESS_TYPES.map((value, index) => <option value={value} label={copy.accessTypes[index]} key={value} />)}</datalist>
              </fieldset>

              <fieldset className="form-section">
                <legend><span>04</span> {copy.setup.configurationQuestion}</legend>
                <p className="protocol-note"><b>{copy.setup.primaryTarget}:</b> {copy.setup.configurationNote}</p>
                <div className="metadata-grid">
                  <div>
                    <label htmlFor="ui-language">{copy.setup.uiLanguage}</label>
                    <select id="ui-language" value={uiLanguage} onChange={(event) => setUiLanguage(event.target.value as UiLanguage | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["en", "ur"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.uiLanguage[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="platform">{copy.setup.platform}</label>
                    <select id="platform" value={platform} onChange={(event) => setPlatform(event.target.value as Platform | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["web", "ios", "android", "desktop"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.platform[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reasoning-toggle">{copy.setup.reasoningToggle}</label>
                    <select id="reasoning-toggle" value={reasoningToggle} onChange={(event) => setReasoningToggle(event.target.value as ReasoningToggle | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["on", "off", "unavailable", "unsure"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.reasoningToggle[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="vpn-used">{copy.setup.vpnUsed}</label>
                    <select id="vpn-used" value={vpnUsed} onChange={(event) => setVpnUsed(event.target.value as VpnUsed | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["no", "yes", "unsure"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.vpnUsed[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="memory-personalization">{copy.setup.memoryPersonalization}</label>
                    <select id="memory-personalization" value={memoryPersonalization} onChange={(event) => setMemoryPersonalization(event.target.value as ConfigurationState | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["off", "on", "unsure"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.configuration[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-instructions">{copy.setup.customInstructions}</label>
                    <select id="custom-instructions" value={customInstructions} onChange={(event) => setCustomInstructions(event.target.value as ConfigurationState | "")}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["off", "on", "unsure"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.configuration[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="prompts-translated">{copy.setup.promptsTranslated}</label>
                    <select id="prompts-translated" value={promptsTranslated} onChange={(event) => setPromptsTranslated(event.target.value as BinaryChoice)}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["0", "1"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.binary[value]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="one-sitting">{copy.setup.completedInOneSitting}</label>
                    <select id="one-sitting" value={completedInOneSitting} onChange={(event) => setCompletedInOneSitting(event.target.value as BinaryChoice)}>
                      <option value="">{copy.setup.requiredChoice}</option>
                      {(["1", "0"] as const).map((value) => <option value={value} key={value}>{copy.setup.optionLabels.binary[value]}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              <div className="consent-box">
                <label>
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span><b>{copy.setup.consentTitle}</b><small>{copy.setup.consentText}</small></span>
                </label>
              </div>
              {formError && <p className="error-message" role="alert">{copy.errors[formError]}</p>}
              <button className="button button-primary full-button" type="submit">{copy.setup.continue} <span aria-hidden="true">{forwardArrow}</span></button>
            </form>

            <aside className="privacy-card">
              <span className="privacy-icon" aria-hidden="true">◎</span>
              <h2>{copy.setup.privacyTitle}</h2>
              <ul>{copy.setup.privacyItems.map((item) => <li key={item}>{item}</li>)}</ul>
              <p>{copy.setup.privacyNote}</p>
            </aside>
          </div>
        </section>
      )}

      {stage === "run" && (
        <section className="runner-page">
          <aside className="runner-sidebar">
            <span className="eyebrow">{copy.runner.yourTest}</span>
            <h2 dir="ltr">{selectedModel}</h2>
            <p><bdi dir="ltr">{provider}</bdi><br />{accessLabel(accessType)} · <bdi dir="auto">{planLabel}</bdi><br /><bdi dir="auto">{city}, {selectedCountryLabel}</bdi></p>
            <p className="session-variant">{copy.runner.variant}: <bdi dir="ltr">{sessionVariant}</bdi></p>
            <div className="rules-list">
              <b>{copy.runner.rulesTitle}</b>
              <ol>{copy.runner.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>
            </div>
          </aside>

          <div className="runner-main">
            <div className="progress-wrap">
              <div><span>{copy.runner.question} <bdi dir="ltr">{promptIndex + 1}</bdi> {copy.runner.of} <bdi dir="ltr">{BENCHMARK_PROMPTS.length}</bdi></span><span><bdi dir="ltr">{completedCount}</bdi> {copy.runner.complete}</span></div>
              <div className="progress-track" role="progressbar" aria-label={`${copy.runner.question} ${promptIndex + 1} ${copy.runner.of} ${BENCHMARK_PROMPTS.length}`} aria-valuemin={1} aria-valuemax={BENCHMARK_PROMPTS.length} aria-valuenow={promptIndex + 1}>
                <i style={{ width: `${((promptIndex + 1) / BENCHMARK_PROMPTS.length) * 100}%` }} />
              </div>
            </div>

            <article className="prompt-panel">
              <div className="prompt-meta">
                <span>{currentPromptUi.capability}</span>
                <span className="prompt-badges">{!currentPrompt.scored && <em>{copy.runner.unscored}</em>}<code dir="ltr">{currentPrompt.id}</code></span>
              </div>
              <h1 ref={promptHeadingRef} tabIndex={-1}>{currentPromptUi.title}</h1>
              <p className="fixed-prompt-notice">◎ {copy.runner.fixedNotice}</p>
              <div className="prompt-card" lang="en" dir="ltr">
                <pre>{currentPrompt.prompt}</pre>
                <button className="copy-button" type="button" onClick={copyPrompt}>{copy.runner.copyPrompt} <span aria-hidden="true">↗</span></button>
              </div>
              <p className="copy-status" aria-live="polite">{copyStatus ? copy.runner[copyStatus] : copy.runner.defaultStatus}</p>
              <label htmlFor="model-response">{copy.runner.responseLabel}</label>
              <textarea id="model-response" dir="auto" value={currentDraft.responseText} onChange={(event) => updateCurrentDraft({ responseText: event.target.value })} placeholder={copy.runner.responsePlaceholder} maxLength={6000} />
              <p className="token-disclaimer">{copy.runner.tokenNotice}</p>
              {currentDraft.responseText.trim().length > 0 && currentDraft.responseText.trim().length < 12 && <p className="warning-message">{copy.runner.shortWarning}</p>}
              <div className="response-controls">
                <div>
                  <label htmlFor="response-time">{copy.runner.responseTime} <small>{copy.runner.responseControlsHint}</small></label>
                  <select id="response-time" value={currentDraft.responseSecondsBucket} onChange={(event) => updateCurrentDraft({ responseSecondsBucket: event.target.value as ResponseSecondsBucket | "" })}>
                    <option value="">{copy.runner.responseTimePlaceholder}</option>
                    {(["lt5", "5to15", "15to60", "gt60"] as const).map((value) => <option value={value} key={value}>{copy.runner.timeOptions[value]}</option>)}
                  </select>
                </div>
                <label className="regenerated-control">
                  <input type="checkbox" checked={currentDraft.regenerated} onChange={(event) => updateCurrentDraft({ regenerated: event.target.checked })} />
                  <span>{copy.runner.regenerated}</span>
                </label>
              </div>
            </article>

            <div className="runner-actions">
              <button className="button button-secondary" type="button" onClick={previousPrompt}>{backArrow} {copy.runner.back}</button>
              <button className="button button-primary" type="button" onClick={nextPrompt} disabled={!responseIsComplete(currentDraft)}>
                {promptIndex === BENCHMARK_PROMPTS.length - 1 ? copy.runner.review : copy.runner.next} {forwardArrow}
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section className="content-page review-page">
          <div className="section-heading">
            <span className="eyebrow">{copy.review.eyebrow}</span>
            <h1>{copy.review.title}</h1>
            <p>{copy.review.lede}</p>
          </div>
          <div className="review-grid">
            <div className="review-card">
              <h2>{copy.review.record}</h2>
              <dl>
                <div><dt>{copy.review.location}</dt><dd dir="auto">{city}, {selectedCountryLabel} ({country})</dd></div>
                <div><dt>{copy.review.provider}</dt><dd dir="ltr">{provider}</dd></div>
                <div><dt>{copy.review.model}</dt><dd dir="ltr">{selectedModel}</dd></div>
                <div><dt>{copy.review.access}</dt><dd>{accessLabel(accessType)} · <bdi dir="auto">{planLabel}</bdi></dd></div>
                <div><dt>{copy.review.configuration}</dt><dd>{testedLanguageLabel} · {platformLabel}</dd></div>
                <div><dt>{copy.review.responses}</dt><dd dir="ltr">{completedCount} / {BENCHMARK_PROMPTS.length}</dd></div>
              </dl>
              <button className="text-button" type="button" onClick={() => setStage("setup")}>{copy.review.edit}</button>
            </div>
            <div className="feedback-card">
              <span className="card-kicker">{copy.review.improve} <bdi dir="ltr">v{BENCHMARK_VERSION}</bdi></span>
              <h2>{copy.review.feedback}</h2>
              <label htmlFor="clarity">{copy.review.clarity}</label>
              <select id="clarity" value={clarityRating} onChange={(event) => setClarityRating(Number(event.target.value))}>
                <option value={0}>{copy.clarity[0]}</option>
                <option value={5}>{copy.clarity[5]}</option><option value={4}>{copy.clarity[4]}</option><option value={3}>{copy.clarity[3]}</option><option value={2}>{copy.clarity[2]}</option><option value={1}>{copy.clarity[1]}</option>
              </select>
              <label htmlFor="confusing-prompt">{copy.review.attention}</label>
              <select id="confusing-prompt" value={confusingPromptId} onChange={(event) => setConfusingPromptId(event.target.value)}>
                <option value="">{copy.review.none}</option>
                {BENCHMARK_PROMPTS.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.id} · {PROMPT_UI[language][prompt.id].title}</option>)}
              </select>
              <label htmlFor="feedback-reason">{copy.review.why}</label>
              <select id="feedback-reason" value={feedbackReason} onChange={(event) => setFeedbackReason(event.target.value as FeedbackReason)}>
                {FEEDBACK_REASONS.map((reason) => <option value={reason} key={reason}>{copy.feedback[reason]}</option>)}
              </select>
            </div>
          </div>
          <div className="turnstile-card">
            <div><b>{copy.review.turnstileTitle}</b><p>{copy.review.turnstilePrompt}</p></div>
            <TurnstileWidget language={language} onToken={setTurnstileToken} labels={{ loading: copy.review.turnstileLoading, unavailable: copy.review.turnstileUnavailable }} />
            <p className={turnstileToken ? "turnstile-verified" : "turnstile-required"} aria-live="polite">
              {turnstileToken ? copy.review.turnstileVerified : copy.review.turnstileRequired}
            </p>
          </div>
          <div className="submit-card">
            <div><b>{copy.review.anonymous}</b><p>{copy.review.privateNote}</p></div>
            <button className="button button-primary" type="button" onClick={submitBenchmark} disabled={submitting || completedCount !== BENCHMARK_PROMPTS.length || !turnstileToken}>{submitting ? copy.review.submitting : `${copy.review.submit} ${forwardArrow}`}</button>
          </div>
          {submitError && <p className="error-message centered" role="alert">{copy.errors.save}</p>}
        </section>
      )}

      {stage === "success" && score && (
        <section className="success-page">
          <div className="success-mark" aria-hidden="true">✓</div>
          <span className="eyebrow">{copy.success.eyebrow}</span>
          <h1>{copy.success.title}</h1>
          <p className="success-score"><b dir="ltr">{score.maxScore > 0 ? Math.round((score.score / score.maxScore) * 100) : 0}%</b><span>{copy.success.score}</span></p>
          <p>{copy.success.privatePrefix} <bdi dir="auto">{city}, {selectedCountryLabel}</bdi> {copy.success.privateSuffix}</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={() => navigate("results")}>{copy.success.results}</button>
            <button className="text-button" type="button" onClick={() => { setScore(null); setStage("intro"); }}>{copy.success.home}</button>
          </div>
        </section>
      )}

      {stage === "results" && (
        <section className="content-page results-page">
          <div className="section-heading wide-heading results-heading">
            <div>
              <span className="eyebrow">{copy.results.eyebrow}</span>
              <h1>{copy.results.title}</h1>
              <p>{copy.results.lede}</p>
            </div>
            <label className="version-filter" htmlFor="results-version">
              <span>{copy.results.versionLabel}</span>
              <select id="results-version" value={resultsVersion} onChange={(event) => {
                const version = event.target.value as ResultsVersion;
                setResultsVersion(version);
                void loadResults(version);
              }} dir="ltr">
                {RESULTS_VERSIONS.map((version) => <option value={version} key={version}>{copy.results.versions[version]}</option>)}
              </select>
            </label>
          </div>
          {resultsLoading && <div className="loading-card" role="status">{copy.results.loading}</div>}
          {resultsError && <div className="empty-results"><h2>{copy.results.unavailable}</h2><p>{copy.errors.results}</p></div>}
          {results && (
            <>
              <div className="stat-row">
                <div><b dir="ltr">{results.overview.submissions}</b><span>{copy.results.stats[0]}</span></div>
                <div><b dir="ltr">{results.overview.cities}</b><span>{copy.results.stats[1]}</span></div>
                <div><b dir="ltr">{results.overview.models}</b><span>{copy.results.stats[2]}</span></div>
                <div><b dir="ltr">n ≥ {results.privacyThreshold}</b><span>{copy.results.stats[3]}</span></div>
              </div>
              {resultsVersion === "core-2.0" && <p className="score-basis">{copy.results.scoreBasis}</p>}
              {results.groups.length === 0 ? (
                <div className="empty-results">
                  <span aria-hidden="true">···</span>
                  <h2>{copy.results.emptyTitle}</h2>
                  <p>{copy.results.emptyText}</p>
                  <button className="button button-primary" type="button" onClick={() => navigate("setup")}>{copy.results.contribute}</button>
                </div>
              ) : (
                <div className="results-table-wrap">
                  <table>
                    <thead><tr>{copy.results.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                    <tbody>{results.groups.map((group) => (
                      <tr key={`${group.country ?? ""}-${group.city}-${group.provider}-${group.model}-${group.accessType}-${group.planLabel}`}>
                        <td data-label={copy.results.headers[0]}><b dir="auto">{group.city}</b><small dir="ltr">{group.country ?? "—"}</small></td>
                        <td data-label={copy.results.headers[1]}><bdi dir="ltr">{group.model}</bdi><small dir="ltr">{group.provider}</small></td>
                        <td data-label={copy.results.headers[2]}>{accessLabel(group.accessType)}<small dir="auto">{group.planLabel}</small></td>
                        <td data-label={copy.results.headers[3]}><bdi dir="ltr">{group.sampleSize}</bdi>{group.sampleSize < 30 && <small>{copy.results.exploratory}</small>}</td>
                        <td data-label={copy.results.headers[4]}>
                          <div className="score-cell"><span><i style={{ width: `${group.averageScore}%` }} /></span><b dir="ltr">{group.averageScore}%</b></div>
                          <small>{copy.results.descriptive}</small>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <div className="interpretation-note"><b>{copy.results.read}</b><p>{copy.results.interpretation}</p></div>
        </section>
      )}

      {stage === "methodology" && (
        <section className="content-page methodology-page">
          <div className="section-heading wide-heading">
            <span className="eyebrow">{copy.methodology.eyebrow} <bdi dir="ltr">v{BENCHMARK_VERSION}</bdi></span>
            <h1>{copy.methodology.title}</h1>
            <p>{copy.methodology.lede}</p>
          </div>
          <div className="method-grid">
            {copy.methodology.cards.map(([title, body], index) => <article key={title}><span dir="ltr">0{index + 1}</span><h2>{title}</h2><p>{body}</p></article>)}
          </div>
          <section className="guidelines-card" aria-labelledby="participant-guidelines-title">
            <span className="card-kicker">{copy.methodology.guidelinesEyebrow}</span>
            <h2 id="participant-guidelines-title">{copy.methodology.guidelinesTitle}</h2>
            <p>{copy.methodology.guidelinesIntro}</p>
            <div className="guideline-groups">
              {copy.methodology.guidelineGroups.map(([title, items]) => (
                <article key={title}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>
              ))}
            </div>
            <div className="disqualifier-note"><b>{copy.methodology.disqualifiersTitle}</b><ul>{copy.methodology.disqualifiers.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <p className="token-method-note">{copy.methodology.tokenNote}</p>
          </section>
          <div className="limitations-card">
            <span className="card-kicker">{copy.methodology.limits}</span>
            <h2>{copy.methodology.limitsTitle}</h2>
            <div className="limitation-columns">
              <ul>{copy.methodology.limitations.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
              <ul>{copy.methodology.limitations.slice(4).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <div className="method-cta"><div><span className="eyebrow">{copy.methodology.improve}</span><h2>{copy.methodology.cta}</h2></div><button className="button button-primary" type="button" onClick={() => navigate("setup")}>{copy.methodology.run} {forwardArrow}</button></div>
        </section>
      )}

      <footer>
        <p>{copy.footer.left}</p>
        <p>{copy.footer.right}</p>
      </footer>
    </main>
  );
}
