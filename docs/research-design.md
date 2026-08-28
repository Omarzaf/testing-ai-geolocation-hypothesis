# Geographic Information Bias Evaluation

## Publication-grade research design for Reasoning Across Borders

**Status:** Approved design specification  
**Date:** 27 August 2026  
**Repository:** `Omarzaf/testing-ai-geolocation-hypothesis`  
**Current public benchmark:** `core-2.0`  
**Proposed research program:** `parity-3.0`

## 1. Executive decision

Reasoning Across Borders will become a publication-grade audit of whether operational geography changes the English-language information that major AI services provide to users.

The central theoretical concern is that AI systems may develop an emergent center-periphery bias: users in developing, postcolonial economies may receive information that is systematically less accurate, less complete, less well supported, or more often withheld than information supplied to comparable users in developed former colonial cores. This is a hypothesis to test, not a conclusion built into the benchmark.

The project will use a hybrid confirmatory network:

1. A centrally orchestrated, randomized API experiment will isolate network-location effects.
2. A separate account-market experiment will measure account, billing, and entitlement geography.
3. A federated consumer-product study will test whether controlled effects appear in real user interfaces.
4. A location-conditioning probe will test whether an explicit location signal changes otherwise location-neutral answers.
5. A pluralist, blinded evaluation process will measure information accuracy, completeness, evidence quality, substantive refusal, and material framing asymmetry.

The primary study is English-only. It will cover every provider meeting a frozen, preregistered eligibility rule. Country sampling will use clean intersections between present economic position and documented colonial history. Ambiguous countries will be retained for replication analyses but will not be forced into the primary binary contrast.

No single total score, city leaderboard, anecdote, favorable p-value, or crowdsourced comparison will be allowed to establish geographic bias. A confirmatory claim requires a meaningful effect, corrected statistical evidence, multiple countries and prompt families, an independent wave, robustness checks, and compatible direction in both API and consumer layers.

## 2. Why the hypothesis is legitimate

The project begins from documented institutional and technical precedents, while preserving a strict boundary between plausibility and proof.

### 2.1 Historical precedent

Jurisdiction-dependent technology is not speculative. U.S. export controls produced intentionally weaker export-grade cryptography, including product designs that varied effective security strength by destination. The later Logjam research showed that such regional policy compromises could remain embedded in global infrastructure long after the original policy context changed.

Information services have also changed outputs by jurisdiction. Google openly altered search availability in China under legal and political pressure. Controlled studies of e-commerce platforms have found opaque personalization and steering, while also demonstrating why naive geographic comparisons fail: inventories, data centers, experiments, and routing can vary even when geography is irrelevant.

These cases do not prove geographic AI bias. They establish that a common brand and interface can conceal jurisdiction-specific technical or informational treatment, and they supply concrete mechanisms and experimental controls for the present study.

### 2.2 Current AI infrastructure

Major providers already document geographically differentiated model availability, processing regions, data-residency options, feature rollouts, service capacity, and legal restrictions. AWS Bedrock, Microsoft Foundry, Google Cloud, and OpenAI publish region-dependent model or endpoint capabilities. Consumer AI features have also launched at different times across jurisdictions.

This proves that AI service delivery is geographically segmented at the infrastructure, access, feature, and compliance layers. It does not prove that an identical visible model silently produces inferior information in a developing economy.

### 2.3 Direct behavioral evidence

Existing research shows that language models encode geographic and socioeconomic patterns. GeoLLM found systematic geographic bias in model judgments. GlobalOpinionQA found default model positions closer to some countries than others and showed that country prompting can shift outputs. GPT4GEO found weaker geographic knowledge for less prominent places.

A 2026 controlled preprint provides the closest direct mechanism precedent: explicitly injected country metadata changed otherwise neutral outputs across five models and 193 countries. This shows that location can function as an inference-time behavioral signal. It does not show that providers invisibly inject or act on user location in production.

### 2.4 The open empirical gap

Public evidence supports the following propositions:

