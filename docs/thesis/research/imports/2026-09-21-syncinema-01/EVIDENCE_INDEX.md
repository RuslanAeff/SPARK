# SynCinema — Evidence Index

Inventory of sources examined for the thesis comparison, and the candidate
development events they support. Prepared 2026-09-20 (times UTC; repository
commits carry local offset +02:00).

Repository: SynCinema (`main`), review commit `73d62dc`, working tree clean.

Evidence levels used here follow the hub's provisional scheme (E0 narrative,
E1 code/config change, E2 automated verification, E3 real runtime/device
observation, E4 scoped human acceptance or release). They are recorded per
claim, not aggregated into a score. The scheme itself is not settled.

---

## 1. Sources examined

| ID | Path (relative) | Kind | Event date | Examined | Supports | Does not support / limits |
|---|---|---|---|---|---|---|
| S-01 | `Planner-docs/Planing-Ledger.md` | Retrospective + contemporaneous run ledger | Entries dated 2026-07-22; file added to git 2026-07-22 (`f4cc9e4`) | 2026-09-20 | Run-by-run record of AI-assisted phases, per-sub-phase status, explicit blockers and follow-ups | Written by the AI-assisted process it describes. Status words like `verified` do **not** all mean runtime verification — see S-01a. Not independently audited. |
| S-01a | `Planner-docs/Planing-Ledger.md` line 38 (Faz2.4 row) | Self-reported verification detail | 2026-07-22 | 2026-09-20 | That Faz2.4 was closed by **code trace**, not a live browser test: "no browser automation available in this environment … substituted a full code-trace … instead of a live browser test"; "pending live browser confirmation by the user" | Directly contradicts reading the row's `verified` label as E3. Any claim of live browser behaviour for the microphone gate. |
| S-02 | `Planner-docs/Autopsy.md` | Pre-work defect inventory | Added 2026-07-22 | 2026-09-20 | Origin of the microphone finding (`AUTOPSY-P2-01`), with file/line pointers | Authorship of the analysis is not stated inside the file itself. |
| S-03 | `Planner-docs/Faz-2-Plans/Faz2.4-microphone-permission-gesture-gate.md` | Task sub-plan (pre-implementation) | Added 2026-07-22 | 2026-09-20 | The stated requirement, scope limits, and a named manual check (`VAL-MANUAL-PERMISSION-GATE`) | Whether that manual check was ever executed. |
| S-04 | `Planner-docs/Main-Planing.md`, `Sub-Planing-Index.md`, `Sub-Planing-Audit.md`, `Project-Ontology.md`, `Faz-1..7-Plans/` | Planning corpus | Added 2026-07-22 | 2026-09-20 (index level; **not read in full**) | Existence and shape of a structured AI planning workflow | Contents not exhaustively read. Treat as partially examined. |
| S-05 | Git history, 108 commits, 2025-12-25 → 2026-09-20 | Primary VCS record | spans | 2026-09-20 | Dates, diffs, commit messages, before/after states | All 108 commits have a single author identity, so authorship alone never separates AI-assisted from hand-written work. |
| S-06 | Git trailers: 16 commits carry `Co-Authored-By` | Primary VCS record | 2026-05-30 (4), 2026-07-22 (11), 2026-09-20 (3, this session) | 2026-09-20 | The only machine-readable AI attribution in the repo | Covers 16 of 108 commits. Absence of a trailer is **not** evidence of absence of AI involvement. |
| S-07 | `.github/workflows/ci.yml` | CI configuration | in tree at review | 2026-09-20 | That CI is configured to run `typecheck` → `lint` → `test` → `build` on push to `main` and on PRs | Whether any run ever passed — answered separately by S-13, not by this file. Configuration is not execution. |
| S-08 | `vite.config.ts` lines 2–3 | Config | current | 2026-09-20 | The import split (`loadEnv` from `vite`, `defineConfig` from `vitest/config`) that S-01 says was reached after a failed first attempt | The failed first attempt itself. No artifact of it survives in git. |
| S-09 | `src/utils/fileFingerprint.test.ts` lines 5–14 vs `src/utils/fileFingerprint.ts` lines 52, 88 | Source + test | test added 2026-07-22 (`d0e642e`) | 2026-09-20 | That a `window` stub was placed in the **test**, and the source still calls `window.location.origin` — the workaround was not applied to the source | That the underlying browser-path behaviour was ever checked in a browser. |
| S-10 | `src/hooks/useAudioTracks.ts` lines 43–52 | Source | changed 2026-07-22 (`75d06fc`) | 2026-09-20 | That the mount-time `refreshDevices()` call was removed and replaced by an explanatory comment | Runtime behaviour of the permission prompt. |
| S-11 | `supabase/README.md`, `supabase/migrations/0000`–`0004` | Server-side definitions + captured state | 0000–0002 added 2026-07-22; 0003–0004 added 2026-09-20 | 2026-09-20 | Captured DB state and the reasoning for each change | 0003/0004 were authored from SQL output pasted into a chat session. Their state descriptions were **subsequently confirmed by the fuller capture in S-15**, which matches them. Still unverifiable from inside this repository alone. |
| S-13 | CI run history, repository Actions tab (`workflows/ci.yml`) | Platform-held execution record, external to the repo | runs dated 2026-07-22 (x4), 2026-08-26 (x2), 2026-09-20 (x2) | 2026-09-21, via author-supplied screenshots | That CI has executed and passed: **8 runs, 8 green, 0 failed**. Earliest: run #1, commit `5c0768f`, 2026-07-22 03:28 GMT+2, 35s. A run detail page shows a Vitest report of 7 files / 56 tests, all passing. | Screenshots are author-supplied, not fetched independently this session. Run-to-commit mapping beyond what is printed on screen is inference. Annotation panel showed 11 warnings, which GitHub truncates, so it does not contradict S-01's "22 warnings". |
| S-14 | Author's manual browser check of the microphone gate | Real-time observation, reported by the author | performed 2026-09-20 | 2026-09-21, as reported | That the four-step protocol produced its expected outcome: no prompt on load; warning and "İzin Ver" button present; prompt appears only on button press; devices populate after granting. Chrome 153.0.8010.53 (64-bit), Windows 11 and macOS 26.6.2. | **Self-reported by the thesis author**, who is also the developer under study. Not independently witnessed, no artefact (screenshot/recording) retained. Ran ~2 months after the change it validates. |
| S-15 | Live capture of `pg_policy` + `information_schema.role_table_grants` for the five project tables, taken **before** any hardening was applied | Point-in-time state of the running database | captured 2026-09-21; state unchanged since the ad-hoc queries of 2026-09-20 | 2026-09-21 | The pre-fix state, in full: **73 rows — 70 grants and 3 policies**. Grants are uniform: each of `sync_presets`, `vote_log`, `admin_config`, `login_attempts`, `admin_login_attempts` carries all seven privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) for **both** `anon` and `authenticated`. Policies: `sync_presets \| Allow anonymous insert \| cmd=a`, `sync_presets \| Allow anonymous read \| cmd=r`, `vote_log \| Allow anonymous insert on vote_log \| cmd=a`. | Query output supplied by the author; the reviewer holds no database access and did not run it. The author retained a CSV export. No server-side log corroborates the capture time. |
| S-16 | Same capture query re-run **after** applying migrations `0003` and `0004` | Point-in-time state of the running database | captured 2026-09-21, immediately after the apply | 2026-09-21 | The post-fix state: **3 rows.** `sync_presets \| anon \| SELECT`, `sync_presets \| authenticated \| SELECT`, and the single policy `sync_presets \| Allow anonymous read \| cmd=r`. Both anonymous-insert policies are gone; every write grant on all five tables is gone. Read access to community presets — the feature — is retained. | Supplied by the author, as with S-15. Proves the permission state changed; does **not** by itself prove the application still works, which is a separate check. |
| S-12 | `docs/WHITEPAPER.md`, `docs/WHITEPAPER_TR.md` | Project narrative | added before review | 2026-09-20 (existence only; **not read**) | — | Not examined. Listed so the gap is explicit. |

