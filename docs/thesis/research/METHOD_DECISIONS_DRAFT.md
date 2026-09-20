# Four methodological decisions — working draft v0.1

Prepared 2026-09-19. **Discussion draft. TD-004 terminology is student-approved; other methodological choices and supervisor acceptance remain pending.** Specific numbers and thresholds below are proposals for this study, not universal definitions from the literature. Do not use this document as a frozen codebook yet.

## 1. Make self-evaluation inspectable

The developer is also the researcher. The response should address this through a procedure, rather than promising objectivity.

Proposed procedure:

1. Assemble a candidate-episode inventory before final coding, recording date/window, case, available sources and inclusion/exclusion reason. Do not select only episodes where the AI failed or succeeded.
2. Apply this draft to one worked pilot. Record each label, the evidence supporting it and a plausible alternative explanation. The [SEC-02 example](pilot/SEC02_WORKED_EXAMPLE_DRAFT.md) is provisional and may be replaced if its attribution gaps make another pilot more useful.
3. Where available, ask a competent human reviewer to apply the rules to the source packet before seeing the student's labels. Start with the pilot; a feasible later check would cover three selected episodes, one per case. Availability and consent are unconfirmed.
4. Preserve initial labels and disagreements. Revise unclear rules, record the reason, freeze codebook v1.0 and re-code the pilot before main coding. Later rule changes require a new version and reconsideration of every affected episode.
5. If no external reviewer is available, document that limit and propose delayed re-coding of a small subset after 7–14 days, without displaying the first labels. This is a consistency check by the same person, not independent validation or inter-rater reliability.

AI may organize evidence or challenge a label. Human review of AI-written classifications remains necessary. Agreement between two models does not remove shared bias. Retain contradictory and unsuccessful episodes when they meet the sampling criteria.

## 2. Define the participant from facts, not application complexity

**Student information received on 2026-09-19:** current MSc study in Computer Science at VIZJA University; a bachelor's degree in Ecology from Baku State University; a 7–8-month full-stack development training programme at Code Academy in Baku; basic hobby websites using HTML/CSS, some C# exposure, limited backend confidence, and no professional employment as a software developer. The student explicitly clarified that Code Academy was a training programme. This is self-report. The chronology of these experiences relative to each project's start still needs mapping.

**Student-approved terminology direction (TD-004, 2026-09-19):** “a student developer with prior programming exposure but no professional software development experience.” This describes the supplied facts more precisely than an unqualified “novice developer.” It does not establish an objectively measured skill level. Applied to the English working proposal; supervisor acceptance remains pending.

Title applying the accepted terminology in the working proposal:

> From Natural-Language Prompts to Functional Software: A Longitudinal Multi-Case Study of AI-Assisted Software Development by a Student Developer

Main question applying the accepted terminology in the working proposal:

> How and under what conditions does a student developer with prior programming exposure but no professional software development experience use generative AI coding assistants to design, implement and iteratively improve functional applications, and what limitations and human oversight requirements emerge?

Use an **entry profile**, anchored to when each project began: relevant education, prior programming practice, professional development experience and ability to complete tasks without AI. Record the project sequence and later learning. A person can enter with little experience and become more capable during a longitudinal study.

Do not equate absence of paid employment with absence of technical knowledge. Do not describe the student as having no education, no coding ability or no experience until they confirm the facts. The presence of complex features is also not a direct measure of unaided skill.

Apply the accepted “student developer” terminology consistently across the title, aim, research question and claims. Describe the entry profile explicitly, without reintroducing a novice label or implying some professional employment. Do not claim that one participant represents all novices or that their skills stayed constant.

## 3. Reduce depth of secondary cases without losing comparison

Proposed starting target: **12 episodes — 8 SPARK, 2 SynCinema, 2 AutoSRT**, including the pilot if it meets the final rules. This is conditional on the evidence audit and the student's available time. It is not a quota to fill with weak evidence.