- geography changes AI access, features, infrastructure, and processing choices;
- AI systems can encode geographic and socioeconomic bias;
- explicit location metadata can change neutral outputs;
- differentiated information service is technically and institutionally feasible.

Public evidence does not yet establish the project’s primary claim: that changing provider-observed user geography causes a systematic English-language information disadvantage for users in developing, postcolonial economies under otherwise comparable service conditions.

That gap is the purpose of `parity-3.0`.

## 3. Research question and claim boundaries

### 3.1 Primary research question

> Holding provider, model, account entitlement, settings, prompt, language, conversation state, and time constant, does operational user geography change the information delivered by an AI service in a way that systematically disadvantages developing, postcolonial economies?

### 3.2 Confirmatory hypothesis

**H1 — Emergent information disadvantage:** For location-invariant English prompts, routing otherwise identical requests through sampled postcolonial developing economies produces a meaningfully worse information-parity profile than routing them through sampled developed former colonial cores.

The directional disadvantage may appear as lower factual accuracy, material omission, weaker evidence, unsupported assertions, higher unjustified refusal, or material framing asymmetry.

### 3.3 Null and equivalence hypothesis

**H0 — Geographic parity:** After design controls and permitted covariate adjustment, the postcolonial-core contrast is zero or smaller than the preregistered smallest effect size of interest.

The confirmatory analysis must include an equivalence test. Failure to reject a zero-effect null is not enough to support parity; the study must be adequately powered to rule out effects large enough to matter.

### 3.4 Secondary questions

1. Does request egress geography affect information independently of account geography?
2. Does account or billing market affect information independently of request egress?
3. Does explicit location conditioning reproduce any observed production effect?
4. Are effects concentrated in sensitive information rather than negative controls?
5. Do effects arise through accuracy, omission, sourcing, refusal, framing, access, or operational quality?
6. Are effects provider-specific or shared across providers?
7. Do consumer interfaces reproduce effects found through controlled APIs?

### 3.5 Permitted conclusions

The strongest permitted conclusion is:

> Under the tested English-language conditions, the evaluated AI services exhibited a replicated, emergent location-conditioned information disadvantage across the sampled postcolonial developing economies.

The study may not infer:

- deliberate provider discrimination without separate direct evidence;
- a change to base-model weights when the serving mechanism is unknown;
- global coverage beyond the sampled countries;
- effects in languages other than English;
- effects across all models or future model versions;
- a single mechanism from output behavior alone.

The experimental unit is the AI service experienced by the user. “Model bias” is acceptable as shorthand only when the report also states that the responsible layer may be model weights, retrieval, routing, safety policy, personalization, account entitlement, or infrastructure.

## 4. Core concepts and classifications

### 4.1 Location-conditioned difference

Any reproducible change in the response distribution caused by a location treatment.

### 4.2 Information disadvantage

A location-conditioned change that reduces factual accuracy, materially omits relevant information, lowers evidence quality, increases unsupported claims, creates unjustified refusal or evasion, or produces materially asymmetric framing.

### 4.3 Emergent bias

A systematic information disadvantage associated with location that appears in the evaluated service without a claim that a provider intentionally designed it. Emergent bias describes an outcome pattern, not provider intent.

### 4.4 Legitimate localization

A location-conditioned change that improves relevance, satisfies a documented legal or safety requirement, or supplies genuinely location-dependent information without reducing the user’s access to accurate and material facts.

### 4.5 Two-stage classification

The analysis must first detect differential treatment without normative labeling. Only after the treatment effect is estimated may blinded reviewers classify it as:

1. beneficial localization;
2. neutral variation;
3. justified legal or safety adaptation;
4. uncertainty or unclassifiable variation;
5. information disadvantage.

## 5. Country taxonomy and sampling

### 5.1 Primary two-class contrast

The theoretical contrast intersects current economic position with documented colonial history.

**Colonial/AI-core clean cases** must satisfy both conditions:

- classified as high income in the World Bank fiscal-year classification frozen for the study; and
- documented as a metropolitan or colonial power in the preregistered historical dataset and adjudication codebook.

