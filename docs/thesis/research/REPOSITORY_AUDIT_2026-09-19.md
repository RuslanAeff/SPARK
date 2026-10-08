# Initial secondary-case evidence inventory

Observed: 2026-09-19, Europe/Warsaw. Scope: remote file inventory and selected document contents, **not** a complete Git-history audit, formal episode selection, application verification or setup of the other repositories.

The student provided the [SynCinema](https://github.com/RuslanAeff/SynCinema) and [AutoSRT](https://github.com/RuslanAeff/AutoSRT) repository references during this session. Read-only GitHub API access was used after the web reader could not retrieve some pages. No clone, commit, push, upload or application execution was performed. Local working copies, unpushed changes and private conversation archives remain uninspected.

## Observed source versions

| Case | `main` reference observed via GitHub API | Source inventory |
|---|---|---|
| SynCinema | `710ea56cbf080b3260520b0497b7c0cde43120ab` | Non-truncated recursive remote listing; selected planning ledger entries and complete CI workflow read |
| AutoSRT | `1739d828bce50af0eeec18cce441121b75da221b` | Non-truncated recursive remote listing, eight file entries; complete README read |

The machine-readable [inventory](sources/repository-inventory-2026-09-19.json) records inspected source references and Git blob identifiers. It is metadata, not a full archive of the repositories or original conversations. The branch reference can change after this observation; use the recorded identifiers when following up. A cached web rendering of a moving branch is not preferred over the captured API listing for this inventory.

## SynCinema: existing records can be reused

The remote tree contains `Planner-docs/Planing-Ledger.md`, planning/sub-plan documents, an autopsy document, English/Turkish whitepapers, a CI workflow and eight `.test.ts` files. File presence is implementation/document availability, not proof that tests passed.

Selected entries in the [existing ledger](https://github.com/RuslanAeff/SynCinema/blob/710ea56cbf080b3260520b0497b7c0cde43120ab/Planner-docs/Planing-Ledger.md) describe planning and later implementation, with dates recorded as July 2026, validation claims and open follow-ups. Their original execution, human acceptance and authorship still require supporting sources. Only selected entries were read in this initial inventory; do not claim a complete ledger/history review.

Two useful leads for a later source audit, **not selected thesis episodes**:

- **SYN-C01 — Microphone permission moved to a user gesture.** The ledger's Faz2.4 entry reports removing a mount-time request and tracing the remaining button path; it also says live browser confirmation was unavailable/pending. This may support comparison of code inspection versus runtime verification, once before/after code and any surviving original records are checked. Do not inherit a broad “verified” label as E3 proof.
- **SYN-C02 — Introduction of the test runner and CI test step.** The Faz4.1 entry reports a startup error on an initial import and a subsequent correction. This is a lead for examining an attempted solution and its verification. The ledger alone does not establish the precise original AI response, complete iteration sequence or independent evidence of the historical CI run.

The inspected [CI workflow](https://github.com/RuslanAeff/SynCinema/blob/710ea56cbf080b3260520b0497b7c0cde43120ab/.github/workflows/ci.yml) configures dependency installation, type checking, linting, tests and build. No Actions execution log was retrieved here, and no check was run by this session.

**Setup recommendation:** retain the existing ledger as the technical-history source. A future local `docs/thesis/README.md` can point to it and to the central thesis hub, with an evidence index adding thesis-specific source/claim links. Do not copy its historical claims into a second “original” log or overwrite its terminology without checking the sources.

## AutoSRT: source exists, process evidence still needs investigation

The inspected snapshot contains `.gitignore`, `AutoSRT.vbs`, `LICENSE`, `README.md`, `icon.ico`, `icon.png`, `main.py` and `requirements.txt`. No dedicated tests directory/files, CI workflow or research-log directory appears in that snapshot. This is not a claim about every historical revision or the student's local files.

The [README](https://github.com/RuslanAeff/AutoSRT/blob/1739d828bce50af0eeec18cce441121b75da221b/README.md) describes a desktop transcription/subtitle application, implementation arrangements and features. These descriptions are candidate claims to check, not runtime evidence. `main.py` contents and the commit history were not inspected in this initial pass.

**Investigation lead:** look for historical revisions and surviving conversations that document movement from a script to a GUI, or an individual bounded output-validation/model-handling change. The complete script-to-product history may be too broad to count as one episode. No AutoSRT episode has been established or selected here.

**Setup recommendation:** first inspect history and any existing local records. If no equivalent log exists, start a dated project log and evidence index now, labelling reconstruction of older work as retrospective. Do not write a fictional day-by-day development history.

## What this changes in the plan

The student's concern about sparse records is partly resolved for SynCinema: a substantial planning/implementation record exists remotely, although its claims need verification. AutoSRT has source and descriptive material, while the availability of development-process evidence remains uncertain. This is insufficient to decide the final episode count or to confirm a complete three-case dataset.

Next: inspect a bounded set of relevant before/after revisions and original evidence for these leads; locate any saved conversations the student actually has; then decide comparative scope. The coordination templates are ready in the hub, but neither secondary repository has been changed or configured by this task.


## Follow-up source check — 2026-10-04

This dated addition supersedes the initial claim that AutoSRT has no established
bounded leads; it does not rewrite the September snapshot. Read-only GitHub API
retrieval checked selected historical commit patches, AutoSRT's current tree and
first history page (12 entries returned with per_page=100), and SynCinema's tree
at the imported packet revision. [Selected source extracts](sources/secondary-source-check-2026-10-04.json)
retain exact revisions, URLs, patches, response hashes and limits. No dependency
installation, tests, app launch, GPU run, database query or deployment performed.
The cached GitHub landing page was not used to establish current commit counts.

### SynCinema: narrowed comparative shortlist

| Candidate | New source check | Eligibility recommendation / remaining gap |
|---|---|---|
| SYN-C01 microphone permission | API diff at `75d06fc337281cee73eb8f60ad345dabb2f925a1` confirms removal of mount-time refreshDevices; devicechange listener retained. | Priority comparison with SPARK: source inspection versus user-observed behaviour. Accept only the scoped implementation claim now. Imported browser check remains participant-reported with missing exact deployed revision and no retained artifact in the hub. No fresh browser observation. |
| SYN-C04 transcription deployment failure | Patches `925f172835f43dfff966d79a7e1b3145b0ba1097` and `1d863f53a64b9275a90812ba8ccfa733818b11e5` independently retrieved. First adds upload fallback; later expands CSP connect-src to the API origin. | Priority candidate for a revision sequence. The implementation of two approaches is preserved; a failed first diagnosis and successful browser experiment remain narrated, not independently reproduced. Original failure and runtime outputs are absent. The first fallback may be useful independently, so its existence alone does not prove it was an AI error. |
| SYN-C05 database permissions | Imported source index and handoff inspected; packet contains only two Markdown documents and manifest. Remote tree at packet revision has no evident CSV/screenshot evidence files. | Reserve pending original before/after query exports and runtime evidence. A narrative that captures exist is not the captures themselves. Do not repeat the packet's blanket 'broke nothing' conclusion as a hub finding. Database was not accessed. |
| SYN-C02 test setup | Imported narrative describes an unsuccessful import attempt with no preserved intermediate artifact. | Reserve; weaker incremental comparative value while original error output is missing. No new code/test verification for this candidate. |
| SYN-C03 fingerprint test environment | Imported account describes a window stub in tests and browser behaviour not observed. | Reserve; do not adopt the title 'real bug' as proven product failure. Distinguish an environment dependency from incorrect behaviour in the intended browser. No new code/test verification for this candidate. |

Corrections to interpretation, without changing the imported archive:

- Its 'four candidates' heading actually lists five. These are candidates, not
  a selected dataset. The package's 'Keep' decisions are originating suggestions.
- C04 claims both commits have AI coauthor trailers; neither retrieved full
  commit message contains one. C01's retrieved message does contain an AI
  trailer. Do not use the C04 assertion as verified attribution.
- C05 says admin password correctness was never established, while V-06 later
  describes a successful login after rotation. Preserve that internal conflict;
  do not infer a failed or passed authentication check from this packet alone.
- Statements such as 'no CI run has ever failed' exceed the evidence of eight
  displayed runs. Screenshots and run IDs were not available in the hub, and
  the Actions execution history was not queried in this follow-up.

### AutoSRT: bounded implementation evidence exists

The API tree still resolves to `1739d828bce50af0eeec18cce441121b75da221b`, with
eight files and no dedicated test/CI/process-log artifacts in that snapshot.
The returned 12-commit history spans 14–22 June 2026 (UTC), starting with an
initial v1.2 release. This cannot recover development before that initial commit.
Missing chat history therefore limits process attribution, not all code analysis.

| New lead | Inspected change | Supported scope / missing evidence |
|---|---|---|
| AUTO-C01 model replacement memory lifecycle | `4ed927036b674de416141241e9ffece8da3cdf1d`: delete previous model reference, clear model/key and collect garbage before constructing replacement. | E1 evidence of changed loading order. Commit describes preventing low-VRAM exhaustion; no GPU measurement, failure log, runtime verification or original AI exchange obtained. Do not claim OOM eliminated or performance improved. |
| AUTO-C02 cancel while subtitle editor is open | Cancellation portion of `780728cc2c4e23a8878c81f91d49204397a0f376`: timed wait checks cancellation, queues editor closure, tracks active editor callback. Exclude validation/sanitization in same commit from this boundary. | E1 evidence of a cancellation mechanism. It still waits for the GUI closure acknowledgement; 'no deadlock' is not established by diff inspection. Original requirement, AI attribution, execution and user acceptance unknown. |

A third queue-card-height correction (`4d18fc8`) was found in commit metadata
but its patch was not inspected; it is not promoted to the checked shortlist.
No exact AI iteration count is recoverable from these commits alone.

### Scope recommendation to discuss with the supervisor

Retain SPARK as primary. Prioritize SYN-C01 and SYN-C04 for comparative source
assembly. AutoSRT can support a narrower implementation/history comparison via
AUTO-C01 or AUTO-C02, provided the thesis explicitly separates it from
transcript-based process analysis. If the research question requires a complete
AI request–response–correction sequence in every case, AutoSRT does not yet meet
that threshold; propose reducing its role or using two core cases. This is an
AI recommendation, not an approved redesign or a final episode count.

Next useful requests, only if these claims are needed: original SynCinema
browser/CSP output or permission-check record; C05 query exports if selecting
that reserve case. No request to recover all lost AutoSRT conversations. A new
prospective check could test current behaviour, but must receive its new date
and cannot establish historical AI authorship or the original outcome.
