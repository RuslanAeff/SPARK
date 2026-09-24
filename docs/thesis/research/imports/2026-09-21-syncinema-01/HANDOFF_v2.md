# Handoff — SynCinema evidence review

| Field | Value |
|---|---|
| Package ID | `2026-09-20-syncinema-01` |
| Version | 2 (revised 2026-09-21 after the author answered both open questions and completed the Supabase work) |
| Prepared | 2026-09-20, ~21:20–21:30 UTC (repository commits carry local offset +02:00) |
| Project | SynCinema — secondary comparison project |
| Review commit | `73d62dc` (`fix(supabase): shut the side doors into vote_log and the admin tables`, 2026-09-20) |
| Working tree | Clean. `main` level with `origin/main`. No dirty or untracked files at review time. |
| History | Full, 108 commits, 2025-12-25 → 2026-09-20. Not a shallow clone. |
| Hub record read | **NOT_ACCESSIBLE** — no hub file was read |
| Handoff state | **READY_FOR_REVIEW** |
| Hub import state | **NOT_IMPORTED** |

Preparing this package does not mean it has been transferred to the SPARK hub or
validated there.

---

## 1. Hub access

No central SPARK `docs/thesis/` directory was reachable. A sibling folder named
for a SPARK backup exists on this machine but contains no `docs/thesis/`; it was
not explored beyond that single check. `README.md`, `RESEARCH_LOG.md`,
`COORDINATION.md`, `PROJECT_HANDOFF_TEMPLATE.md` and `METHOD_DECISIONS_DRAFT.md`
were **not read**. The task prompt was used as temporary context.

Consequence: this package follows the prompt's described conventions but cannot
confirm them against the hub. Nothing here should be taken as agreeing with, or
amending, hub methodology. Candidate IDs follow the `SYN-Cxx` pattern named in
the prompt; if the hub already assigns IDs differently, these should be remapped
rather than duplicated.

## 2. Scope

**Examined:** git history and diffs; `Planner-docs/Planing-Ledger.md` (targeted
reading around the traced items); `Autopsy.md` (targeted); `Faz2.4` and `Faz4.1`
/ `Faz4.2` ledger rows; `.github/workflows/ci.yml`; `vite.config.ts`;
`src/hooks/useAudioTracks.ts`; `src/utils/fileFingerprint.ts` and its test;
`supabase/` migrations and README; test file inventory; repo root for instruction
files.

**Explicitly out of scope or not examined:** the bulk of `Planner-docs/`
(surveyed at index level only — **not** fully read); `docs/WHITEPAPER.md` and
`_TR.md`; the AutoSRT project, which exists as a sibling folder but was not
reviewed; private chat stores, which were not scanned.

**Searched and not found:** `AGENTS.md` / `CLAUDE.md` at this repo's root; any
AI transcript committed inside this repository. CI run history was not obtainable
from this machine and was supplied by the author as screenshots instead.

Full inventory with per-source limits: [`../EVIDENCE_INDEX.md`](../EVIDENCE_INDEX.md).

## 3. Candidates

Four are proposed. No quota was filled; these are the arcs the repository can
actually support. Full fields for each are in the evidence index.

| ID | Title | Strongest evidence | Weakest point |
|---|---|---|---|
| `SYN-C01` | Microphone permission taken off page load | E1 + **E3 obtained 2026-09-20** — one-line removal traced to `75d06fc`, with a stated need predating it, and a four-step browser check that behaved as specified | The observer is the author, and nothing was retained. The check came ~2 months after the change, during which the ledger row read `verified` on the strength of a code trace alone. |
| `SYN-C02` | Test-runner bootstrap whose first attempt failed | E1 — the corrected import split is in `vite.config.ts` today | The failure left **no artifact**; it was fixed before the commit. Narrative only. |
| `SYN-C03` | A real bug found while writing tests, deliberately not fixed | E1 + E2 — stub in the test, source unchanged, suite passes | The claim that the un-fixed source path works in a browser is narrative only. |
| `SYN-C04` | A wrong diagnosis preserved, then corrected by measurement | E1 across two commits (`925f172`, `1d863f5`); an E3 browser check is described in the later commit message | The session transcript is not a repo artifact, and the commit messages are AI-assisted post-hoc narrative about their own process. |

| `SYN-C05` | A live misconfiguration found, captured, fixed and re-checked | **Strongest in the review.** State captured before (73 rows) and after (3 rows); all three affected write paths exercised afterwards, with three cross-checking numbers | The originating request and every decision point are transcript-only. No independent party reviewed the finding. |

`SYN-C05` was **held back in version 1** on the grounds that its evidence was
chat-only. Capturing the state before applying the fix removed that objection, so
the decision was reversed rather than left standing. The reversal is recorded in
the evidence index rather than made silently.

## 4. Checks run