### Searched and not found

- `AGENTS.md`, `CLAUDE.md` at the SynCinema repo root: **absent** at `73d62dc`. (A `CLAUDE.md` exists in sibling project folders, so its absence here is specific to this repo.)
- Any per-session AI transcript stored inside this repository: **none found**. Private chat stores were deliberately not scanned.
- CI run history: not obtainable from this machine (`gh` CLI unavailable or unauthenticated). Supplied instead by the author as screenshots on 2026-09-21 — see S-13.

### Hub access

Central SPARK thesis files (`docs/thesis/README.md`, `RESEARCH_LOG.md`,
`research/COORDINATION.md`, `research/PROJECT_HANDOFF_TEMPLATE.md`):
**NOT_ACCESSIBLE** from this session. A sibling folder named for a SPARK backup
exists but contains no `docs/thesis/` directory; it was not explored further. No
hub file was read, and no hub-level or cross-project methodology decision is made
here. The task prompt was used as temporary context only.

---

## 2. Candidate development events

Four candidates are proposed. This is not a quota; they are the events where the
repository itself carries enough to reason about. Each is a request →
implementation → correction → verification arc, not a single commit.

### SYN-C01 — Microphone permission taken off page load

| Field | Content |
|---|---|
| Scope | Removing the mount-time device-permission request; excludes the surrounding device-enumeration design, which the sub-plan explicitly kept. |
| First stated need | `Autopsy.md` `AUTOPSY-P2-01`; expanded in `Faz-2-Plans/Faz2.4-…md` (S-02, S-03). |
| Proven AI authorship | UNKNOWN for the code edit. The planning corpus is labelled as AI-produced in `f4cc9e4` ("ClaudeQB planning artifacts"), and `75d06fc` carries a `Co-Authored-By` trailer, but neither pins the individual line change. |
| Human decision | Sub-plan records an explicit scope limit (trigger point moves; internal logic untouched). Decision-maker not separable from the AI narrative in the source. |
| Before → after | `useAudioTracks.ts`: `refreshDevices();` removed from the mount `useEffect`, replaced by a comment; `devicechange` listener kept (S-10, commit `75d06fc`). |
| Attempts / corrections | Sub-plan step F2.4-03 records that no new wiring was needed — an already-wired "Grant Permission" button existed and had been made redundant by the mount-time call. |
| Automated test | NONE targets this behaviour. S-01 itself states unit tests cannot replace a real prompt check. |
| Runtime observation | **E3, obtained 2026-09-20** (S-14). Four-step protocol on a permission-cleared profile: no prompt on load; warning + button shown; prompt only on button press; devices populate after granting. Chrome 153.0.8010.53, Windows 11 and macOS 26.6.2. Self-reported, no artefact retained. |
| Human acceptance | The pending live confirmation named in S-01a was performed on 2026-09-20 — roughly two months after the 2026-07-22 change it validates. |
| Missing evidence | No independent witness or retained artefact for the E3 check; the observer is the author. The two-month gap between change and observation is itself unexplained by any source. |
| Alternative explanations | The button may have been reachable before the change in some flows; the ledger says it was redundant, not absent. |
| Value for SPARK comparison | A clean case where the top-level status word (`verified`) and the actual evidence level diverged — and where the gap was later closed by a real observation, two months on. Useful both for testing whether classification rules catch such a divergence and for measuring how long one can persist unnoticed. |
| Keep? | **Keep.** Strongest documented request→change→acknowledged-gap arc in the repo. |

