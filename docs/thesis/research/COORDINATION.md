# Thesis continuity across projects and AI sessions

Prepared: 2026-09-19; reorganised 2026-09-20, Europe/Warsaw. Version: 0.2.

This is a prepared working procedure responding to the student's request for continuity. It has been installed in the SPARK thesis workspace only. It does not establish that SynCinema or AutoSRT have been inspected or configured, that repositories are synchronized, or that the student/supervisor approved the proposed research methodology.

## One research record, separate project evidence

The current research hub is **SPARK / `docs/thesis/`**. It holds the research question, student decisions, proposed method, writing plan and cross-case synthesis. Keep this location until an explicit relocation is made; a future separate thesis repository is possible, but none has been created.

Each application retains its own source code, technical documentation, tests and project-specific evidence. A local project log reports what happened in that project; it must not become a competing copy of the thesis decision register.

| Information | Owner / canonical location |
|---|---|
| Thesis decisions, approvals, current stopping point | Hub: `RESEARCH_LOG.md` |
| Single English thesis manuscript | Hub: `THESIS.docx`; read current Word content before editing |
| Draft thesis method | Hub: `research/METHOD_DECISIONS_DRAFT.md` |
| Supporting English proposal | Hub: `research/PROPOSAL_WORKING_DRAFT.md`; not a parallel thesis |
| Writing sequence and figure guidance | Hub: `research/THESIS_ROADMAP.md` |
| Project implementation and historical changes | Each project's code and Git history |
| Project observations, evidence gaps and continuation | Each project's `docs/thesis/research/PROJECT_LOG.md`, or existing equivalent linked without duplication |
| Candidate episodes and sources | Each project's `docs/thesis/research/EVIDENCE_INDEX.md`, or existing equivalent |
| Transfer from a project session to the hub | A dated packet based on `PROJECT_HANDOFF_TEMPLATE.md` |

The student remains the decision-maker. “Coordinator” below means the AI or person currently maintaining the hub; it is a session role, not a permanent model identity.

## Current access and integration state

| Project | Role | Inspected in this thesis work? | State |
|---|---|---|---|
| SPARK | Primary longitudinal case; current hub | Repository-wide survey of record availability, plus selected sources | Provisional SEC-02 pilot and dated local evidence survey captured; not a complete per-episode audit. Earlier records are now in commit `7af72b3`; 2026-09-20 reorganisation/manuscript are uncommitted. Local tracking state was checked, not live remote state. |
| SynCinema | Proposed secondary comparative case | Initial remote inventory and selected ledger entries only | User supplied GitHub reference; an existing planning ledger can be reused. No local setup or project-agent packet imported. |
| AutoSRT | Proposed secondary comparative case | Initial remote inventory and README only | User supplied GitHub reference; deeper process evidence remains to be investigated. No local setup or project-agent packet imported. |

See [the initial inventory](REPOSITORY_AUDIT_2026-09-19.md) for versioned observations and their limits. Local paths/unpushed changes remain unknown.

Knowing a path does not grant an AI filesystem access. A session must actually have access to the workspace and permission to read/write the relevant location. A separate machine or browser chat needs the files provided through its available mechanism. Do not describe this procedure as automatic synchronization or guaranteed persistent model memory.

## Starting a hub session

1. Read the repository's applicable instructions and inspect `git status --short`. Preserve unrelated work.
2. Read `README.md`, the **current position and decision register** in `RESEARCH_LOG.md`, and the latest dated updates. Read older entries only as needed; early pending statuses are history, not the current decision.
3. Read this procedure and the relevant method/proposal sections. Do not load every transcript merely to start work.
4. State briefly what is accepted, what remains proposed and what concrete task follows. This lets the student correct a misunderstanding before it spreads.
5. Check any source whose contents or version the task depends on. A prior AI summary is a pointer, not a replacement for evidence.

## Starting a project session

