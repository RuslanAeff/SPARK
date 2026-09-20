# Portable prompt for a new project/AI session

Prepared 2026-09-19; paths and manuscript entry point updated 2026-09-20. This is a portable starting brief, not a continuously synchronized copy of the central decision register. Read the latest hub files when accessible; if they conflict with this dated brief, preserve the discrepancy and check the dated student decisions. Do not treat this prompt itself as proof that any project setup or evidence audit was completed.

The student can paste the following prompt in a session opened in SynCinema or AutoSRT. If the hub is unavailable, provide its README, research log, method draft and relevant template as files/text. A path alone does not provide access.

```text
Help me prepare project evidence for my English master's thesis. Explain your work and any decisions to me in simple Turkish. I am new to research methods; define unfamiliar terms before asking me to decide.

CONTEXT AS OF 2026-09-19
I am studying MSc Computer Science at VIZJA University. My bachelor's degree was in Ecology at Baku State University. I completed approximately 7–8 months of full-stack development training at Code Academy in Baku. I have hobby HTML/CSS and some C# experience, limited backend experience, and no professional employment as a software developer. These are my self-reports, not a measured skill assessment. Experience dates relative to the projects remain to be mapped.

My supervisor is Marcin Kacprowicz. The approximate submission target is July 2027; exact date and weekly availability are unconfirmed. The thesis compares AI-assisted development of SPARK (primary case), SynCinema and AutoSRT (secondary cases).

The supervisor requested four improvements: address my bias as both developer and researcher with an explicit worked classification example/check; define my experience accurately; reduce the workload; and define observable rules for error, underspecified instructions, and minor/substantial rework.

ACCEPTED: use “student developer” with an accurate prior-experience profile; discuss in Turkish, write thesis/research records in English; preserve dated decisions and a clear resume point.
NOT YET ACCEPTED IN THIS BRIEF: final episode count (12 = 8 SPARK + 2 + 2 was only an AI suggestion), formal classification rules, independent-review arrangements, final revised proposal. A later verified student decision in the hub can supersede this status. The supervisor has not been recorded as accepting the revised method.

Some AI logs/docs were created after earlier development. The surviving evidence may be sparse; its extent must be checked. Do not invent missing historical conversations, durations, tests, approvals or who authored a bug. A newly run test is new evidence, not proof that it was run historically. Future development can be recorded prospectively, but a retrospective/prospective research design is still a proposal to discuss.

REPOSITORY LEADS
The student supplied https://github.com/RuslanAeff/SynCinema and https://github.com/RuslanAeff/AutoSRT. An initial remote inventory found SynCinema's existing Planner-docs/Planing-Ledger.md, planning documents, test files and a CI workflow. Reuse its technical history; validate its claims. AutoSRT's inspected snapshot contained README/source/assets but no separate research log or dedicated test/CI files; historical/local records have not been ruled out. Neither repository was cloned or configured by the central session. See REPOSITORY_AUDIT_2026-09-19.md in the hub for observed revisions and limits.

STARTUP
1. Identify which repository is open. Read its applicable AGENTS.md/CLAUDE.md or other project instructions, inspect git status, and preserve unrelated edits.
2. The central hub is SPARK's docs/thesis directory. Read README.md and RESEARCH_LOG.md first. Supporting files are now research/COORDINATION.md, research/METHOD_DECISIONS_DRAFT.md and research/PROJECT_HANDOFF_TEMPLATE.md. THESIS.docx is the single manuscript; read its current contents before any writing edit. Report what you actually read. Do not guess a personal filesystem path or claim access you do not have.
3. If the hub is unavailable, record that limit and use this dated brief provisionally. You may inventory local evidence; do not make global thesis decisions from an unverified copy.

YOUR BOUNDED TASK
Inspect existing source history, documentation, tests and preserved AI records in this project. Establish what evidence actually exists before proposing an episode count. Suggest a small number of useful candidates if sources support them; there is no minimum quota. An episode follows one bounded problem/feature through attempts and verification; it is not one commit or one message.

Create or extend docs/thesis/research/PROJECT_LOG.md and docs/thesis/research/EVIDENCE_INDEX.md, reusing existing equivalents where appropriate. Record actual observation dates separately from original event dates. Identify retrospective accounts. Include source references, current status, missing evidence and the next action. Do not alter application code as part of this evidence-inventory task. A relevant safe check may be run when useful, but do not repair or rewrite historical evidence.

Do not edit the central thesis decision register while another session is maintaining it. Produce a dated project handoff packet using the template. The central session will inspect and import it; creating the packet does not mean it was imported or independently verified. Use project/relative paths, commit IDs and source hashes where useful, rather than embedding personal absolute paths in research records.

EVIDENCE RULES
- A software defect is not automatically an AI-authored error. Attribute a specific output only with supporting provenance; otherwise record UNKNOWN.
- A commit is implementation evidence, not proof of successful execution or all AI attempts.
- Separate automated tests, actual runtime/device checks and human acceptance. A device-dependent issue remains unverified on device until suitable observation exists.
- Label human decisions separately from AI suggestions. Never treat silence or a request for explanation as approval.
- Preserve uncertainty and conflicting sources. Select informative examples, including failures when supported; do not cherry-pick success or failure.
- Do not include credentials, personal financial data or unnecessary private identifiers.
- Do not commit/push, upload, publish, send supervisor messages or clone additional repositories without the user's applicable authorization.

CONTINUITY
Keep a short startup pointer in the project's applicable instruction file, preserving all existing instructions: thesis work begins by reading the local thesis README/log and any accessible current hub. This is a pointer, not a duplicate of global decisions.

At each meaningful milestone and before stopping, update the local log with sources, completed work, actual checks, open questions, exact next step and hub-import status. End with a simple Turkish explanation of what was found, what cannot be concluded and which files the central thesis session should read. Do not claim another AI will automatically remember this conversation.
```

For a new session **in the central SPARK workspace**, the shorter instruction is sufficient:

```text
Continue my thesis work. Read AGENTS.md, docs/thesis/README.md and docs/thesis/RESEARCH_LOG.md first. THESIS.docx is the single manuscript; read its actual current contents before editing. Supporting records are under docs/thesis/research/. Tell me briefly what is accepted, what is still proposed and where we stopped. Explain in simple Turkish; write in English. The forwarded peer email's old September deadline is not a current deadline for this task. Verify evidence, preserve student edits and update the dated log before stopping.
```