The student reports an approximate July 2027 submission target. Weekly availability and the exact deadline are still unknown; the longer calendar window alone does not justify keeping an unnecessarily broad sample. An alternative under discussion is 14 episodes (10 SPARK + 2 + 2). Neither option has been adopted.

**Discussion status, 2026-09-19:** the student requested a simpler, more detailed explanation of what an episode means and why 12 was suggested. This is a clarification request, not acceptance or rejection of a sample size. Explain one episode as one bounded development problem or feature followed through its attempts and checks; several prompts and commits can belong to the same episode. Any invented teaching example must remain outside the observed dataset.

Select secondary episodes for a stated comparative question: for example, how an automated check differs from behaviour in a mobile device, browser audio workflow or local GPU environment. These are candidate comparisons, not verified events in the two uninspected projects.

For each candidate, require a bounded problem and evidence sufficient for the particular intended claim. A missing transcript may still permit a code-evolution comparison, but not an AI-authorship claim. Keep an exclusion record and note archival/availability bias. If fewer secondary episodes qualify, reduce the sample or narrow the comparison rather than reconstructing missing conversations.

Keep the twelve original fields as a compact evidence record. Concentrate analysis on five groups: task/context; AI activity; human intervention; outcome/error/rework; and claim-specific verification. Avoid twelve separate scores and a composite “AI quality” score. Report counts only for eligible observed episodes, with unknowns and denominators visible. This purposive sample cannot estimate a population-wide AI error rate or demonstrate a causal productivity gain.

After timing the pilot work prospectively, estimate the remaining workload from the actual effort, including evidence preparation, review and writing. No time estimate is supplied as measured fact. Freeze the observation cutoff and selection rules before main coding. Platform, developer learning and changing tool versions may be confounded; differences between cases cannot simply be attributed to AI capability.

## 4. Draft operational rules

### Episode and iteration boundaries

An episode follows one stable problem or acceptance question from its first traceable request/observation through response, revision and verification, ending at acceptance, rejection, abandonment or the declared observation cutoff. Several commits may belong to it. Reopening the same unresolved requirement is linked to the existing episode rather than counted as an unrelated success/failure. A materially new requirement may start a linked episode; log the boundary reason.

An iteration is an identifiable proposed solution followed by evaluation and, where needed, revision. Count only observable attempts. Commits, messages and tool calls are not interchangeable with iterations. Report `UNKNOWN` where the beginning or middle of the sequence is missing.

### Documented error and attribution

Classify a **documented software/claim error** when a specific output contradicts (a) a requirement or constraint already applicable at that point, or (b) a verifiable factual/technical claim, and there is linked evidence of the contradiction. State the applicable requirement/source version and the evidence used; later expectations are not retroactively requirements.

Add **AI-attributed** only when a preserved response/patch or equivalent provenance links that specific output to AI. A buggy file, an AI-looking commit message or a later AI-written history alone is insufficient. If the bug is proven but provenance is missing, record `DEFECT_CONFIRMED / AI_ATTRIBUTION_UNKNOWN`. Do not count it in an AI-error numerator.

Other classifications, recorded separately when relevant:

- `PROMPT_UNDERSPECIFIED`: a material expectation was missing or ambiguous and the response was compatible with the information then supplied. State the ambiguity; do not apply this label merely because the prompt was short.
- `REQUIREMENT_CHANGED`: the student introduced or changed the intended behaviour after the output. This is not automatically an AI error.
- `UNSUPPORTED_SUCCESS_CLAIM`: the assistant claimed a relevant verification or outcome without evidence adequate for that exact claim. Distinguish “not demonstrated” from “demonstrated false.”
- `ENVIRONMENT_LIMITATION`: a tool/platform condition prevents execution or checking; lack of a test environment alone is not faulty output.
- `UNKNOWN`: sources cannot discriminate between the alternatives. Preserve the uncertainty rather than forcing a favourable or unfavourable label.