| ID | Command | Result |
|---|---|---|
| V-01 | `npm test` at `73d62dc`, 2026-09-20 21:21 UTC, Windows 11 (win32), Node v24.12.0, npm 11.13.0 | 11 files, 146 tests, all passed (Vitest 4.1.10). Proves today's state at this commit only — not any past state, and nothing about untested behaviour. |
| V-02 | `gh run list` | **NOT_RUN** — `gh` unavailable or unauthenticated. CI run history unverified. |
| V-03 | Application runtime, by the reviewer | **NOT_OBSERVED** — the reviewer launched nothing. |
| V-04 | Microphone-gate protocol, four steps | **Expected outcome on all four**, Chrome 153.0.8010.53, Windows 11 and macOS 26.6.2, 2026-09-20. Self-reported by the author; no artefact retained. |
| V-05 | CI run history | **8 runs, 8 green, 0 failed.** Earliest at `5c0768f`, 2026-07-22 03:28 GMT+2, 35s — matching the ledger's claim on commit, date, duration and outcome. |
| V-06 | Post-migration functional check | **All three SECURITY DEFINER write paths work** with `anon` holding zero privileges. Three cross-checking numbers: preset at 700 ms, `votes` = 2, one `vote_log` row. |

All other commands were read-only. No application code, dependency, lockfile or
user data was touched.

## 5. Human decisions vs AI suggestions

What the repository can separate:

- **All 108 commits carry a single author identity.** Git authorship alone never
  distinguishes AI-assisted from hand-written work in this project.
- **16 commits carry a `Co-Authored-By` trailer** (4 on 2026-05-30, 11 on
  2026-07-22, 3 on 2026-09-20). This is the only machine-readable AI attribution
  present. Its absence on the other 92 commits is **not** evidence that AI was
  uninvolved.
- **`f4cc9e4` labels the planning corpus as AI-produced** ("ClaudeQB planning
  artifacts"), which attributes the *planning documents* — not individual code
  lines.

What it cannot separate, and should not be presented as separating:

- Which specific edits were drafted by AI versus written or rewritten by the
  author.
- Whether decisions recorded in the ledger as choices (for example, an explicit
  scope limit, or a deviation from a sub-plan's literal wording) originated with
  the author or with the AI and were then accepted.
- Human acceptance events: the ledger notes things like a Phase-4 commit made "at
  the user's explicit request" and a tool choice the user selected from options,
  but these are self-reported inside the same AI-assisted record, with no scope
  statement of what exactly was accepted.

For `SYN-C04`, the human declined one proposed change and selected the approach
before it was applied — but that exchange lives in a session transcript, not in
the repository, so it is unavailable as evidence here.

## 6. Open questions and missing evidence

1. ~~Was the cleared-permissions browser check performed?~~ **Answered 2026-09-21.**
   Performed 2026-09-20, all four steps as expected. `SYN-C01` now carries E3,
   with the caveats that the observer is the author and nothing was retained.
2. ~~Has any CI run ever completed successfully?~~ **Answered 2026-09-21.** Eight
   runs, all green; the earliest corroborates the ledger exactly.
3. Does the un-fixed `window.location.origin` path in `fileFingerprint.ts` behave
   in a browser as the notes assert?
4. Should the 2026-09-20 session's own work be admissible, given its transcript
   is not a repository artifact? This is a hub-level policy question, deliberately
   not decided here.
5. Are session transcripts from the earlier phases (notably the 2026-07-22 runs)
   retained anywhere the author can supply? They would materially change what can
   be said about `SYN-C02`'s failure, which currently has no artifact at all.
6. How much further into `Planner-docs/` is worth reading? It was surveyed at
   index level and must not be described as fully examined.

## 7. Next concrete step

Nothing is outstanding inside this repository. Both questions raised in version 1
were answered on 2026-09-21 and the levels were revised accordingly.

What remains is hub-side and predates this review: classification criteria for the
four terms the supervisor asked about, the independent-rater arrangement, and
scope. None are decided here. The hub should also decide whether an AutoSRT pass
is commissioned — that project sits beside this one on the same machine and has
not been reviewed — and whether transcript-only evidence is admissible at all,
which affects `SYN-C02`, `SYN-C04` and `SYN-C05`.

## 8. Files created or modified

Created (documentation only — no application code changed):

- `docs/thesis/README.md`
- `docs/thesis/research/PROJECT_LOG.md`
- `docs/thesis/research/EVIDENCE_INDEX.md`
- `docs/thesis/research/handoffs/2026-09-20-syncinema-01.md` (this file)

Modified on 2026-09-21:

- `supabase/README.md` — records that migrations `0003` and `0004` were applied
  live, with the before/after row counts.

`Planner-docs/` was read and linked, never edited or copied. No application code,
dependency, lockfile or configuration was changed by this review. The database
changes were applied by the author, not by the reviewer.
