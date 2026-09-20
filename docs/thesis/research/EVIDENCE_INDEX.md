# SPARK evidence index

Opened: **2026-09-19**, Europe/Warsaw. Scope: the SPARK repository only. This is the local project evidence index described in [COORDINATION.md](COORDINATION.md); global thesis decisions stay in [RESEARCH_LOG.md](../RESEARCH_LOG.md) and are not restated here.

Observation base: commit `25ef86cb0bfa8f9030d5d51bf5e0426cd7aafd30` plus 58 uncommitted working-tree paths (modified and untracked) present on 2026-09-19. Uncommitted material is evidence of the current state, not of the state at any historical commit.

**2026-09-20 interpretation update:** the dates below describe the inspected Git history. The selected structured process documents were first committed on 2026-08-01; this is not the beginning of all documentation, since older product records exist. The first recorded commit is not proof of the first day of development. The original counts below remain tied to the 2026-09-19 observation base. Current records are included in the later commit `7af72b3`, and this file now lives under `research/`.

**What this index is not.** It is not a selected thesis dataset, not a claim that any listed source is accurate, and not evidence that a historical test, device check or human acceptance occurred. Entries record what exists and where, with the limit of each source.

## 1. Evidence classes present in this repository

| Class | Location | Earliest instance | Nature |
|---|---|---|---|
| Version history | Git history of this repository | commit `f72cdc8`, 2026-03-14 | Contemporaneous per commit. Commit messages summarise intent unevenly; 29 of 61 commits predate any process record. |
| Product/UX intent | `DESIGN_BRIEF.md` | 2026-04-21 (`37dca2e`) | Living document, repeatedly rewritten. A current sentence is not evidence of the intent held at an earlier date. |
| Legacy product record | `docs/history/DESIGN_BRIEF_LEGACY_2026-08-01.md` | archived 2026-08-01 | Byte-level archive of the pre-simplification brief, SHA-256 recorded in the history document. |
| Retrospective engineering history | `docs/history/ENGINEERING_HISTORY_2026.md` | 2026-08-01 (`a3e1299`) | **Retrospective by its own statement.** Compiled on 2026-08-01 from the legacy archive; it explicitly says individual decision dates and originating commit SHAs could not be reliably mapped. |
| Architecture decisions | `docs/decisions/ADR-001` … `ADR-012` | 2026-08-01 (`a3e1299`) | ADR-001..010 committed; ADR-011 and ADR-012 are untracked working-tree files dated 2026-09-16 in content. |
| AI session records | `docs/evidence/AI_COLLABORATION_LOG.md` | 2026-08-01 (`a3e1299`) | Structured session summaries written by the assisting AI. States in its own header that it is **not a conversation transcript**. |
| Requirement–evidence matrix | `docs/evidence/TRACEABILITY.md` | 2026-08-01 (`a3e1299`) | Defines evidence levels E0–E4 and a retrospective-limitation rule; detailed rows exist mainly for 2026-09-15/16 work. |
| Security review and remediation | `docs/evidence/SECURITY_REVIEW_2026-09-16.md`, `SECURITY_REMEDIATION_2026-09-16.md`, `docs/evidence/security/2026-09-16/` | 2026-09-16 (file content dates; untracked) | Contains executed probe scripts and dependency-audit JSON — the most machine-checkable artifacts in the repository. |
| Automated tests | 134 `*.test.ts(x)` files under `src/` and `app/` | mixed | File presence shows a test exists now. It does not show the test ran, or passed, at any past commit. |
| CI configuration | `.github/workflows/ci.yml` | — | Configuration only. No Actions run log has been retrieved into this repository. |
| Thesis pilot artifacts | `docs/thesis/research/pilot/` | 2026-09-19 | New checks executed on 2026-09-19, dated as new evidence. |

## 2. The evidence boundary of 2026-08-01

This is the single most important structural fact for the thesis and it is directly observable, not inferred from recollection:

- Development activity in this repository begins **2026-03-14** and the latest commit is **2026-09-15**.
- Every process-evidence document — `AGENTS.md`, `docs/evidence/AI_COLLABORATION_LOG.md`, `docs/evidence/TRACEABILITY.md`, `docs/decisions/README.md`, `docs/history/ENGINEERING_HISTORY_2026.md` — enters the repository in the **same commit, `a3e1299`, dated 2026-08-01**.
- The earliest AI session record is `AI-2026-08-01-DOCS-001`; no session record carries a date before 2026-08-01.

Consequence: **29 commits (2026-03-14 → 2026-07-20) predate the selected structured process records**, and **32 commits (2026-08-01 → 2026-09-15) fall on or after their entry into version control**. Earlier code and product records can support their specific observable claims. Original prompts, attribution, iteration counts and acceptance require additional evidence; they must not be inferred from the absence or presence of a structured log. Recollection is retrospective evidence (E0), not a contemporaneous transcript or independently verified event sequence.

