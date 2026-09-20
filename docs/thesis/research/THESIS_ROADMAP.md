# Thesis writing roadmap and evidence recovery

Prepared: 2026-09-19. Working guidance, not a university-approved structure or accepted revised research design. Approximate student-reported deadline: July 2027. Weekly availability, exact submission date and institutional formatting requirements remain unknown.

**Writing update, 2026-09-20:** the single manuscript is [THESIS.docx](../THESIS.docx). The student clarified that the forwarded peer email's old September date is not a current deadline and that work concerns the complete thesis. A peer document and email supply provisional formatting references only. This roadmap is supporting guidance; maintain the actual chapter text in the current Word file rather than another draft.

## What the thesis is trying to explain

The study asks how one student developer used AI assistance across three applications, what the human contributed, what difficulties arose, and how claims of success were checked. The contribution need not be a flawless application or proof that AI replaces developers. It should be a transparent, evidence-supported account of the process and its limits.

The supervisor considers the comparative framing and research question workable, but requests stronger bias safeguards, an accurate experience profile, feasible scope and operational classification rules. Student-developer terminology is accepted by the student; the remaining method choices still require discussion. Neither academic success nor supervisor acceptance can be guaranteed by this plan.

## New information about the archive

On 2026-09-19 the student explained that structured AI logs and documentation were introduced after some earlier development. Record availability may therefore be sparse. The actual extent has not been audited. Do not turn this concern into a claim that all early records are missing, and do not treat recently written logs as contemporaneous records of older work.

Before fixing a sample size, list surviving sources in each project. Inspect relevant Git history, code, tests, saved AI conversations, issues, CI/build records, screenshots and student notes where available and authorized. Documentation creation/revision dates can help identify a retrospective record but cannot alone establish when the underlying event occurred.

| Available material | What it can support | What it cannot establish alone |
|---|---|---|
| Identified Git revision/diff | A recorded code state/change | Who wrote a specific AI output, why it was chosen, every prior attempt, or whether it ran successfully |
| Preserved prompt and AI response/patch | The observed request and attributed response | Whether the result worked without suitable verification |
| Historical test/build log linked to a version | The checks and outcome reported for that version/environment | Untested requirements or physical-device behaviour outside its scope |
| New test run on an archived/current version | A newly observed result under today's recorded conditions | That the same test occurred during the original episode |
| Screenshot/video with source and context | The visible behaviour in the recorded scenario | General reliability, an unseen backend result, or the entire development sequence |
| Student recollection or later AI-assisted log | A labelled retrospective account and leads for finding sources | Exact missing prompt wording, independently proven authorship, duration or success |
| No relevant source located | A documented gap after a stated search | That an action definitely never happened |

## If the evidence is sparse

Proposed responses, to be agreed after the audit:

1. Prefer a smaller number of sufficiently supported episodes to a fixed quota filled by speculation. Select for comparative value and include relevant unsuccessful/uncertain outcomes, not just positive demonstrations.
2. Use an older episode for the claims its sources support. A code-change history can inform technical evolution even when the AI/human division of work remains unknown.
3. If useful, combine clearly labelled retrospective episodes with prospectively recorded future development. Record the observation boundary and changing tools/experience; seek method agreement before presenting the combined design as final.
4. If a secondary case cannot support a meaningful comparison, discuss narrowing its role or the research question with the supervisor. Do not silently preserve a three-case claim unsupported by sources.

Do not manufacture tasks or failures to produce a desired result. From now on, preserve a concise original request, the relevant AI output/diff, human decision, test result and acceptance/remaining limits when meaningful work actually occurs. Do not archive credentials or personal financial data.

## Proposed route from the current position

