# Pilot case: A long shop name in SPARK

Case: SPK-C01 | Draft 0.2 | Updated: 8 October 2026

**The student confirmed the problem, their request and the visible result on
8 October. The full analysis and supervisor review are still pending.**

AI helped write this draft in simple English. It uses the earlier
[case review](../SUPERVISOR_REVIEW_DRAFT_2026-10-04.md#worked-visual-example--spk-c01-draft-4-october-2026)
and [method draft v0.2](../METHOD_DECISIONS_DRAFT.md).
This is a supporting case file, not a new thesis manuscript.

## 1. Why do this pilot?

A pilot is a small trial before the main study. We study one real case first.
We check whether our rules are clear and whether the sources support our answers.
If a rule is unclear, we improve it before studying the other cases.

This case is useful because it shows a problem the student could see without
reading code. It also shows what we cannot learn from screenshots alone.

## 2. The question

Could the shop card show a long shop name and keep the amount and the detail
arrow inside the same page?

This case covers the shop card on the Spending Analytics screen. It does not
cover the receipt animation or other design changes.

The exact start date is unknown. A project record is dated 15 September 2026.
The student gave later feedback on 4 October. The date in an image file name
does not tell us which app version was tested.

## 3. What happened?

The student noticed a problem with a long shop name. In the earlier screenshot,
the content on the right is partly cut off. The student also said that content
moved into the next sliding page. A still image cannot show that movement.

On 8 October, the student shared both images again and explained the event.
They said that a long name made the row extend too far to the right. They
asked AI to fix the overflow. They confirmed that the result was later correct
by visual checking. They did not inspect or explain the code changes.
This is a summary of their Turkish account, written in English with AI help.

The project log says an earlier fix was not enough. However, the original AI
reply and the code from that first attempt are missing from this case record.
We cannot count the exact number of attempts.

The saved code change limits the space used by the name and amount. It also
keeps a separate space for the detail arrow and uses the measured page width.
This description comes from the Git record. It is not the student's own code
review. The student's lack of code knowledge does not mean the saved changes
cannot be studied.

In the later screenshot, the long name ends with dots. The amount and arrow
fit inside the visible card. The two screenshots use different data, so they
are not the same test repeated before and after the change.

The student said:

> Son hâlini denedim, istediğim gibi oldu ve bu yüzden tekrar bildirmedim.

AI-assisted English translation:

> I tried the final version. It was how I wanted it, so I did not report it again.

This is a later statement about the student's experience. It does not give us
the exact test date, device or app version.

## 4. Sources

| ID | Source | What it tells us |
|---|---|---|
| V01 | Earlier screenshot and the student's explanation in the chat | A visible layout problem; movement is reported by the student. |
| V02 | Project records: `AI-2026-09-15-VENDOR-OVERFLOW-001` and `SPK-UX-VENDOR-OVERFLOW-001` | A written account of the work. These are related records, not two independent checks. |
| V03 | Git change `25ef86cb0bfa8f9030d5d51bf5e0426cd7aafd30` | The saved change to the shop card, its styles and tests. |
| V04 | [Test output from 4 October](../sources/verification-2026-10-04.txt) and [file record](../sources/verification-2026-10-04.json) | Four test groups passed, with 16 tests in total. These include other features; they are not 16 tests of this problem. |
| V05 | Later screenshot shared in the chat on 4 October | The name, amount and arrow fit in the displayed card. |
| V06 | The student's statement above | The student reports testing and accepting the final result. |
| V07 | Student's clarification on 8 October, with both images shared again | The student confirms noticing the overflow, asking AI to fix it and accepting the visible result. They did not check the code changes. This is later recollection, not the original prompt. |

The screenshots and chat statement have not been saved as original files in
this case folder. A reviewer needs those sources to check the visual claims.
The written summaries alone cannot replace them.

Code paths for V03:

- `src/components/analytics/VendorsCard.tsx`
- `src/components/analytics/analyticsStyles.ts`
- `src/components/analytics/__tests__/VendorsCard.test.tsx`

V02 is in [the AI log](../../../evidence/AI_COLLABORATION_LOG.md) and
[the traceability record](../../../evidence/TRACEABILITY.md).
No new app tests were run to write this draft on 8 October.

## 5. Trial decisions and reasons

These are proposed labels. The student has not approved them yet.

| Question | Draft answer | Reason |
|---|---|---|
| What type of task was this? | Fixing a layout problem. | The aim was to keep existing content inside its page. |
| What did the student do? | Noticed the problem, asked AI to fix it and accepted the visible result. | V01, V06 and V07 support these actions. The student says they did not inspect the code changes. |
| Is a software problem visible? | Yes, in the earlier image. | Right-side content is partly cut off. Movement is only reported. |
| Did AI create the original problem? | Unknown. | We do not have a source linking the original faulty code to a specific AI output. |
| Was the prompt unclear? | Unknown. | The original full exchange is missing. |
| Did an earlier AI fix fail? | Reported in the log, but not fully checked. | The earlier reply and intermediate code are missing. |
| Was the final code change local? | Yes, for this layout fix. | It changes sizing and position within the existing approach. |
| How much AI rework was needed? | Unknown. | We cannot follow the original AI solution and all later revisions. |
| How many attempts were made? | Unknown. | One saved Git change does not mean one attempt. |
| What is the supported result? | The shown row fits, and the student confirms that the visible problem was fixed. | V05, V06 and V07 support this result for the observed layout. |

“Rework” means changing an AI solution after checking it. A small change that
keeps the same basic approach may be minor rework. Replacing the main approach
may be substantial rework. We need the earlier solution and later changes to
choose between them. We do not have that full sequence here.

The evidence includes a written account (E0), saved code (E1), automated tests
(E2) and the student's later acceptance (E4). A clearly identified device test
(E3) is missing. These labels describe different evidence types. Acceptance
does not prove that every device or screen size works.

## 6. What can we say in the thesis?

In this case, the student used visual feedback to guide a layout correction.
The saved code and automated tests support parts of the change. A later image
shows an improved layout, and the student reports accepting the result.
However, the available sources do not show who created the original defect
or how many AI attempts were needed. This case can support a discussion of
human visual checking. It cannot support a confirmed count of AI errors.

## 7. Review before approval

The student has now confirmed the problem, their request to AI and the visible
result. These points do not need to be asked again. They can still correct the
written account. This confirmation does not approve every label in section 5.

“I do not remember” is a valid answer. Missing dates or details should stay unknown.

For another human review, give the person sections 1–4, the available sources
and the method rules first. Ask them to write their own answers before reading
section 5. Record differences instead of removing them. A code-level check
needs a person who can read the relevant code. A visual review has a smaller scope.

| Review field | Status |
|---|---|
| Student account check | Problem, request and visible outcome confirmed on 8 October (V07); full draft and labels not yet approved. |
| Other reviewer, role and relationship to student | Not arranged |
| Review date and sources seen | Not recorded |
| Reviewer's answers and reasons | Not recorded |
| Differences and any rule changes | Not recorded |
| Supervisor feedback | Pending |

The next step is to explain the proposed labels to the student in plain
language and prepare the example for human review. The student should understand
the reasons for the labels before using them in the thesis. AI help with writing
and analysis is not an independent human check. The rules and final case
selection remain open.