An ambiguous prompt and a separate false technical statement can coexist; record their separate reasons. Apply each label to the particular output/claim, then summarize at episode level without double-counting one episode as multiple cases.

### Minor and substantial rework

The term **AI-output rework** requires an observable AI proposal and subsequent alteration responding to its evaluation. Do not infer it merely from the total size of the application fix. Keep “change needed to correct the baseline defect” separate from “revisions to an AI-proposed solution.”

| Code | Proposed observable rule |
|---|---|
| `NONE_OBSERVED` | Complete observed sequence shows no corrective revision before acceptance of the scoped deliverable. This does not mean error-free or device-verified. |
| `MINOR` | A localized correction preserves the proposed core approach, interface contracts, data model and lifecycle/ownership rules; the changed branch can be checked without redesigning those arrangements. |
| `SUBSTANTIAL` | At least one central mechanism is replaced, a data model or interface contract must change, or lifecycle/ownership/control flow is restructured across collaborating responsibilities. Name the triggering criterion and cite before/after evidence. |
| `UNKNOWN` | Source sequence or impact evidence is insufficient. |
| `NOT_APPLICABLE` | No observable AI proposal is being evaluated/revised in the defined episode. |

Use the more consequential criterion if both minor and substantial changes occur. Do not use number of lines, files, prompts or elapsed hours as the sole threshold. A one-line fix can have high risk without being substantial rework; a broad rename can touch many files without redesign. Record severity separately from rework.

Illustrative examples only: adjusting an incorrect conditional within an otherwise retained approach may be minor; replacing the proposed persistence/transaction design may be substantial; changing a button colour after the user's preference changes is a requirement refinement, not automatically an AI error. These are not observations from the dataset.

### Verification and acceptance

Preserve E0–E4 from the submitted proposal, attaching them to claims and sources. E0 is narrative/reconstruction; E1 implementation; E2 automated checks; E3 identified runtime/device observation; E4 explicit human acceptance or release. Record multiple types where appropriate, with conditions and limitations. They are **not a single ladder of software quality**: acceptance does not substitute for tests, and tests do not prove physical-device behaviour.

Use separate fields for acceptance, technical verification and unresolved risks. New checks carried out for the thesis receive their actual date; they cannot be backdated into the original development episode. AI-generated tests are evidence of their tested scenarios, not independent assurance that all requirements were tested.

## Proposed method wording for later revision

> The study will use a versioned episode-coding protocol, piloted before the main analysis. Each classification will be accompanied by its source reference, decision rationale and unresolved alternative explanations. The analysis will distinguish confirmed software defects from defects attributable to a preserved AI output, and will record missing attribution as unknown. The researcher's entry experience and subsequent learning will be described explicitly. A smaller primary/secondary sample will be selected for comparative relevance and evidence sufficiency, with inclusion and exclusion reasons retained. Independent human review will be included only to the extent actually arranged and completed; otherwise, the limits of single-researcher classification will remain explicit.

This paragraph is a draft, not a replacement already applied to the submitted proposal.

## Methodological starting points

Runeson, P., & Höst, M. (2009). *Guidelines for conducting and reporting case study research in software engineering*. Empirical Software Engineering, 14, 131–164. https://doi.org/10.1007/s10664-008-9102-8. Supports attention to a study protocol, multiple sources, validity threats and an inspectable evidence chain; it does not establish this draft's sample size or thresholds.

MacQueen, K. M., McLellan, E., Kay, K., & Milstein, B. (1998). *Codebook development for team-based qualitative analysis*. Cultural Anthropology Methods, 10(2), 31–36. https://doi.org/10.1177/1525822X980100020301. Supports explicit code definitions, inclusion/exclusion criteria and examples. Its team-based setting does not establish independent-coder reliability for this single-researcher study.

These are initial methodological anchors, not a completed literature review or a claim that this exact codebook has been validated.