### SYN-C02 — Test runner bootstrap, with a first attempt that failed

| Field | Content |
|---|---|
| Scope | Introducing Vitest and wiring `npm test` into CI. |
| First stated need | Roadmap Phase 4 / `Faz-4-Plans/Faz4.1-test-runner-bootstrap.md` (S-04). |
| Proven AI authorship | UNKNOWN per-line; `d0e642e` carries a `Co-Authored-By` trailer. |
| Human decision | S-01 records the Phase-4 commit was made "at the user's explicit request", and flags Vitest timing as needing human confirmation. |
| Before → after | `vite.config.ts` now imports `loadEnv` from `vite` and `defineConfig` from `vitest/config` separately (S-08). |
| Attempts / corrections | S-01 states the first attempt imported both from `vitest/config` and "failed with a real startup error, caught and fixed". |
| Automated test | Suite exists and passes today (V-01). |
| Runtime observation | N/A. |
| Human acceptance | UNKNOWN. |
| Missing evidence | **The failure leaves no artifact.** It was corrected before the commit, so only the narrative attests to it. Git cannot corroborate it. |
| Alternative explanations | The import split is also simply the correct documented usage; arriving at it does not by itself prove a failed attempt happened. |
| Value for SPARK comparison | A test of whether the coding scheme can handle a documented failure whose only evidence is E0 — and whether that should count at all. |
| Keep? | **Keep, with the evidence gap stated in the same breath.** |