This boundary matches the student's report that logs were introduced after some development had happened. The report is now corroborated by commit dates; the extent of any *non-repository* records (chat archives on the student's machine or in a vendor account) has not been checked and is not claimed here to be empty.

## 3. AI session records — coverage and known defect

Distinct session identifiers found in `AI_COLLABORATION_LOG.md`: **66**. Of these, 51 appear in the summary index table (§3 of that file) and 58 appear as detailed entries (§4); the two lists are **not in sync**.

- 15 identifiers have a detailed entry but no index row (e.g. `AI-2026-08-13-SCANNER-VISUAL-REFINEMENT-001`, `AI-2026-08-21-IMMUTABLE-BUDGET-PERIODS-001`, `AI-2026-08-24-DASHBOARD-CASH-STATUS-001`).
- 8 identifiers have an index row but no detailed entry (e.g. `AI-2026-09-02-PRIVACY-POLICY-ACCURACY-001`, `AI-2026-09-06-DATA-RESET-001`).

Recorded date distribution of the index rows: 34 in August 2026, 17 in September 2026. Nothing earlier.

Interpretation limits:
- The log is written by the assisting AI. Its human-approval column is the AI's account of what the student asked; it is not a quoted human statement and is not independent confirmation.
- The file states it is not a transcript, so original prompts and AI responses are **not preserved in this repository**. Any episode requiring an AI-authorship claim needs a source outside this repository.
- Status wording in the log distinguishes automated checks from device acceptance: 22 index rows carry an explicit "cihaz kabulü bekleniyor" (device acceptance pending) status. This supports the separation of E2 from E3 — and shows that E3 evidence is largely absent rather than negative.

## 4. Device verification and human acceptance

`TRACEABILITY.md` defines `E3` (target-device verification: build identity + device/OS + scenario + result + artifact) and `E4` (human acceptance or release evidence). Searching the file, `E3` appears **only in the definition table and one explanatory sentence** — there is no completed E3 row. The security remediation table likewise closes every line with device/release acceptance left open.

Therefore, for this repository as of 2026-09-19: **automated-check evidence is plentiful, device-verification evidence is effectively absent, and explicit human acceptance is recorded only as prose inside AI-written session summaries.** These three must stay in separate columns in any thesis table.

## 5. Preserved AI conversations

Searched on 2026-09-19: repository root and `docs/` for transcript, conversation, chat or `.specstory`-style directories; `.claude/` in the repository (present but empty). **No original AI conversation archive was located in this repository.**

"Not located in this search" is not the same as "never existed". Unchecked locations include the student's local machine outside this repository, assistant-vendor account history, and any exported files not shared with this session. Whether such archives exist is an open question for the student, not a finding.

## 6. Candidate episode leads — not selected, not counted

Recorded so a later selection can start from sources rather than memory. No sample size is assumed; TD-005 remains PROPOSED in the hub.

| Lead ID | Bounded problem | Sources that exist | Evidence type reachable | Main gap |
|---|---|---|---|---|
| SPK-L01 | Failed API-key deletion reported as success (SEC-02) | [pilot P-001](pilot/SEC02_WORKED_EXAMPLE_DRAFT.md), baseline snapshot, `SECURITY_REVIEW/REMEDIATION_2026-09-16`, 2026-09-19 regression output | E1 + E2 (new), E0 for the narrative | Original authorship of the defective function UNKNOWN; no E3, no E4 |
| SPK-L02 | Android reminder scheduling for a closed app | `AI-2026-08-11-ANDROID-REMINDER-SCHEDULER-001` detailed entry, reminder services and tests | E1 + E2 | Physical APK behaviour explicitly pending; no preserved prompts |
| SPK-L03 | Receipt money precision and printed-total authority | `AI-2026-08-09-RECEIPT-MONEY-001`, `ADR-004`, related tests | E1 + E2 | Original defect provenance unestablished; device acceptance pending |
| SPK-L04 | Immutable budget periods / one active period per day | `AI-2026-08-21-IMMUTABLE-BUDGET-PERIODS-001` (detail-only entry), `ADR-008`, commit `02bca7c` (2026-09-05) | E1 + E2, plus a commit-linked change | Index/detail mismatch in the log; acceptance not separately recorded |
| SPK-L05 | Pre-2026-08 period, e.g. the 2026-06 receipt-reliability and i18n work | Commits only (`5865af8`, `0bee108`, `fc28125`) | E1 only | No contemporaneous process evidence at all; usable for code evolution, not for AI-attribution claims |

SPK-L05 is deliberately included: a case with only code evidence is what makes the evidence boundary in §2 visible in the thesis, and excluding it would bias the sample toward the documented period.

## 7. How to extend this index

Add a row only after inspecting the source. Record: what it is, its original date or `UNKNOWN`, the date you inspected it, whether it is contemporaneous / retrospective / newly executed, the single claim it supports, and its limit. Do not upgrade a claim's evidence level because a different claim in the same document is well supported.