| Stage | Concrete output | Condition to move forward |
|---|---|---|
| 1. Locate and audit evidence | Project source inventories, gaps and a small list of candidate episodes | Inspect all three cases sufficiently to assess their comparative role; do not assume logs exist |
| 2. Resolve the supervisor's four points | Agreed scope, researcher profile, worked pilot, explicit classification rules; English response/proposal | Record student decisions; distinguish later supervisor feedback from student approval |
| 3. Prepare the writing structure | Chapter outline, source-backed literature notes and figure candidates | Obtain the applicable university/supervisor requirements; avoid invented page counts or citation rules |
| 4. Analyse selected episodes | Source-linked episode records with alternative explanations and unknowns | Apply the agreed protocol consistently; complete and record whatever review was actually arranged |
| 5. Compare and draft | Primary-case findings, secondary comparisons, discussion and limitations | Every empirical claim points to an appropriate source; denominators and missing cases are visible |
| 6. Review and assemble | Revised English thesis, captions/references, appendices, final Word/PDF | Supervisor review, factual/source checks and document-layout checks; follow actual submission rules |

Stages can overlap in a controlled way: introductory and literature notes can begin during the audit, but numerical findings and conclusions wait for evidence. Plan dates after measuring a small pilot's actual effort and learning weekly availability. Do not invent a calendar just because July 2027 was mentioned.

## What the student will write

This provisional outline answers the question “what goes into my thesis?” It is not a mandated chapter count.

| Proposed chapter | Plain-language purpose | Typical material |
|---|---|---|
| 1. Introduction | What problem are we studying, and why? | Motivation, research question, scope, intended contribution |
| 2. Related work | What is already known, and what does this study add? | Verified academic sources on AI-assisted development, human oversight and verification; no claim of being the first without a literature basis |
| 3. Research design | How will the study reach defensible conclusions? | Researcher profile, case selection, episode boundaries, classification rules, E0–E4, bias checks, missing-data treatment |
| 4. Case context | What are the applications and their relevant differences? | Concise purpose/stack/timeline summaries, without turning each into a separate portfolio essay |
| 5. Findings | What happened in the selected processes? | Worked episodes and observed evidence, including unsuccessful or unresolved outcomes |
| 6. Cross-case discussion | What patterns are similar or different, and what might explain them? | AI/human roles, rework, verification gaps, alternative explanations, limits of generalisation |
| 7. Conclusion | What can we answer, and what remains open? | Answers to the research question supported by the findings; practical implications and further work |
| Appendices | What detail should remain inspectable without interrupting the main text? | Codebook, source index, selected redacted records, review/disagreement record |

The AI may help extract evidence, outline, draft English and check consistency. The student needs to understand, review and own the interpretation. Preserve this assistance in the log and follow the institution's actual AI-use/disclosure rules once obtained; they have not been verified here.

## Figures, screenshots and tables

Yes, figures and screenshots can be planned where they explain something the reader needs to assess. The exact format/number follows the later institutional requirements and the argument, not a preset quota. No thesis figures have been produced in this task.

| Candidate visual | Purpose | Evidence condition |
|---|---|---|
| Small application overview screenshot | Help a reader understand the case | Identify app version and capture date; use synthetic/redacted data |
| Episode timeline | Show request, attempted solutions, human intervention and checks | Use observed sequence/timestamps; show missing intervals, not invented durations |
| Before/after behaviour pair | Show a concrete change | Both states must have real, identified sources and comparable scenarios; do not fabricate an old screenshot |
| Evidence-flow diagram | Explain how claims are supported | Mark it as an explanatory diagram, not a measured result or an ordinal quality score |
| Cross-case comparison table | Make patterns and gaps visible | Use actual eligible episodes and explicit unknowns; no fabricated counts |
| Short code/test excerpt | Explain a failure or verification boundary | Cite repository revision/path and the exact claim it supports |

For each eventual figure record: figure ID; source; version/build; capture/event date and record date; caption; supported claim; limitations; redactions; and whether it is empirical evidence or an illustration. A current screenshot cannot substitute for a missing historical one. A synthetic example must be labelled as such. Avoid decorative stock/AI images presented as observations.

## Immediate next step

The student has now supplied both repository references. An [initial remote inventory](REPOSITORY_AUDIT_2026-09-19.md) found existing planning records in SynCinema and source/README material in AutoSRT. Follow up selected leads through version history and any surviving original conversations before choosing episodes. The student's request for reassurance and coordinated work does not approve the suggested 12-episode count. Keep the scope open until the material has been examined and the student understands the options.