**Postcolonial-periphery clean cases** must satisfy both conditions:

- classified as low, lower-middle, or upper-middle income in the same frozen World Bank classification; and
- documented as a former colony or dependency in the historical dataset and adjudication codebook.

The current source of economic classification is the World Bank FY27 analytical income classification, effective 1 July 2026. Historical coding will begin with Correlates of War Colonial/Dependency Contiguity v3.1 and CEPII Gravity colonial-tie fields, then use a published adjudication log for cases those datasets do not resolve cleanly.

### 5.2 Crossover and ambiguous cases

The following are not forced into either confirmatory class:

- high-income former colonies;
- low- or middle-income former imperial powers;
- settler-colonial states with both colonized and colonizing histories;
- states with informal empire but no clear formal-colony coding;
- states lacking reliable income or historical classification.

They form preregistered replication strata. This avoids rewriting complex histories to manufacture a binary result.

### 5.3 Country selection rule

Before data collection, the research team will publish the full candidate universe, exclusions, and final selection. The confirmatory selection must:

- include multiple countries in each class;
- include multiple independent egress nodes within each country;
- avoid allowing one country to dominate either class;
- maximize variation in provider market, cloud proximity, regulatory environment, and infrastructure within each class;
- retain English as the constant test language;
- include only provider-country combinations where testing is authorized.

The study estimates effects for the sampled clean cases. Regional or worldwide generalization requires replication outside that sample.

## 6. Provider and model eligibility

“Major provider” will be determined by a frozen rule, not a discretionary list. On the preregistration cutoff date, a provider is eligible only if it:

1. offers a general-purpose frontier AI assistant;
2. exposes both a public consumer product and a public API;
3. authorizes access in at least two candidate countries per confirmatory class;
4. provides an English-language service;
5. permits the proposed research activity under its published terms;
6. exposes a sufficiently stable model name, snapshot, or endpoint for a synchronized wave;
7. can be tested without evading access controls or misrepresenting user identity.

Every candidate provider must appear in an inclusion/exclusion table with the cutoff-date evidence supporting the decision.

Each eligible provider is analyzed independently. A cross-provider hierarchical synthesis may estimate whether a shared pattern exists, but no provider leaderboard or pooled average may erase provider-specific effects.

An open-weight negative-control model will be deployed identically across research nodes. It verifies measurement stability and helps distinguish provider-serving effects from errors in the collection apparatus. It does not represent the commercial systems being audited.

## 7. Research architecture

### 7.1 Experiment A — randomized network location

This is the primary causal experiment.

- Use the same authorized API credential, model endpoint, configuration, prompt, conversation state, and tool state.
- Randomly assign independent requests to verified egress nodes in sampled countries.
- Use fresh stateless conversations unless conversation context is itself a preregistered factor.
- Send synchronized control twins and use randomized switchback blocks where feasible.
- Record provider request identifiers and official telemetry when available.
- Repeat across time blocks and independent waves.

The primary treatment is verified egress country. Raw IP addresses are not an analytical variable and must not be stored.

### 7.2 Experiment B — account market

This experiment separates account geography from network geography.

- Use legitimately created country-native accounts with accurate registration and billing information.
- Match plan, model, settings, memory state, and product entitlement as closely as provider rules allow.
- Cross account market with authorized egress geography where permitted.
- Treat unmatched entitlements as an access outcome rather than pretending accounts are equivalent.

This arm is weaker than Experiment A when account characteristics cannot be fully standardized. Its purpose is mechanism decomposition, not replacement of the randomized egress experiment.

### 7.3 Experiment C — explicit location conditioning

Keep infrastructure and account fixed while randomizing location context:

- no location;
- a clean-case core location;
- a clean-case postcolonial location;
- `Unknown`;
- a false location distinct from the request origin.

This arm tests whether location can act as a semantic conditioning signal. It cannot prove that a production provider invisibly uses IP or account geography.

### 7.4 Consumer-product replication

Matched regional partners run locked sessions through consumer interfaces within synchronized windows. The protocol records:

- provider and visible model;
- plan and entitlement;
- interface, device class, app or browser version;
- UI language;
- reasoning or tool settings;
- memory, personalization, and custom-instruction state;
- account country and billing market;
- provider-observed network country where consent and platform data permit;
- timestamp, latency, errors, regeneration, and conversation state.

Consumer evidence supplies ecological validity. Because accounts and interfaces cannot always be standardized, it does not independently prove causation.

### 7.5 Access and operations register

Unavailable models, blocked endpoints, delayed features, rate limits, timeouts, latency, truncation, and documented regional differences are recorded separately. Access inequality is substantively important but must not be reported as evidence of information-quality bias.

## 8. Benchmark corpus

### 8.1 Scope

`parity-3.0` is English-only. Every confirmatory location receives identical wording. The study may not generalize to multilingual performance.

### 8.2 Prompt strata

The corpus contains three preregistered families:

1. **Negative controls:** stable, location-invariant facts and tasks where geography should not change content.
2. **Public-interest information:** education, health, economics, technology, and civic knowledge.
3. **Sensitive information:** politics, protest, religion, human rights, contested history, and geopolitics.

Primary prompts are location-neutral: they do not mention the user’s country and do not request local advice. A separate contextual corpus tests prompts where localization is appropriate.

### 8.3 Item construction

Each prompt must have a versioned evidence packet containing:

- construct and prompt-family identifier;
- exact prompt text and permitted variants;
- authoritative evidence sources;
- independently verifiable atomic claims;
- required, optional, and disallowed assertions;
- known contested claims and acceptable uncertainty;
- material omission rules;
- refusal and evasion rules;
- framing dimensions;
- reviewer guidance and examples;
- validity period for time-sensitive facts.

Equivalent surface forms must be calibrated using an anchor bank or formal item-equating procedure. Randomization alone does not make forms equally difficult.

### 8.4 Corpus security and versioning

Expected answers and primary scoring material remain outside the public client and repository until the confirmatory wave is locked or completed. Before collection, the project publishes a cryptographic commitment to the sealed prompt set, evidence packets, and scoring rules. After the embargo ends, it publishes the material needed for replication.

Every change creates a new benchmark version. No prompt, answer key, inclusion rule, or primary analysis may be silently modified after outcomes are inspected.

## 9. Outcome and scoring architecture

### 9.1 Information-parity profile

The primary endpoint is a preregistered multivariate profile, not an opaque total score. It contains:

1. factual accuracy;
2. material completeness and omission;
3. evidence and citation quality;
4. unsupported or fabricated claims;
5. substantive refusal or evasion;
6. material framing asymmetry.

Instruction-following, latency, errors, truncation, feature access, and beneficial localization are reported as distinct secondary outcomes.

### 9.2 Objective scoring

Stable factual claims are decomposed into atomic units and scored against traceable sources. Exact-answer items use deterministic tests. Evidence quality includes whether cited sources exist, support the associated claim, and meet the preregistered source standard.

### 9.3 Pluralist human evaluation

Open-ended responses are reviewed by a balanced panel drawn from core and postcolonial contexts.

- Reviewers are blinded to provider, model, location, treatment, and hypothesis direction where feasible.
- Responses are randomized and stripped of treatment metadata.
- Reviewers score evidence representation and uncertainty rather than ideological agreement.
- Contested claims are identified before response review.
- Inter-rater reliability and disagreement distributions are published.
- Adjudication follows a written process and preserves the original scores.

LLM-as-judge systems may be used only for secondary scalability or robustness analyses. They cannot determine the confirmatory result.

### 9.4 No outcome-conditioned exclusion

A run may be excluded only for a preregistered protocol failure, technical corruption, duplication, verified contamination, or ineligible treatment assignment. Low accuracy, refusal, poor formatting, or failure on an easy item must remain in the analysis.

This rule requires removal of the existing `excluded_floor` logic in `app/api/submissions/route.ts`. The current A1/A2/A3 performance floor conditions on the outcome and could suppress the exact disadvantage the study seeks to measure.