1. Read that project's instructions and existing records before adding files. Do not replace an existing log just to match a filename.
2. Read the hub's current position and decision register if accessible. Record the hub version read: commit plus dirty state, or file SHA-256 when uncommitted. If only a supplied copy is accessible, record its date/hash and label it a snapshot.
3. If the hub is unavailable, use the supplied handoff brief as provisional context. Evidence collection can continue; global methodological decisions cannot be inferred from a possibly stale copy.
4. Create or extend a local project log and evidence index. Identify potential bounded episodes from real sources, without filling a quota or claiming they are finally selected.
5. End with a handoff packet. Source dates, observation dates, original prompts, AI authorship, tests and acceptance each need their own support; unknown values remain unknown.

The portable startup prompt is in [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md). The packet schema is in [PROJECT_HANDOFF_TEMPLATE.md](PROJECT_HANDOFF_TEMPLATE.md).

## Writing without competing versions

- Use **one active editor of the hub at a time**. Other sessions can work on their own project's evidence and produce packets. This is a coordination convention, not an implemented file lock.
- A project agent normally reads the hub and writes its local record. It proposes changes to thesis decisions through the packet rather than rewriting the central register.
- Switching from Codex to Claude or another assistant is allowed: finish or checkpoint the first session, then assign the next one the hub role. Re-read current files before changing them.
- If two sessions changed the same file, preserve both changes and reconcile against the actual decisions/evidence. Do not silently choose the newest timestamp or overwrite unresolved differences.
- At each meaningful milestone, update the current stopping point and append a dated record. Do not wait until the context window is almost exhausted. This reduces recovery loss; it cannot guarantee recovery of an unrecorded action after abrupt interruption.

## Importing a project packet

1. Identify the project, packet ID and supplied revision/hash. Check whether it is already in the import register below.
2. Compare its hub reference with the current register. A stale reference does not erase useful evidence; review any conflicting methodological assumption separately.
3. Verify source references actually available. Distinguish `RECEIVED_UNVERIFIED`, `PARTIALLY_CHECKED` and `CHECKED_FOR_STATED_SCOPE`; no packet receives blanket verification merely because another AI wrote it.
4. Preserve the received packet as a dated snapshot in the hub, then record which claims were checked, which remain uncertain and whether a student decision is needed. Avoid copying large raw archives unnecessarily.
5. Update the hub's source index/current position and add a dated log entry. A suggested label or decision remains proposed until accepted by the appropriate person.
6. Keep the original packet identity when corrected; record a new revision and why. Do not count the same episode twice because it was discussed by two assistants.

### Import register

No external project packets have been received as of 2026-09-19.

| Packet ID / revision | Project | Hub version read | Source version | Check status / scope | Imported on / log entry |
|---|---|---|---|---|---|
| — | — | — | — | No imports yet | — |

## Local files, Git and another computer

A local file is available to a session that can access that filesystem. It is not automatically available in a fresh Git clone. Only material included in an appropriate repository revision and transferred to that clone will be present there. Uncommitted thesis files need a deliberate transfer or version-control step before relying on another checkout.

The 2026-09-19 preparation task did not commit or push. At the next session's start, the earlier records were present in `7af72b3`, with local `main` and the stored `origin/main` reference aligned. The new 2026-09-20 changes are uncommitted. Before a future transfer, identify the exact files/revision and follow the user's authorization and repository rules. A repository transfer does not transfer unrecorded chat context.

For tool-neutral continuity, keep the detailed record in ordinary Markdown, put a short pointer in each tool's applicable project instructions, and explicitly ask the next session to read it. In SPARK, `CLAUDE.md` already points to `AGENTS.md`; the latter now points thesis work to this workspace. No equivalent setup is claimed for the other projects.

Codex-specific discovery was checked against [official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md) on 2026-09-19: it reads applicable `AGENTS.md` guidance at startup. That does not imply that every linked research file or another tool's configuration is loaded automatically. Have the session report the relevant files it actually read.

## Minimal checkpoint

Record: actual date; task and source versions; human decisions versus AI proposals; completed work; checks and their limitations; unresolved question; next concrete action; changed/uncommitted files relevant to the handoff; hub/packet synchronization state. Use the existing session template in the research log. Never invent an entry for a day when no work was recorded.