### SYN-C03 — A real bug found while writing tests, and deliberately not fixed

| Field | Content |
|---|---|
| Scope | `getVideoFingerprint`'s Google-Drive branch under a Node test environment. |
| First stated need | `Faz-4-Plans/Faz4.2-…` test-coverage task (S-04). |
| Proven AI authorship | UNKNOWN per-line; part of `d0e642e` (S-06). |
| Human decision | Scope boundary recorded in S-01: Faz4.2 was test-writing, not bug-fixing. |
| Before → after | Stub added to the **test file**; `fileFingerprint.ts` lines 52 and 88 still call `window.location.origin` (S-09). |
| Attempts / corrections | S-01 records the problem was reproduced in plain Node first, before any test was written; the source's own `try/catch` had been swallowing the error silently. |
| Automated test | Yes — the divergence between the two fingerprint functions was pinned with an explicit test rather than assumed (S-01, S-09). Passing today (V-01). |
| Runtime observation | **NOT_OBSERVED** in a browser. The claim that the source path "works correctly in the actual browser" is narrative only. |
| Human acceptance | UNKNOWN. |
| Missing evidence | Browser confirmation that the un-fixed source path behaves as claimed. |
| Alternative explanations | The stub could mask a genuine defect rather than an environment artefact; nothing in the repo settles this. |
| Value for SPARK comparison | Separates "defect found" from "defect fixed" — and shows a scope boundary being held rather than quietly crossed. |
| Keep? | **Keep.** |

### SYN-C04 — A wrong diagnosis, preserved, then corrected with a measured check

| Field | Content |
|---|---|
| Scope | Browser requests to the transcription API failing after deployment. |
| First stated need | A deployed-only failure reported by the user during the 2026-09-20 session. |
| Proven AI authorship | Commits `925f172` and `1d863f5` both carry `Co-Authored-By` trailers (S-06). |
| Human decision | The user declined one proposed change and chose the approach before it was applied (recorded in session, **not** in the repo). |
| Before → after | `925f172` added an upload fallback on the hypothesis that a CORS response header was unreadable. `1d863f5` then changed `vercel.json`'s `connect-src`, which was the actual cause. |
| Attempts / corrections | **The repository preserves the incorrect intermediate hypothesis as its own commit** rather than squashing it away. |
| Automated test | Unit tests cover the parsing/redaction helpers, not the policy. |
| Runtime observation | E3 — the production build was served under both the old and the new policy in a real browser; the old raised `connect-src blocked …` and the fetch threw, the new let the request reach the API. Method described in `1d863f5`'s message; the run itself is not stored as a repo artifact. |
| Human acceptance | UNKNOWN beyond the user electing to deploy. |
| Missing evidence | The session transcript is not in the repo. Commit messages are post-hoc narrative written with AI assistance, so they are E0 about their own process even where they describe an E3 check. |
| Alternative explanations | The fallback in `925f172` may have been independently useful; its commit message frames it as a fix for a cause that turned out to be wrong. |
| Value for SPARK comparison | Rare: a *recorded wrong turn*. Most histories hide these. Useful for "documented error" vs "missing instruction" criteria. |
| Keep? | **Keep.** |

### SYN-C05 — A live misconfiguration found, captured, fixed and re-checked

