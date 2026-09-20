# Pilot P-001 — Failed API-key deletion reported as success

Prepared and newly verified: **2026-09-19**. Coding protocol: [draft v0.1](../METHOD_DECISIONS_DRAFT.md). Status: **provisional worked example; not main-dataset coding, student acceptance or independent review**.

## Why this example

The episode has a narrow observable failure, archived baseline code and current regression tests. It also has an important provenance gap: the selected evidence does not establish who originally authored the defective function. Working through an unknown attribution makes the classification rule inspectable rather than treating every bug in an AI-assisted project as an AI error.

## Boundary and sources

The proposed episode concerns discovering and correcting failure handling in local API-key deletion, including its interaction with legacy SQLite migration. Other security findings are outside this boundary.

The existing security records date the investigation/remediation to 2026-09-16. Their claims about that date remain record-based; this exercise does not independently reconstruct all original actions or their timing. The observation cutoff for this example is 2026-09-19. Original task-response transcript and the exact beginning of the defect's development history are not archived in this packet. Device verification and final acceptance are unresolved at the cutoff.

- **P1:** [Baseline source](snapshot/baseline-secureKeyStore.ts.txt), from commit `25ef86cb0bfa8f9030d5d51bf5e0426cd7aafd30`.
- **P2:** [New fault reproduction](baseline-fault-reproduction.json): executed against the actual baseline source, with a synthetic native deletion failure.
- **P3:** Current service/UI and test snapshots, identified and hashed in [evidence-manifest.json](evidence-manifest.json). They are uncommitted working-tree content, not files asserted to belong to the baseline commit.
- **P4:** [New regression output](verification-2026-09-19.txt): 2 suites / 6 tests, executed on 2026-09-19.
- **P5:** Existing [security finding SEC-02](../../../evidence/SECURITY_REVIEW_2026-09-16.md) and [remediation record](../../../evidence/SECURITY_REMEDIATION_2026-09-16.md). These support reconstruction but are not independent authorship evidence.

## The twelve-field record

| Original framework field | Observation and limitation |
|---|---|
| 1. Initial problem/requirement | A failed native deletion must not be presented as successful removal. Legacy migration must not recreate a key after successful removal. P5 records this remediation requirement. |
| 2. Human instruction | The current conversation contains the student's request to verify and fix the security findings. A durable original episode transcript is not attached here; do not invent its exact wording or earlier instructions. |
| 3. AI role | Review/debugging, implementation and regression-test assistance are reported in P5. The original defective function's AI provenance is not established. |
| 4. Human intervention | The student requested the security remediation and required device-unverified findings to remain open. The packet does not show that the student personally identified the root cause or wrote the correction. |
| 5. Iterations | UNKNOWN. Two code states and several tests are not a count of all AI attempts. |
| 6. Errors/limitations | Baseline catches the native deletion exception and fulfils the public call. P2 reproduces this service-level behaviour. AI attribution of that baseline defect remains UNKNOWN. |
| 7. Affected components | Secure-key service, settings UI and legacy SQLite migration interaction; relevant snapshots in P3. |
| 8. Implementation evidence | P1 identifies the baseline; P3 records current error propagation, serialized key operations and UI error handling. |
| 9. Automated verification | P4: native/SQLite error propagation, successful removal, queue recovery, migration race/reload, and UI retention of the existing-key state on failure. Native dependencies are mocked. |
| 10. Runtime verification | No real-device SecureStore/SQLite failure or cold-start evidence in this packet. |
| 11. Human acceptance | No explicit final acceptance of this feature or this coding exercise is archived. A request to fix is not acceptance. |
| 12. Remaining risk/evidence limits | Native lifecycle unresolved; old code authorship and complete response sequence missing; sources and tests are AI-assisted; current working tree is not a release build. |

## Applying the rules step by step

**1 — Identify the claim.** The service is supposed to signal whether local deletion succeeded. The baseline `deleteSecureApiKey` catches every `deleteItemAsync` exception and returns normally. This is directly inspectable in P1.

**2 — Check behaviour.** P2 injects a rejected native deletion into the baseline implementation. The public call nevertheless fulfils. This supports a confirmed service-level failure-handling defect. It does not establish that a particular real device exhibited the failure, or that a real key was retained during this experiment: no real key or device store was used.

**3 — Test competing explanations.** “The key was already absent” does not explain the synthetic native failure used in P2. A late preference change is not necessary to explain the observed failure contract. However, the original instruction that produced the baseline function is unavailable, so the original prompt's adequacy cannot be classified. A confirmed code defect and uncertain original prompt provenance can coexist.

**4 — Decide attribution.** Record `DEFECT_CONFIRMED / AI_ATTRIBUTION_UNKNOWN`. Do not count this as an AI-authored error in a quantitative numerator. AI involvement in correcting the defect is a different claim from AI responsibility for introducing it.

**5 — Separate correction scope from AI rework.** The observed correction changes error propagation, sequencing of key operations, legacy removal and UI handling. Under the proposed rules, the overall baseline correction has substantial scope because lifecycle/control flow across collaborating responsibilities changed. Nevertheless, **AI-output rework = UNKNOWN**: the complete initial AI solution and successive evaluated revisions are not archived. Do not turn the size of the repair into a fabricated “AI needed substantial rework” result.

**6 — State the verified result narrowly.** Current service/UI regression checks pass in the mocked test environment (P4). The test evidence supports those scenarios; it does not demonstrate physical-device reliability or final user acceptance. The outcome is `IMPLEMENTED / AUTOMATED_CHECKS_PASSED / DEVICE_VERIFICATION_PENDING`.

## Claim-specific evidence map

| Claim | Evidence types available | Permitted conclusion |
|---|---|---|
| Baseline contains catch-and-ignore deletion handling | E1, P1 | Implementation observed at an identified commit. |
| Baseline fulfils despite injected native failure | E2, P2, newly executed 2026-09-19 | Synthetic service-level failure reproduced today. |
| Current code handles the tested service/UI cases | E1 P3 + E2 P4 | Captured implementation and six current automated checks. |
| Original defective function was authored by AI | Insufficient provenance | UNKNOWN; no AI-error attribution from these sources. |
| Fixed key removal works on a real phone after restart | No E3 | Not demonstrated by the mocked tests. |
| Student/supervisor accepted the fixed behaviour or this classification | No scoped E4 | Acceptance remains pending. |

The evidence codes describe support for each claim, not a global score for this episode.

## What a reviewer should check

Give the reviewer the source packet and draft rules before showing the classifications above. Ask them to identify the defect, decide whether attribution is supported, distinguish repair scope from AI-output rework and state what the tests cannot prove. Preserve their original answers and disagreements in the research log. No such independent review has yet occurred.

This pilot is useful for testing conservative attribution and evidence limits. If the supervisor prefers an example that also demonstrates a complete AI-response/revision sequence, select a better-sourced episode; do not fill this episode's gaps from memory. Main-data inclusion remains undecided.
