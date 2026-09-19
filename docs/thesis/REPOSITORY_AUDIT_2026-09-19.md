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