Added on 2026-09-21. This was **held back on 2026-09-20** on the grounds that its
evidence existed only as chat narrative. That reason no longer holds: the state
was captured before and after the change, and every affected path was exercised
afterwards. Recording the reversal here rather than quietly promoting it.

| Field | Content |
|---|---|
| Scope | Database permissions on the five project tables; excludes the application-side security work in the same session. |
| First stated need | A security review requested by the author. The request itself lives in a session transcript, **not** in the repository. |
| Proven AI authorship | Migrations `0003`/`0004` carry `Co-Authored-By` trailers. The SQL is short enough that authorship is not really in question; the analysis behind it is the AI contribution. |
| Human decision | The author declined one proposed change outright before it was applied, then chose among stated options. Recorded only in the transcript. The author also ran every database statement personally — nothing was applied by the AI. |
| Before → after | S-15 (73 rows: all seven privileges on five tables for two roles, plus two anonymous-insert policies) → S-16 (3 rows: `SELECT` on `sync_presets` for both roles, and the read policy). |
| Attempts / corrections | The order was chosen so the evidence would survive: capture, then apply, then re-capture. An earlier finding in the same session was diagnosed wrongly first (see `SYN-C04`), which is why the capture-first order was insisted on here. |
| Automated test | Not applicable — the suite does not reach database permissions. |
| Runtime observation | **E3, V-06.** All three `SECURITY DEFINER` write paths exercised against the deployed app after the change; three cross-checking numbers agree. |
| Human acceptance | The author applied the migrations to their own production database and confirmed the application still works. Scope of acceptance: functional, not a security sign-off. |
| Missing evidence | The originating request and the decision points are transcript-only. Password correctness for the admin path was never established and is out of scope. No independent party reviewed the finding. |
| Alternative explanations | The insert policy may have been deliberate at the time it was created; nothing records why it existed. "Over-permissive" is the reviewer's reading, not a documented intent. |
| Value for SPARK comparison | The best-evidenced arc in this repository, and the only one with a genuine before/after on a live system. Also a test case for whether the scheme can handle an event whose *trigger* is transcript-only but whose *outcome* is fully documented. |
| Keep? | **Keep.** |

### Considered and not proposed

- Nothing further at this time. Feature work generally (mobile overhaul, subtitle
  studio, player quality) remains large and well-committed, but without a stated
  need recorded separately from the commit message, the request→implementation arc
  cannot be reconstructed from the repository alone.
- **Feature work generally** (mobile overhaul, subtitle studio, player quality).
  Large and well-committed, but without a stated-need source separate from the
  commit message, the request→implementation arc cannot be reconstructed from the
  repo alone.

---

## 3. Verification performed in this review

| ID | Command | Date (UTC) | Commit | Environment | Result | Limit |
|---|---|---|---|---|---|---|
| V-01 | `npm test` | 2026-09-20 21:21 | `73d62dc`, tree clean | Windows 11 (win32, MINGW64_NT-10.0-22621), Node v24.12.0, npm 11.13.0 | 11 files, 146 tests, all passed (Vitest 4.1.10) | Proves the suite passes **today at this commit only**. Says nothing about any past state, and nothing about untested behaviour (notably SYN-C01). |
| V-02 | `gh run list` (attempted) | 2026-09-20 21:20 | `73d62dc` | as above | **NOT_RUN** — `gh` unavailable or unauthenticated | Superseded by V-05, which used author-supplied screenshots instead. |
| V-03 | Application runtime behaviour, by this reviewer | — | — | — | **NOT_OBSERVED** | No application was launched by the reviewer. The E3 evidence in V-04 was produced by the author, not here. |
| V-04 | Manual microphone-gate protocol, four steps, on a permission-cleared profile | performed 2026-09-20, reported 2026-09-21 | deployed build; exact commit not recorded by the observer | Chrome 153.0.8010.53 (64-bit); Windows 11 and macOS 26.6.2 | All four steps matched their expected outcome (no prompt on load → warning + button present → prompt on press → devices populate) | **Self-reported by the author**, who is the developer under study. No screenshot or recording retained. The deployed commit under test was not recorded, so the observation is tied to a date, not to a revision. |
| V-05 | Review of CI run history in the platform's web UI | 2026-09-21, via author-supplied screenshots | covers runs at `5c0768f`, `2b5eeee`, `7696a7c`, `f4cc9e4`, `3145ffa`, `710ea56`, `73d62dc`, `605993a` | — | **8 runs, 8 green, 0 failed.** Earliest run #1 at `5c0768f`, 2026-07-22 03:28 GMT+2, 35s. One run detail page shows Vitest 7 files / 56 tests passing. | Screenshots were not independently fetched. Only what is legible on screen is recorded; anything further is marked as inference below. |

