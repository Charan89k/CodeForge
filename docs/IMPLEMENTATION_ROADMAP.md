# Implementation roadmap

Ordered work towards the full inventory in [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md). Status of each item lives there and in [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md). This file holds order, dependencies and acceptance only.

A slice is done when its backend, interface, persistence, permissions, error states, tests and documentation all work. "Done" here never means production-verified: that needs an owner-approved release.

## Slices, in order

| # | Slice | Depends on | Acceptance | State |
| --- | --- | --- | --- | --- |
| 0.1 | Fix racing browser specs | None | Repeat runs pass with no retries | Done |
| 1.1 | Learn surface: tokens and type | None | Contrast test; Campus and workspace unchanged | Done |
| 2.1 | Account export and deletion | None | Export holds only the owner's data, with no secrets. Deletion needs re-authentication and protects college records. Browser journey passes | Done |
| 3.1 | CMS review separation | None | An author cannot approve their own revision. Permission tests. A dedicated reviewer role is still to come | Done |
| 3.2 | DSA chapters: trees, heaps, graphs, sorting, greedy, dynamic programming | 3.1 preferred | Original, examples run in tests, knowledge checks, practice links | Done |
| 1.2 | Learn dashboard and information architecture | 1.1 | Real data only; daily, contests, activity calendar; responsive | Dashboard done. Navigation unchanged |
| 1.3 | Campus shell: role navigation and dashboards | None | Distinct student, faculty, officer and admin views; dense tables | Planned |
| 1.4 | Coding workspace dark by default, shortcuts, full-screen | None | Keyboard accessible; editor space preserved | Planned |
| 1.5 | Visualizer as a laboratory, new modules | None | Queues, hash tables, MST; explanations per step | Planned |
| 3.3 | Library: tags, topics, body search, recently viewed | 3.1 | Filters only over real metadata | Planned |
| 4.1 | SQL playground, in the browser | None | Isolated by design; resets; exercises tracked | Planned |
| 5.1 | Aptitude in the database, public, timed, analytics | 3.1 | Authoring screen; provenance; weak topics | Planned |
| 5.2 | Contest journey tests, history, ratings | Execution for submissions | Browser journey; honest disabled state until then | Planned |
| 5.3 | Tutor feedback, deletion, retention, study plans | Provider for live use | Works with a local provider; honest unavailable state | Planned |
| 5.4 | Community with moderation first | None | Reporting and moderation before posting exists | Planned |
| 5.5 | Resume builder and export | None | Versions; no fake AI analysis | Planned |
| 6.1 | Institution structure: departments, batches, sections | None | RLS and cross-tenant tests | Planned |
| 6.2 | Assignment submissions, grading, feedback | 6.1 optional | Faculty-to-student journey | Planned |
| 6.3 | Faculty-authored institutional courses | 3.1, 6.1 | Tenant-scoped; never public | Planned |
| 6.4 | Exams: shuffling, negative marking, sections, mark for review | None | Rules unit-tested; frozen versions intact | Planned |
| 7.1 | Placement interviews: rounds, slots, panels, feedback | None | Officer-to-student journey | Planned |
| 7.2 | Offers: compensation, joining; reports | 7.1 | Export and print; audited | Planned |
| 7.3 | File storage, then offer letters and attachments | Storage decision | Access control, scanning, retention | Blocked on a decision |
| 7.4 | Readiness analytics with published definitions | 5.1, 6.2 | Clear definitions, real data | Planned |
| 7.5 | Recruiter portal | Identity and data-boundary design | No unauthorized access; tenant tests | Planned |
| 8.1 | Campus notifications | None | In-app works now; email needs a provider | Planned |
| 8.2 | Admin: abuse reports, feature and health views | 5.4 | Permission tests | Planned |
| 9.1 | Accessibility scan in tests | None | No serious findings on key pages | Planned |

## Blocked on the owner

| Dependency | Unblocks |
| --- | --- |
| Isolated execution host | Run, Submit, judge, contest submissions, coding exams |
| AI provider key | Live tutor, interviews |
| Email provider and domain | Invitations, reset, verification, reminders |
| OAuth credentials | Google and GitHub sign-in |
| gpg key, storage, monitoring accounts | Backups, restore test, alerts, releases |
| Merge and release approvals | Everything reaching production |

Long-term targets of 2,000 problems and 75,000 questions are targets, not inventory. Grow them only with reviewed, original or licensed content.
