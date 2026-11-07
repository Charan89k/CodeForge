# Tech Epitome — Implementation Status

> **Purpose:** Evidence-based delivery tracker. This file records what exists, what is incomplete and what must be verified. It is not a marketing page.
>
> **Last verified:** 2026-11-01, partially. Section 2 and the rows marked "Reconciled 2026-11-01" were checked against the repository, CI and the public site. Every other row is still the handover's starting inventory. Production was only read through public URLs; no server was accessed.
>
> **Product requirements:** [PRODUCT_VISION.md](./PRODUCT_VISION.md)

## 1. Status vocabulary

| Status | Meaning |
|---|---|
| **Production-verified** | The complete user journey was tested on the live deployment and the running version/commit is known. |
| **Implemented, not production-verified** | Code and relevant tests exist, but live configuration or end-to-end production verification is missing. |
| **Partial** | Some layers or workflows exist; material requirements remain. |
| **Blocked** | Work cannot safely proceed until a named dependency, decision or operational prerequisite is met. |
| **Planned** | Intended in PRODUCT_VISION.md; no complete implementation is evidenced. |
| **Needs verification** | Conflicting, stale or incomplete evidence exists. Inspect source, CI and production before claiming a status. |

A status must be accompanied by evidence: commit/PR, tests, CI run, configuration check or production journey. A passing unit test alone does not prove production readiness.

## 2. Repository and release reconciliation — first task

Recent handover information (verify current state; do not assume it is still current):