| V-06 | Post-migration functional check of all three SECURITY DEFINER write paths, against the deployed app and the live database | 2026-09-20/21 (DB timestamps in UTC) | migrations `0003`+`0004` applied; app at `605993a` | Chrome, deployed build | **All three paths work with `anon` holding zero privileges on the tables they write to.** (a) Insert: a preset row exists — `offset_ms` 700, matching the 0.7s set in the UI, created 2026-09-20 22:43:49 UTC. (b) Vote: `vote_log` holds exactly 1 row after two attempts, and the preset's `votes` reads 2 — the second vote was refused by the dedup, which is correct. (c) Admin: after the password was rotated on 2026-09-21, login succeeded and the panel loaded the preset list, showing the same `+700ms` and `2` votes the SQL query returned — the same record confirmed a third time, by a third route. | The admin path took two passes. The first attempt returned false, which is ambiguous — the function returns false both for a wrong password and for an unreadable hash. It was resolved by confirming the hash row was intact (60 chars, `$2a$`) and that a `login_attempts` row had been written at 2026-09-20 22:52:53 UTC, proving the function ran despite `REVOKE ALL`. The password had simply been lost; after rotation the full path was exercised end to end. Preset identifiers are deliberately not reproduced here. |

### What V-06 settles

Revoking every write privilege from `anon` and `authenticated` on all five tables
broke nothing. Each write still lands, because each goes through a
`SECURITY DEFINER` function that runs as the table owner. The three numbers
cross-check: one preset at 700 ms, `votes` = 2, one `vote_log` row. An inconsistent
set would have shown a path silently failing; these agree.

This is the review's strongest evidence of any kind — a change applied to a live
system, with state captured before and after, and every affected path exercised
afterwards. It is also the one place where an ambiguous result was pursued instead
of accepted: "wrong password" was not treated as a verdict until the attempt log
showed the function had actually run, and the path was only closed once a rotated
password let the panel load real data.

The preset record was ultimately confirmed three times by three independent
routes — a direct SQL query, the `vote_log` row count, and the admin panel's own
listing — all agreeing on 700 ms and 2 votes. Agreement across routes is what
makes this stronger than any single observation.

### What V-05 corroborates

S-01's Faz4.1 row claims live CI verification "confirmed live 2026-07-22 … commit
`5c0768f`, green check, 35s". The run list shows commit `5c0768f`, 2026-07-22,
green, 35s. **Commit, date, duration and outcome all match.** This is the first
case in this review where a self-reported claim from the AI-assisted ledger is
confirmed by a record held outside the repository and outside the process that
wrote it. It raises confidence in S-01 generally without making S-01
self-verifying.

Two further observations, marked as inference rather than fact:

- A run detail page shows 56 tests passing, and S-01's Faz6.1 row claims "test
  (56/56, +3 new)" at the phase5-6 commit. Consistent, though the screenshot does
  not print which run number it belongs to.
- 108 commits produced only 8 runs, and no run exists for `633c9b4`, `75d06fc`,
  `5d496a1` or `d0e642e`. S-01 states those four were committed locally and never
  pushed at the time. A push carries one run for its head commit, so the absence
  of runs for exactly those four commits fits S-01's account. Fits is not proves.

**No CI run has ever failed.** Whether that reflects effective local gating before
push, or simply that little was pushed, is not settled by the run history alone.

Commands were read-only except `npm test`, which writes nothing tracked. No
application code, dependency, lockfile or user data was modified.