Suspicious runs are flagged separately and included in sensitivity analyses unless a preregistered, outcome-independent exclusion applies.

## 10. Randomization, synchronization, and quality control

- Randomize provider, prompt form, prompt order, location treatment, and time block using server-issued signed assignments.
- Keep every prompt in a fresh conversation for the primary study.
- Pair cross-location requests within the narrowest feasible synchronized window.
- Include same-location twins to estimate inherent platform noise.
- Include a documented geographic access difference as a positive apparatus control.
- Include a known reasoning-effort manipulation on separate calibration tasks as a sensitivity control.
- Use the identically deployed open-weight model as a negative apparatus control.
- Store UTC timestamps and benchmark, model, protocol, rubric, and analysis versions.
- Hash raw responses for provenance and duplicate detection.
- Retain immutable collection logs and a complete exclusion ledger.

Model updates, provider outages, scoring changes, or protocol deviations create separate waves. They are never silently pooled.

## 11. Statistical analysis

### 11.1 Primary estimand

The primary estimand is the average change in the information-parity profile caused by assignment to an authorized postcolonial-periphery egress rather than a colonial/AI-core egress, averaged over the sampled clean-case countries, eligible providers, locked prompt corpus, and confirmatory time windows.

### 11.2 Confirmatory sequence

1. Run a global multivariate test of a class-level geographic effect.
2. If warranted under the preregistered gatekeeping rule, estimate component outcomes.
3. Estimate provider-specific effects.
4. Test provider-by-location and topic-by-location interactions.
5. Conduct a hierarchical cross-provider synthesis.
6. Run equivalence tests against the smallest effect size of interest.

The sequence, family-wise error or false-discovery procedure, and stopping rules are fixed before the confirmatory dataset is unblinded.

### 11.3 Model structure

The primary model is hierarchical and accounts for prompt, country, egress node, provider, model, time block, study wave, repeated generation, account, interface, and reviewer. Outcome families use appropriate links rather than being forced into one scale.

Country and prompt are not treated as independent repeated observations. Paired or crossover assignments use paired estimators. Consumer and API observations are never treated as if they have equal causal status.

### 11.4 Power and practical significance

A blinded pilot estimates platform variance, item difficulty, reviewer variance, refusal prevalence, and intraclass correlation. The pilot does not test the primary class contrast.

Simulation-based power analysis then fixes:

- the smallest effect size of interest for each primary component;
- countries and nodes per class;
- prompts per family;
- repeated generations per cell;
- independent waves;
- reviewer allocation;
- multiplicity-adjusted decision thresholds.

The final sample size is committed in the preregistration before treatment outcomes are examined.

### 11.5 Convergence standard

A public claim of emergent geographic bias requires all of the following:

1. disadvantage exceeding the preregistered meaningful-effect threshold;
2. multiplicity-adjusted statistical evidence;
3. contribution from multiple countries in each class;
4. effects across multiple prompt families rather than one topic;
5. replication in an independent wave;
6. robustness to country taxonomy, infrastructure, regulation, account, and scoring specifications;
7. compatible direction in the API and consumer layers.

If any condition fails, the result is labeled null, mixed, provider-specific, domain-specific, or inconclusive as appropriate.

### 11.6 Falsification criteria

Evidence against the central hypothesis includes:

- between-class variance no larger than synchronized within-location variance;
- effects below the equivalence bound;
- effects disappearing after account, model, time, and infrastructure are matched;
- changes limited to beneficial localization;
- differences explained by prompt-form difficulty, provider rollout, or congestion;
- no replication across countries, waves, or independent scorers;
- contradictory directions across providers or prompt forms without a coherent mechanism.

Null and contradictory results must be published.

## 12. Governance and epistemic safeguards

### 12.1 Hybrid confirmatory network

The central methods team owns protocol locking, randomization, provider eligibility, infrastructure verification, data schema, and confirmatory analysis.

Regional research partners:

- audit corpus relevance and historical assumptions;
- nominate locally consequential prompt domains;
- run locked consumer replications;
- participate in blinded scoring and adjudication;
- review public interpretations;
- receive authorship and governance rights when contribution standards are met.

Regional partners are not anonymous data collectors.

### 12.2 Independent checks

Before collection, the protocol receives adversarial review from experimental-design, ML-evaluation, privacy/ethics, and postcolonial or regional-domain specialists. After collection, an independent statistical team reproduces the confirmatory analysis from the frozen data and code.

Material reviewer objections and the project’s responses are published.

### 12.3 Preregistration package

Before confirmatory collection, publish or cryptographically commit:

- hypotheses and claim language;
- provider and country eligibility;
- treatment definitions;
- prompt-family inventory;
- endpoint definitions;
- exclusion and flagging rules;
- power simulation;
- analysis code or executable pseudocode;
- multiplicity and equivalence rules;
- data dictionary;
- rubric provenance;
- retention and privacy policy;
- funding and conflicts disclosures;
- null-results commitment.

## 13. Ethics, privacy, and platform compliance

- Use only provider-authorized countries, accounts, endpoints, and research methods.
- Never bypass geographic restrictions, impersonate residents, share accounts contrary to terms, or disguise traffic as ordinary users.
- Obtain explicit informed consent from consumer-study participants.
- Derive only coarse network country and network class; discard raw IP immediately.
- Store research data separately from public aggregates.
- Do not publish small cells or raw sensitive responses that create re-identification risk.
- Record whether an account is personal, educational, workplace, or research-owned.
- Publish retention, deletion, incident-response, and access-control procedures.
- Seek formal ethics review before identifiable recruitment, sensitive personal data, covert testing, or account-level longitudinal research.
- Use neutral public language until the convergence standard is met.

## 14. Data contract required for `parity-3.0`

The next benchmark version requires immutable identifiers for:

- study, wave, protocol, preregistration, benchmark, prompt, form, rubric, and analysis version;
- provider, endpoint, visible model, official snapshot where available, plan, and service tier;
- experiment arm, treatment assignment, country, class, egress node, account market, and declared location;
- interface, platform, reasoning setting, tools, memory, personalization, and conversation state;
- UTC dispatch and completion time, latency, status, error, token usage, truncation, and official request identifier;
- participant or account pseudonym, consumer session, reviewer, adjudication, and exclusion ledger;
- raw response hash, sealed raw text, atomic scores, reviewer scores, and derived outcomes.

Raw IP, secrets, API keys, private scoring rules, and direct participant identity must never enter the analytical tables.

Privacy thresholds and statistical thresholds are separate. A cell can be safe to display but too weak to interpret, or statistically adequate but unsafe to publish.

## 15. Relationship to the current repository

The existing application remains useful as an exploratory observatory and recruitment surface. It must not be relabeled as confirmatory evidence.

Required conceptual changes for the next implementation plan are:

1. preserve `core-2.0` as a versioned historical benchmark;
2. remove outcome-conditioned floor exclusion from all new and reanalyzed primary results;
3. stop using self-reported city averages as the main geographic estimator;
4. separate access, operations, information quality, refusals, and localization;
5. replace one total score with versioned component outcomes;
6. add verified coarse treatment geography and immutable experimental assignments;
7. add synchronized API orchestration and consumer-session protocols;
8. preserve sealed evidence packets and scoring material outside public bundles;
9. add preregistration, wave, rubric, and analysis versioning;
10. expose uncertainty, evidence class, and claim level in public results.

No implementation should begin by merely adding more prompts to `core-2.0`. The research contract, schema, sealed rubric format, and analysis interface must be designed first.

## 16. Product claim taxonomy

Every public result receives one evidence label:

| Level | Label | Minimum support |
|---:|---|---|
| 0 | Anecdotal | Screenshot or isolated report |
| 1 | Observed | Descriptive association in exploratory data |
| 2 | Matched | Synchronized comparison exceeding estimated platform noise |
| 3 | Causal under tested conditions | Randomized or switchback location effect |
| 4 | Replicated | Independent waves, countries, providers, or teams |
| 5 | Mechanistically supported | Telemetry or direct technical evidence identifies the pathway |

