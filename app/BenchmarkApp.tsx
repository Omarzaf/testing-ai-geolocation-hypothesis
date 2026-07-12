"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCESS_TYPES,
  BENCHMARK_PROMPTS,
  BENCHMARK_VERSION,
  MODEL_CATALOG,
} from "../lib/benchmark";

type Stage = "intro" | "setup" | "run" | "review" | "success" | "results" | "methodology";

type ResultGroup = {
  city: string;
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
  benchmarkVersion: string;
  error?: string;
};

const INITIAL_RESPONSES = Object.fromEntries(BENCHMARK_PROMPTS.map((prompt) => [prompt.id, ""]));
const FEEDBACK_REASONS = ["", "unclear", "answer disputed", "technical issue", "too long"];

function confidenceInterval(score: number, sampleSize: number): string {
  const p = score / 100;
  const observations = Math.max(1, sampleSize * BENCHMARK_PROMPTS.length);
  const margin = 1.96 * Math.sqrt((p * (1 - p)) / observations) * 100;
  return `≈ ${Math.max(0, score - margin).toFixed(1)}–${Math.min(100, score + margin).toFixed(1)}%`;
}

export function BenchmarkApp() {
  const [stage, setStage] = useState<Stage>("intro");
  const [city, setCity] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [accessType, setAccessType] = useState("");
  const [planLabel, setPlanLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>(INITIAL_RESPONSES);
  const [copyStatus, setCopyStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState<{ score: number; maxScore: number } | null>(null);
  const [clarityRating, setClarityRating] = useState(0);
  const [confusingPromptId, setConfusingPromptId] = useState("");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);

  const selectedModel = model.startsWith("Other") || model.includes("enter the exact") ? customModel.trim() : model;
  const currentPrompt = BENCHMARK_PROMPTS[promptIndex];
  const completedCount = Object.values(responses).filter((response) => response.trim()).length;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (stage === "run") {
      window.setTimeout(() => promptHeadingRef.current?.focus(), 120);
    }
  }, [stage, promptIndex]);

  function navigate(nextStage: Stage) {
    setFormError("");
    setStage(nextStage);
    if (nextStage === "results" && !results && !resultsLoading) {
      void loadResults();
    }
  }

  async function loadResults() {
    setResultsLoading(true);
    setResultsError("");
    try {
      const response = await fetch("/api/submissions");
      const payload = (await response.json()) as ResultsPayload;
      if (!response.ok) throw new Error(payload.error ?? "Results are unavailable.");
      setResults(payload);
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : "Results are unavailable.");
    } finally {
      setResultsLoading(false);
    }
  }

  function selectProvider(value: string) {
    setProvider(value);
    setModel("");
    setCustomModel("");
  }

  function beginBenchmark() {
    if (city.trim().length < 2) {
      setFormError("Enter your city or nearest large city—not an address or neighborhood.");
      return;
    }
    if (!provider || !selectedModel || !accessType || !planLabel.trim()) {
      setFormError("Complete the provider, model, access, and plan fields.");
      return;
    }
    if (!consent) {
      setFormError("Confirm that you understand the anonymous contribution rules.");
      return;
    }
    setFormError("");
    setPromptIndex(0);
    setStage("run");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(currentPrompt.prompt);
      setCopyStatus("Copied—paste it into a fresh chat with your selected AI model.");
    } catch {
      setCopyStatus("Copy was blocked by your browser. Select the prompt text and copy it manually.");
    }
  }

  function updateResponse(value: string) {
    setResponses((current) => ({ ...current, [currentPrompt.id]: value }));
  }

  function nextPrompt() {
    if (!responses[currentPrompt.id]?.trim()) return;
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
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: city.trim(),
          provider,
          model: selectedModel,
          accessType,
          planLabel: planLabel.trim(),
          benchmarkVersion: BENCHMARK_VERSION,
          responses: BENCHMARK_PROMPTS.map((prompt) => ({
            promptId: prompt.id,
            responseText: responses[prompt.id],
          })),
          feedback: {
            clarityRating,
            confusingPromptId,
            reason: feedbackReason,
          },
          website: "",
        }),
      });
      const payload = (await response.json()) as { error?: string; score?: number; maxScore?: number };
      if (!response.ok || typeof payload.score !== "number" || typeof payload.maxScore !== "number") {
        throw new Error(payload.error ?? "Your contribution could not be saved.");
      }
      setScore({ score: payload.score, maxScore: payload.maxScore });
      setResponses(INITIAL_RESPONSES);
      setResults(null);
      setStage("success");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your contribution could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => navigate("intro")} aria-label="Reasoning Across Borders home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Reasoning<br />Across Borders</span>
        </button>
        <nav aria-label="Main navigation">
          <button type="button" onClick={() => navigate("intro")}>Contribute</button>
          <button type="button" onClick={() => navigate("results")}>Results</button>
          <button type="button" onClick={() => navigate("methodology")}>Methodology</button>
        </nav>
      </header>

      {stage === "intro" && (
        <section className="hero-page">
          <div className="hero-grid" aria-hidden="true">
            <span className="map-dot dot-one" /><span className="map-dot dot-two" /><span className="map-dot dot-three" />
            <span className="signal-line line-one" /><span className="signal-line line-two" />
          </div>
          <div className="hero-copy">
            <span className="eyebrow">Open public benchmark · v{BENCHMARK_VERSION}</span>
            <h1>Does the same AI <em>reason differently</em> depending on where you use it?</h1>
            <p className="hero-lede">Help test it. Run ten identical prompts through the model you already use, then contribute the complete responses anonymously.</p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={() => navigate("setup")}>Start the benchmark <span aria-hidden="true">→</span></button>
              <button className="text-button" type="button" onClick={() => navigate("results")}>See public results</button>
            </div>
            <div className="quick-facts" aria-label="Benchmark details">
              <span><strong>≈ 10 min</strong><small>one prompt at a time</small></span>
              <span><strong>Anonymous</strong><small>no account or email</small></span>
              <span><strong>City only</strong><small>no GPS or IP stored</small></span>
            </div>
          </div>
          <aside className="research-card">
            <span className="card-kicker">The hypothesis</span>
            <p>When the declared model is held constant, reasoning quality may still vary with the user’s location.</p>
            <div className="mini-comparison" aria-hidden="true">
              <div><span>Same prompt</span><b>01</b></div>
              <div className="mini-path"><i /><i /><i /></div>
              <div><span>Different cities</span><b>?</b></div>
            </div>
            <small>This benchmark measures observable differences. It cannot, by itself, prove intentional routing or hidden model substitution.</small>
          </aside>
        </section>
      )}

      {stage === "setup" && (
        <section className="content-page setup-page">
          <div className="section-heading">
            <span className="eyebrow">Before you begin</span>
            <h1>Set up one comparable run.</h1>
            <p>Enter only what is visible in the AI product you are testing.</p>
          </div>

          <div className="setup-layout">
            <form className="setup-form" onSubmit={(event) => { event.preventDefault(); beginBenchmark(); }}>
              <fieldset className="form-section">
                <legend><span>01</span> Where are you?</legend>
                <label htmlFor="city">City or nearest large city</label>
                <input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Lahore" autoComplete="off" maxLength={80} />
                <p className="field-note">Do not enter an address, neighborhood, postal code, or coordinates.</p>
              </fieldset>

              <fieldset className="form-section">
                <legend><span>02</span> Which model are you testing?</legend>
                <div className="field-grid">
                  <div>
                    <label htmlFor="provider">Provider or product</label>
                    <select id="provider" value={provider} onChange={(event) => selectProvider(event.target.value)}>
                      <option value="">Choose one</option>
                      {Object.keys(MODEL_CATALOG).map((name) => <option key={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="model">Model label shown in the app</label>
                    <select id="model" value={model} onChange={(event) => setModel(event.target.value)} disabled={!provider}>
                      <option value="">Choose one</option>
                      {(provider ? MODEL_CATALOG[provider] : []).map((name) => <option key={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
                {(model.startsWith("Other") || model.includes("enter the exact")) && (
                  <div className="conditional-field">
                    <label htmlFor="custom-model">Exact model label</label>
                    <input id="custom-model" value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="Copy the label shown in your app" maxLength={120} />
                  </div>
                )}
              </fieldset>

              <fieldset className="form-section">
                <legend><span>03</span> What access are you using?</legend>
                <div className="choice-row">
                  {["Free", "Paid", "Not sure"].map((value) => (
                    <label className={`choice-card ${accessType === value ? "selected" : ""}`} key={value}>
                      <input type="radio" name="access" value={value} checked={accessType === value} onChange={(event) => setAccessType(event.target.value)} />
                      <b>{value}</b><small>{value === "Free" ? "No recurring payment" : value === "Paid" ? "Personal, work, or API payment" : "The product does not make this clear"}</small>
                    </label>
                  ))}
                </div>
                <label htmlFor="plan">Plan label or access type</label>
                <input id="plan" list="access-types" value={planLabel} onChange={(event) => setPlanLabel(event.target.value)} placeholder="e.g. Plus, Pro, Team, API, Free" maxLength={100} />
                <datalist id="access-types">{ACCESS_TYPES.map((value) => <option value={value} key={value} />)}</datalist>
              </fieldset>

              <div className="consent-box">
                <label>
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span><b>I understand and want to contribute anonymously.</b><small>The research record contains my city, model/access selections, pasted model responses, scores, benchmark version, and submission day—nothing that identifies my account.</small></span>
                </label>
              </div>
              {formError && <p className="error-message" role="alert">{formError}</p>}
              <button className="button button-primary full-button" type="submit">Continue to instructions <span aria-hidden="true">→</span></button>
            </form>

            <aside className="privacy-card">
              <span className="privacy-icon" aria-hidden="true">◎</span>
              <h2>Your city is the only location information you provide.</h2>
              <ul>
                <li>No name or email</li>
                <li>No sign-in or account ID</li>
                <li>No GPS request</li>
                <li>No IP address stored by this site</li>
                <li>No cookies, analytics, or fingerprinting</li>
              </ul>
              <p>Network infrastructure may transiently process connection data, but this benchmark does not read or add it to the research database.</p>
            </aside>
          </div>
        </section>
      )}

      {stage === "run" && (
        <section className="runner-page">
          <aside className="runner-sidebar">
            <span className="eyebrow">Your test</span>
            <h2>{selectedModel}</h2>
            <p>{provider}<br />{accessType} · {planLabel}<br />{city}</p>
            <div className="rules-list">
              <b>Keep every run comparable</b>
              <ol>
                <li>Start a fresh chat for each prompt.</li>
                <li>Keep web, search, and tools off.</li>
                <li>Do not edit or translate.</li>
                <li>Use the first answer only.</li>
                <li>Paste the complete response.</li>
              </ol>
            </div>
          </aside>

          <div className="runner-main">
            <div className="progress-wrap">
              <div><span>Question {promptIndex + 1} of {BENCHMARK_PROMPTS.length}</span><span>{completedCount} complete</span></div>
              <div className="progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={BENCHMARK_PROMPTS.length} aria-valuenow={promptIndex + 1}>
                <i style={{ width: `${((promptIndex + 1) / BENCHMARK_PROMPTS.length) * 100}%` }} />
              </div>
            </div>

            <article className="prompt-panel">
              <div className="prompt-meta">
                <span>{currentPrompt.capability}</span><code>{currentPrompt.id}</code>
              </div>
              <h1 ref={promptHeadingRef} tabIndex={-1}>{currentPrompt.title}</h1>
              <div className="prompt-card">
                <pre>{currentPrompt.prompt}</pre>
                <button className="copy-button" type="button" onClick={copyPrompt}>Copy prompt <span aria-hidden="true">↗</span></button>
              </div>
              <p className="copy-status" aria-live="polite">{copyStatus || "Copy this exactly, then paste the model’s first complete answer below."}</p>
              <label htmlFor="model-response">Paste the complete model response</label>
              <textarea id="model-response" value={responses[currentPrompt.id] ?? ""} onChange={(event) => updateResponse(event.target.value)} placeholder="Paste the response here—including any explanation, refusal, or error message." maxLength={6000} />
              {responses[currentPrompt.id]?.trim().length > 0 && responses[currentPrompt.id].trim().length < 12 && <p className="warning-message">This response is unusually short. A refusal or error is valid, but please paste it completely.</p>}
            </article>

            <div className="runner-actions">
              <button className="button button-secondary" type="button" onClick={previousPrompt}>← Back</button>
              <button className="button button-primary" type="button" onClick={nextPrompt} disabled={!responses[currentPrompt.id]?.trim()}>
                {promptIndex === BENCHMARK_PROMPTS.length - 1 ? "Review responses" : "Next question"} →
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section className="content-page review-page">
          <div className="section-heading">
            <span className="eyebrow">Final check</span>
            <h1>Ready to contribute.</h1>
            <p>Your answers are scored on the server. Correct answers are not shown before submission.</p>
          </div>
          <div className="review-grid">
            <div className="review-card">
              <h2>Benchmark record</h2>
              <dl>
                <div><dt>City</dt><dd>{city}</dd></div>
                <div><dt>Provider</dt><dd>{provider}</dd></div>
                <div><dt>Model</dt><dd>{selectedModel}</dd></div>
                <div><dt>Access</dt><dd>{accessType} · {planLabel}</dd></div>
                <div><dt>Responses</dt><dd>{completedCount} / {BENCHMARK_PROMPTS.length}</dd></div>
              </dl>
              <button className="text-button" type="button" onClick={() => setStage("setup")}>Edit setup</button>
            </div>
            <div className="feedback-card">
              <span className="card-kicker">Help improve v{BENCHMARK_VERSION}</span>
              <h2>Optional structured feedback</h2>
              <label htmlFor="clarity">Were the prompts clear?</label>
              <select id="clarity" value={clarityRating} onChange={(event) => setClarityRating(Number(event.target.value))}>
                <option value={0}>Skip this question</option>
                <option value={5}>Very clear</option><option value={4}>Mostly clear</option><option value={3}>Mixed</option><option value={2}>Often unclear</option><option value={1}>Very unclear</option>
              </select>
              <label htmlFor="confusing-prompt">Which prompt needs attention?</label>
              <select id="confusing-prompt" value={confusingPromptId} onChange={(event) => setConfusingPromptId(event.target.value)}>
                <option value="">None / skip</option>
                {BENCHMARK_PROMPTS.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.id} · {prompt.title}</option>)}
              </select>
              <label htmlFor="feedback-reason">Why?</label>
              <select id="feedback-reason" value={feedbackReason} onChange={(event) => setFeedbackReason(event.target.value)}>
                {FEEDBACK_REASONS.map((reason) => <option value={reason} key={reason}>{reason || "Skip this question"}</option>)}
              </select>
            </div>
          </div>
          <div className="submit-card">
            <div><b>Anonymous by design</b><p>No raw response appears publicly. Groups are hidden until at least five matching contributions exist.</p></div>
            <button className="button button-primary" type="button" onClick={submitBenchmark} disabled={submitting || completedCount !== BENCHMARK_PROMPTS.length}>{submitting ? "Contributing…" : "Contribute anonymously →"}</button>
          </div>
          {submitError && <p className="error-message centered" role="alert">{submitError}</p>}
        </section>
      )}

      {stage === "success" && score && (
        <section className="success-page">
          <div className="success-mark" aria-hidden="true">✓</div>
          <span className="eyebrow">Contribution received</span>
          <h1>Your run is now part of the benchmark.</h1>
          <p className="success-score"><b>{Math.round((score.score / score.maxScore) * 100)}%</b><span>objective reasoning score</span></p>
          <p>Your raw model responses remain private. The aggregate for {city} will appear only after enough matching contributions meet the five-response privacy threshold.</p>
          <div className="hero-actions">
            <button className="button button-primary" type="button" onClick={() => navigate("results")}>View aggregate results</button>
            <button className="text-button" type="button" onClick={() => { setScore(null); setStage("intro"); }}>Return home</button>
          </div>
        </section>
      )}

      {stage === "results" && (
        <section className="content-page results-page">
          <div className="section-heading wide-heading">
            <span className="eyebrow">Public aggregate · v{BENCHMARK_VERSION}</span>
            <h1>Look for patterns,<br /><em>not rankings.</em></h1>
            <p>These comparisons show observed behavior under self-reported conditions. They do not prove that location caused the difference or that a provider substituted a model.</p>
          </div>
          {resultsLoading && <div className="loading-card" role="status">Loading aggregate results…</div>}
          {resultsError && <div className="empty-results"><h2>Results are not ready yet.</h2><p>{resultsError}</p></div>}
          {results && (
            <>
              <div className="stat-row">
                <div><b>{results.overview.submissions}</b><span>eligible contributions</span></div>
                <div><b>{results.overview.cities}</b><span>self-reported cities</span></div>
                <div><b>{results.overview.models}</b><span>declared models</span></div>
                <div><b>n ≥ {results.privacyThreshold}</b><span>display threshold</span></div>
              </div>
              {results.groups.length === 0 ? (
                <div className="empty-results">
                  <span aria-hidden="true">···</span>
                  <h2>No comparison has reached the privacy threshold yet.</h2>
                  <p>Be one of the first contributors. A city/model/access group appears after five eligible runs.</p>
                  <button className="button button-primary" type="button" onClick={() => navigate("setup")}>Contribute a run</button>
                </div>
              ) : (
                <div className="results-table-wrap">
                  <table>
                    <thead><tr><th>City</th><th>Declared model</th><th>Access</th><th>Runs</th><th>Reasoning score</th></tr></thead>
                    <tbody>{results.groups.map((group) => (
                      <tr key={`${group.city}-${group.provider}-${group.model}-${group.accessType}-${group.planLabel}`}>
                        <td><b>{group.city}</b></td>
                        <td>{group.model}<small>{group.provider}</small></td>
                        <td>{group.accessType}<small>{group.planLabel}</small></td>
                        <td>{group.sampleSize}{group.sampleSize < 30 && <small>exploratory</small>}</td>
                        <td>
                          <div className="score-cell"><span><i style={{ width: `${group.averageScore}%` }} /></span><b>{group.averageScore}%</b></div>
                          <small>Approx. 95% interval {confidenceInterval(group.averageScore, group.sampleSize)}</small>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <div className="interpretation-note"><b>Read this carefully</b><p>A difference is evidence of behavioral variation—not proof of a different backend model. Compare only the same provider, declared model, access type, and benchmark version.</p></div>
        </section>
      )}

      {stage === "methodology" && (
        <section className="content-page methodology-page">
          <div className="section-heading wide-heading">
            <span className="eyebrow">Methodology · core benchmark v{BENCHMARK_VERSION}</span>
            <h1>A small experiment,<br /><em>made stronger together.</em></h1>
            <p>The benchmark asks whether objective reasoning performance is associated with a participant’s self-entered city when the declared model and access type are held constant.</p>
          </div>
          <div className="method-grid">
            <article><span>01</span><h2>What is measured</h2><p>Ten fixed tasks cover arithmetic, deduction, patterns, probability, instruction following, structured output, evidence fidelity, code, spatial reasoning, and logical inference.</p></article>
            <article><span>02</span><h2>What is stored</h2><p>City, selected provider/model/access, complete model outputs, derived scores, benchmark version, submission day, and optional structured prompt-quality feedback.</p></article>
            <article><span>03</span><h2>What stays private</h2><p>Raw model outputs never appear in public results. The site does not request or store names, emails, account identifiers, GPS, IP addresses, cookies, analytics identifiers, or device fingerprints.</p></article>
            <article><span>04</span><h2>How scoring works</h2><p>Answers are scored server-side against versioned objective criteria. Public cells require five eligible submissions; results below thirty remain explicitly exploratory.</p></article>
          </div>
          <div className="limitations-card">
            <span className="card-kicker">Limits of the evidence</span>
            <h2>This can identify a pattern. It cannot establish intent.</h2>
            <div className="limitation-columns">
              <ul><li>City is self-reported and unverified.</li><li>Participants are a convenience sample.</li><li>Manual copying can introduce errors.</li><li>People may contribute more than once.</li></ul>
              <ul><li>Billing region and account history remain uncontrolled.</li><li>Providers update models and run experiments.</li><li>Models are nondeterministic.</li><li>English prompts may interact with locale settings.</li></ul>
            </div>
          </div>
          <div className="method-cta"><div><span className="eyebrow">Help improve the evidence</span><h2>Every careful contribution makes the comparison more useful.</h2></div><button className="button button-primary" type="button" onClick={() => navigate("setup")}>Run the benchmark →</button></div>
        </section>
      )}

      <footer>
        <p>Reasoning Across Borders · An independent, open benchmark</p>
        <p>No tracking · No sign-in · City only</p>
      </footer>
    </main>
  );
}