- Repository: [Charan89k/tech-epitome](https://github.com/Charan89k/tech-epitome)
- Default branch observed: `master`.
- A recent production release was reported from `feat/placement`, commit `69a67c6`.
- PR #3: [Course CMS](https://github.com/Charan89k/tech-epitome/pull/3), intended to merge first.
- PR #4: [Placement module](https://github.com/Charan89k/tech-epitome/pull/4), based on PR #3 and intended to merge second.
- The two PRs were reported open at the time of the handover. Check actual current state, head/base SHAs, mergeability and CI before acting.
- Do not force-push, reset, rewrite history, merge or close PRs unless the user explicitly authorizes it.
- Preserve production commit `69a67c6` or any newer production commit. Do not assume the current default branch contains what is live.

### Required reconciliation checklist

- [x] Inspect current default branch and latest production commit. `master` is `28f605a9472fdd2a7902651e8bdd7e4a539e0080`. Production was released from `69a67c6`; the public health endpoint does not report a version, so this comes from the release record, not a fresh check.
- [x] Inspect PR #3 and verify its diff, tests, CI and relationship to current master. Head `a09109aaf038841175d36f766e2aa5627ed3947f`, base `master`, mergeable. CI runs 41273452174 (push) and 41273457375 (PR) passed.
- [x] Inspect PR #4 and verify its diff, tests, CI and dependency on PR #3. Head `0df27e806a817df99db09a0a73d2601d7bb8b986`, base `feat/content-cms`, contains `69a67c6`, mergeable. CI runs 41274036002 (push) and 41274039356 (PR) passed.
- [ ] Reconcile PR #3 first, then PR #4, preserving all production work. **Not done: needs the owner.** `gh pr merge 3` was attempted once before this tracker was read, and the permission guard denied it ("Merge Without Review"). This file also requires explicit authorization to merge. No history was rewritten.
- [ ] Verify the resulting default branch contains the production functionality. Not yet: `master` is behind production until #3 and #4 merge.
- [ ] Run required CI on the resulting default branch. Not yet possible.
- [ ] Update this section with actual SHAs, merge commits, CI run links and dates. Done for the current state; add merge commits after merging.

Merge order once authorized, using merge commits so `69a67c6` stays in history: #3, then #4 (retargeted to `master`), then #5 (retargeted to `master`).

PRs #3 and #4 show as "unstable" only because of the Vercel preview status, which fails with "DATABASE_URL is required". Production does not deploy through Vercel. Either configure or disconnect that integration; it is not a code failure.

## 3. Feature inventory

The following is a starting point, not a substitute for source inspection. Update each row with current evidence.

### Learn — public learning product

| Capability | Starting status | Notes / evidence to verify |
|---|---|---|
| Public account registration and authentication | Needs verification | README describes credentials and optional OAuth; verify live providers/configuration. |
| Learn application shell/navigation | Partial | Separate Learn and Campus navigation was reported. Verify current routes and role boundaries. |
| DSA learning tracks and chapters | Implemented, not production-verified | Reconciled 2026-11-01: 29 chapters in the seeded database. Live journey not re-tested. |
| System Design learning track | Implemented, not production-verified | Reconciled 2026-11-01: 27 chapters in the seeded database. Live journey not re-tested. |
| Low-Level Design learning track | Implemented, not production-verified | Reconciled 2026-11-01: 21 chapters in the seeded database. Live journey not re-tested. |
| Learning library/catalogue | Implemented, not production-verified | Reconciled 2026-11-01: on PR #5, not merged or deployed; the live `/learn` still serves the old catalogue. Subject, level, chapter difficulty, course length and learner progress filters, combined search, sorting, paging and URL state. Topic, tag and content-type filters are absent because courses have no such fields. |
| Course CMS | Implemented, not production-verified | Reconciled 2026-11-01: live since release `2026.11.01-2`, but the full journey was not re-tested live. Fixes in `a09109a` (Markdown hang on an empty heading, fence closing, clearing course fields) are not deployed. Admin-only: no separate author and reviewer roles, and an admin can review their own work. Knowledge checks have no screen. |
| Additional foundational courses | Partial | Reconciled 2026-11-01: Programming Foundations and Database Foundations (2 courses, 6 modules, 18 lessons, 18 knowledge checks) written and published through the CMS service in the local test database only. **Not in production.** OOP is left to the existing LLD track and DSA to the existing DSA track, pending a review of overlap. Other vision subjects are unwritten. |
| Coding problem catalogue | Implemented, not production-verified | Reconciled 2026-11-01: 150 problems in the seeded database (59 easy, 72 medium, 19 hard). **Live bug:** 8 statements failed the content schema and render blank (`can-reach-last-stone` confirmed on the public site). Fixed in `a09109a`, not deployed. |
| Monaco coding workspace | Implemented, not production-verified | Verify languages, editor behaviour and accessibility. |
| Run/Submit code execution | Blocked / needs verification | A prior handover reported execution disabled. Verify the current production configuration and isolated execution worker before enabling. |
| Live visualizer | Implemented, not production-verified | README reports Python/JavaScript tracing; handover reports 14 visualizers. Reconcile counts and verify real user-code tracing. |
| AI tutor | Blocked / needs verification | Provider configuration was previously outstanding. Verify live provider, limits, safety and graceful failure. |
| Aptitude practice for public learners | Planned / partial | A prior README said no individual aptitude practice; later handover reported 24 questions. Verify current data and full practice workflow. |
| Contests and leaderboard | Partial | Reported implemented; verify contest lifecycle, scoring, abuse controls and live data. |
| Public profiles and achievements | Implemented, not production-verified | Reported implemented; verify privacy controls and activity-derived metrics. |
| Notes, bookmarks and highlights | Implemented, not production-verified | README describes these; verify ownership boundaries and complete journeys. |
| Spaced revision | Implemented, not production-verified | README describes a review scheduler; verify due-date logic and real notifications. |
| Community/discussions | Planned | Requires moderation, reporting, privacy and anti-abuse design. |
| SQL playground | Planned | Requires isolated runtime and safe data model. |
| System design playground | Implemented, not production-verified | README describes architecture and class-design exercises; verify completeness. |
| Resume/career tools | Planned | Define privacy and export requirements before implementation. |

### Campus — institutional learning and career product

| Capability | Starting status | Notes / evidence to verify |
|---|---|---|
| Institution identity and tenant isolation | Implemented, not production-verified | Verify RLS, service scoping, cross-tenant tests and current production schema. |
| Separate student/faculty/admin sign-in experiences | Partial | Separate role pages were reported; verify placement officer and role lifecycle. |
| Student learning dashboard | Implemented, not production-verified | Verify real data, scoped access and useful empty states. |
| Faculty workflows | Partial | Verify course, assignment, grading and reporting journeys. |
| Campus aptitude practice | Partial | Reported as implemented; verify question bank, attempts, explanations and analytics. |
| Exams and assessments | Implemented, not production-verified | Prior handover describes published exams, autosave, server deadlines and audited grading; verify current code and production. |
| Text AI mock interviews | Implemented, not production-verified | Verify provider configuration, limits, transcript privacy and deletion/retention. |
| Voice AI interviews | Planned | Requires speech provider, consent, accessibility, retention and reliable UX. |
| Communication coaching | Planned | Must be transparent and supportive, not high-stakes automated grading. |
| Placement officer workspace | Production-verified (reported) / needs current verification | Reported live journey from officer invitation through accepted offer, report and CSV export on release `69a67c6`. Re-test current production. |
| Student records and CSV import | Production-verified (reported) / needs current verification | Reported in placement live test. Verify validation, duplicate handling, authorization and audit. |
| Recruiter records and contacts | Production-verified (reported) / needs current verification | Reported in placement live test. Recruiter login is not evidenced. |
| Placement drives and eligibility engine | Production-verified (reported) / needs current verification | Reported live; verify explainability, boundary cases and cross-tenant isolation. |
| Applications and stage transitions | Production-verified (reported) / needs current verification | Reported live; verify transition rules and audit history. |
| Offers and offer acceptance | Production-verified (reported) / needs current verification | Reported live; invalid negative offer amount was fixed and targeted tests rerun. Re-run full relevant CI. |
| Placement reporting and CSV export | Production-verified (reported) / needs current verification | Reported live; verify export permissions, data minimization and audit. |
| Interview scheduling | Planned / partial | A material placement workflow gap in the handover. |
| Offer letters and document workflow | Planned | Requires secure file handling, permissions, retention and audit. |
| Recruiter logins/portal | Planned | Requires explicit external identity and institution-scoped authorization design. |
| Placement analytics/readiness | Partial / planned | Build on verified definitions and real data; avoid misleading metrics. |

### Shared platform, security and operations

| Capability | Starting status | Notes / evidence to verify |
|---|---|---|
| Authentication and role enforcement | Implemented, not production-verified | Verify every role, suspension, invitation, reset and session invalidation path. |
| Database RLS / tenant isolation | Implemented, not production-verified | Re-run DB-level tests with a restricted non-owner role; never rely only on app-layer tests. |
| CMS publication and draft isolation | Partial | Reconciled 2026-11-01: integration and browser tests cover draft courses and chapters in the library, library search and direct lesson URLs. Global site search and exports were not re-audited, and nothing was checked live. |
| AI provider abstraction | Implemented, not production-verified | Verify real provider config and production limits; do not expose keys. |
| Email provider | Blocked / needs verification | Resend/live sender configuration previously outstanding. Verify invitation and reset delivery. |
| Secure code execution | Blocked / needs verification | Verify isolated worker host and threat model before enabling. |
| File/object storage and scanning | Needs verification | Verify any current uploads, access controls, malware scanning and retention. |
| Audit logging | Implemented, not production-verified | Verify append-only/same-transaction behaviour for sensitive changes. |
| Observability and alerting | Partial / needs verification | Verify health, error reporting, background job monitoring and alert delivery. |
| Encrypted off-server backups | Blocked / needs verification | Prior handover reported unencrypted server-side dumps and no confirmed encrypted off-server backup. Do not call this production-ready until backup and restore are tested. |
| Disaster recovery / restore test | Blocked | Document RPO/RTO, test restore to an isolated environment and record evidence. |
| Production release/rollback process | Partial / needs verification | Verify exact deployed SHA, health checks, migration policy and rollback safety. |
| Public repository hygiene | Needs verification | Scan current tree and history for secrets/private operational details. Rotate exposed credentials; deleting a file or rewriting history does not revoke a secret. |

## 4. Current known gaps and release blockers

Revalidate these before acting:

1. Reconcile PR #3 then PR #4 and make sure the default branch reflects the current production release. Waiting on the owner's merge; see section 2.
2. Complete library discovery: server-side filters, sorting, search composition, pagination, URL persistence, clear-all and robust states. Built on PR #5; needs merge and release.
3. Publish a small, high-quality set of original foundational courses through the CMS. Written; publishing to production needs a release and an authorized `npm run courses:author` run.
4. Verify and resolve code execution configuration only after confirming an isolated worker; do not run learner code on the app host or DPDP infrastructure.
5. Verify real AI and email provider configuration; keep features honestly unavailable if not configured.
6. Establish encrypted off-server backups and prove a restore works before risky production schema/data changes.
7. Rotate any test credentials that were exposed or used in production-like testing. Never read or print credential scratchpad files or paste secrets into chat.
8. Close material placement workflow gaps: interview scheduling, offer-letter/document workflow and carefully scoped recruiter access.
9. Reconcile README feature claims and test counts against the actual current repository and deployment.
10. Remove or sanitize private infrastructure details from public documentation; do not expose the separate DPDP system's operational information.
11. 8 of 150 problems render with a blank statement on the live site. The fix (`a09109a`) needs a release, with no data change.

## 5. Immediate next development slice

After branch/PR reconciliation, work on one bounded Learn slice:

### Library filters and first foundational courses

- Inspect the actual content schema, catalogue query/services, current routes, search, CMS, access model and existing tests first.
- Implement filters from fields that genuinely exist. Do not invent metadata or add decorative filters with no backend semantics.
- Apply filtering and pagination server-side. Compose filters with search and sorting.
- Persist filter state in URL query parameters; support removable filters, clear all, result counts and sensible empty/loading/error states.
- Ensure only published content is discoverable by ordinary learners.
- Add regression tests for authorization, unpublished content, filter combinations, pagination and URL state.
- Author a small coherent set of original foundational courses using the existing CMS workflow. Inspect existing material first to avoid duplication. Each course must include meaningful outcomes, prerequisites, ordered lessons, substantive explanations/examples and checks for understanding.
- Verify author/reviewer/publisher permissions, publication, version history and learner progress end-to-end.
- Run relevant unit, integration, browser and full CI checks. Report flaky tests separately; do not hide retries.
- No production deployment, production migrations, production content writes, container restarts or infrastructure changes as part of this slice unless separately authorized.

## 6. Required update format after every work session

For every completed or attempted slice, update the relevant rows above and append a dated entry here using this format:

### YYYY-MM-DD — <slice name>

- **Branch / commit:** exact branch and full SHA.
- **PR:** link and state, if applicable.
- **User-visible behaviour:** what now works end-to-end.
- **Tests:** commands, passed/failed/skipped counts, and CI run link/ID.
- **Security:** authorization, tenant, privacy and abuse cases verified.
- **Production:** deployed SHA and live verification only if deployment was explicitly authorized.
- **Dependencies:** configuration or infrastructure still needed (never include secret values).
- **Remaining gaps:** specific incomplete work.
- **DPDP isolation:** confirm no DPDP resources were changed.

Do not record a feature as complete without evidence. Do not silently overwrite previous dated entries; keep a concise history.

### 2026-11-01 — Library filters and first foundational courses

- **Branch / commit:** `feat/learn-library`. Code at `5c88a018595e0a23c8a7d04cfa4897eab098179f`, made up of `a1dabf4a0cf972c3ca591980be527c4596df1717` (library), `f1efc78e31ac0abc7451c20073378f18a1140e27` (knowledge checks), `49cf7bfb0afd64709ac4daaed1a8b5cecbe8cc38` (courses), `27d9407711360d021ceda57dd25c5e06aef7f13b` (formatting) and a merge of `master`. PR #3 also gained `a09109aaf038841175d36f766e2aa5627ed3947f`, merged into PR #4 as `0df27e806a817df99db09a0a73d2601d7bb8b986`.
- **PR:** [#5](https://github.com/Charan89k/tech-epitome/pull/5), open, base `feat/placement`. Not merged.
- **User-visible behaviour (local only):** a learner can search and filter `/learn`, remove filters singly or together, share the URL, open a course, pass a knowledge check, complete a lesson, and see that progress in the library after a reload. An admin can publish the two new courses by `npm run courses:author`.
- **Tests:**
  - `npx vitest run`: 1,671 passed, 35 skipped, 0 failed (at `49cf7bf`; only formatting and docs changed after).
  - `npm run lint`: 0 errors, 1 warning in `src/services/leaderboard.ts`, which this work did not touch. `npm run typecheck` and the production build passed.
  - Playwright, chromium and mobile, 4 chunks at `49cf7bf`: 358 passed, 37 skipped, 0 failed, 3 flaky. `authored-courses.spec.ts` ran in two chunks, so it is counted twice.
  - Flaky, each passing on retry: `email-reminders.spec.ts:92` (known) and `tutor.spec.ts:250` (not investigated), and the new `authored-courses.spec.ts`. The new one failed once, then passed in 5 runs without retries, including a cold build and the same chunk. Its trace was overwritten, so **the cause is unknown**.
  - CI on `5c88a01`: runs 41278220683 (push) and 41278223639 (PR) passed. CI runs Vitest, lint, typecheck, build and image builds, not Playwright.
- **Security:** filter input is allow-listed and bounded, and manipulated URLs are tested. Only published rows are selected. The progress filter is ignored without an account, and progress is scoped to the signed-in user. Student, faculty, placement officer and institution admin roles are refused the course editor (browser test). A knowledge check stays a draft until its chapter is published, and answers are not sent before submission.
- **Production:** no deployment, migration or data change. Live `/learn` still shows the old catalogue. One migration waits for the next release: `20261103090000_course_subjects`, which fills null course subjects only.
- **Dependencies:** owner authorization to merge #3, #4 and #5; a separate authorization to release and run `npm run courses:author`.
- **Remaining gaps:**
  - Courses are not in production, and version history and later edits were tested through the CMS test course, not by editing the authored courses.
  - No separate author and reviewer roles, so publishing by script is self-reviewed. An editor should read the lessons; the tests prove the examples run, not that the teaching is good.
  - Knowledge checks have no admin screen and cannot be replaced once live.
  - The vision's "warm, editorial" Learn tone is not delivered: the page uses the existing navy and indigo tokens.
  - No topic, tag or content-type filter, and lessons are not individually searchable by body text.
  - Rows without "Reconciled 2026-11-01" remain unverified, including README test counts.
- **DPDP isolation:** no DPDP resource was accessed or changed, and no server was accessed in this session.

## 7. Agent instructions

When beginning a new session, the coding agent must:

1. Read PRODUCT_VISION.md, this file, README and relevant engineering/security docs.
2. Inspect the live repository state, branches, PRs, CI and working tree.
3. Reconcile conflicting or stale entries before choosing work.
4. Select one bounded slice from PRODUCT_VISION.md and this tracker.
5. Follow all repository hooks and security gates; never bypass or weaken them.
6. Preserve production work and user changes; no force-push, reset or history rewrite.
7. Do not deploy or modify production/infrastructure without explicit authorization.
8. Update this file with evidence and report exact branch/commit/test results.