The interface must never allow a lower-level result to inherit higher-level language.

## 17. Acceptance criteria for the research foundation

The foundation is ready for an implementation plan only when:

- the primary question, H1, H0, equivalence claim, and prohibited inferences are verbatim in the preregistration template;
- country and provider selection are reproducible from frozen source data and codebooks;
- each location channel is represented by a separate treatment variable;
- English is the only confirmatory language and is constant across locations;
- every prompt has a sealed, versioned evidence packet;
- no quality rule depends on model performance;
- the information-parity outcomes remain separable and auditable;
- reviewer blinding and pluralist adjudication are specified;
- the power simulation can determine sample size without inspecting the treatment contrast;
- API and consumer datasets remain analytically distinct;
- privacy, retention, and platform-compliance rules are enforceable in the schema and orchestration layer;
- positive, negative, and same-location controls are present;
- null, mixed, and contradictory outcomes have predefined public language;
- an independent team can rerun the complete confirmatory analysis.

## 18. Out of scope for the first confirmatory protocol

- multilingual or translation effects;
- legal claims of discrimination;
- claims about provider intent;
- covert access or evasion of provider controls;
- real-time news without a frozen evidence snapshot;
- personalization based on protected personal attributes other than operational geography;
- global rankings of countries or providers;
- training a new foundation model;
- treating the public crowdsourced sample as a randomized experiment.

## 19. Primary references

### Historical and digital-service precedents

- [Lotus/IBM differential work-factor cryptography patent](https://patents.google.com/patent/US5764772A/en)
- [Adrian et al., *Imperfect Forward Secrecy: How Diffie-Hellman Fails in Practice*](https://weakdh.org/imperfect-forward-secrecy.pdf)
- [Google, 2010 China update](https://publicpolicy.googleblog.com/2010/03/new-approach-to-china-update.html)
- [Hannak et al., e-commerce discrimination and steering audit](https://conferences.sigcomm.org/imc/2014/papers/p305.pdf)
- [U.S. FTC surveillance-pricing study](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-surveillance-pricing-study-indicates-wide-range-personal-data-used-set-individualized-consumer)

### Geographic and economic classification

- [World Bank FY27 analytical income classification](https://documents1.worldbank.org/curated/en/099063026190549947/pdf/BOSIB-8ff63426-3c40-412d-bad2-cc20a4ebea81.pdf)
- [Correlates of War Colonial/Dependency Contiguity v3.1](https://correlatesofwar.org/data-sets/colonial-dependency-contiguity/)
- [CEPII Gravity database](https://www2.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=8)

### AI infrastructure and product geography

- [AWS Bedrock model-region compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)
- [Microsoft Foundry model-region availability](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability)
- [Google Cloud model endpoints and locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations)
- [OpenAI data residency and regional processing](https://developers.openai.com/api/docs/guides/your-data)

### AI geographic-bias research

- [Col and Chan, *Unintended Effects of Geographic Conditioning in Large Language Models*](https://arxiv.org/html/2606.18124)
- [Manvi et al., *Large Language Models are Geographically Biased*](https://proceedings.mlr.press/v235/manvi24a.html)
- [Durmus et al., GlobalOpinionQA](https://arxiv.org/pdf/2306.16388)
- [Roberts et al., GPT4GEO](https://arxiv.org/pdf/2306.00020)

## 20. Final research posture

Reasoning Across Borders is not designed to confirm a suspicion. It is designed to determine whether a historically plausible form of information inequality survives strict controls.

Its authentic contribution is methodological: making geographic dependence in AI service visible, separating location channels and competing explanations, and establishing how strong the evidence must be before a public claim is made. The project remains successful if it finds a replicated disparity, identifies a benign mechanism, narrows an apparent effect to one provider or domain, or rules out a meaningful English-language difference under the tested conditions.

The only unacceptable outcome is a system that is structurally committed to finding bias regardless of what the evidence shows.
