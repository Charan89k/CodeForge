# Development progress

The durable log for the build mission. A new session reads this first, then continues from **Next exact task**. Private infrastructure details belong in `docs/private`, never here.

## Current position

- **Branch:** `feat/campus-shell`, stacked on `feat/foundation-stabilize` (PR #6). Each later slice stacks on the last until the PRs are merged.
- **Phase:** 1 (shell and design).
- **Next exact task:** see the bottom of this file.

## Working rules

- Commit only to feature branches, in small reviewable commits. Never merge, never push to `master`, never deploy.
- `docs/PRODUCT_AUDIT.md` and `IMPLEMENTATION_STATUS.md` stay uncommitted until the owner says otherwise. They live in the working tree, so **do not clean or stash them.**
- Run browser tests through Playwright's own server. A hand-started `next dev` entered a reload loop on 2026-11-01. The cause was not established; the same code passes under Playwright.
- Never name a process pattern in a `pkill` that also appears in the same shell command: it kills the shell. Never walk process trees recursively from a shell function.
- Disk was 99% full at the start, and cleanup is not approved. Stop heavy work if free space drops below 2 GB, and say so.

## Owner gates still closed

Merging PRs #3, #4, #5. Any deployment or production change. Publishing courses. Disk cleanup. The Vercel decision. Backups, monitoring, scheduled jobs, SSH hardening and the Caddy question are unresolved and must not be reported as done. See `docs/private/READINESS-PLAN.md`.

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-01 | Surfaces are CSS token sets keyed by route, not separate components | No duplicate component system; Campus and workspaces unchanged by construction |
| 2026-11-01 | Terracotta accent, cream paper, Source Serif 4 for Learn headings and reading | The owner's warm editorial direction, with navy kept for links |
| 2026-11-01 | Self-service deletion is refused for platform admins and anyone with college records | College grades and placement records would cascade away. **No approved privacy policy exists, so this is the conservative default and needs the owner's and counsel's review** |

## Log

### 2026-11-01

**`19d6063` test(e2e): stop two browser specs racing.** `email-reminders` waits out the job lock's 409. `tutor` waits for the run's own summary. Before: 4 failures in 4 repeats. After: 30 of 30, with 5 repeats and no retries.

**`a492482` feat(learn): warm editorial surface.** `surfaceForPath`, `ShellSurface`, token sets in `globals.css`, `contrast.test.ts`, serif headings. Vitest 172 passed in the affected files. Playwright `page-health`, `portals`, `catalogue`, `highlights` on both projects with no retries: 89 passed, 3 skipped, 0 failed. Screens checked in light and dark. Only tokens and type changed so far: **the Learn information architecture and dashboard are not redesigned yet.**

**`a112c94` feat(account): export and deletion.** `src/services/account.ts`, `/settings/export`, a "Your data" section, `/account-deleted`. A test compares the exported tables with the schema. Integration 8 passed. Browser `e2e/account` on both projects with no retries: 6 passed.

**`d503fc7` feat(cms): review separation.** Publishing or sending back needs a different admin. The editor tells the author it is waiting, and `courses:author` takes `--reviewer`. Integration 14 passed. Browser `cms`, `authored-courses`, `admin` on both projects with no retries: passed after one test-setup fix. **Publishing now needs two admin accounts wherever it is used.**

**Core Algorithms course.** 9 lessons, 9 knowledge checks, 33 Python examples run by the test suite. Authored locally through the CMS with a second admin as reviewer. Course tests 140 passed. **Not in production.** No person has reviewed the teaching yet.

**`54ca938` feat(dashboard).** Year calendar from `StudyDay` in UTC days, per-course progress, daily challenge, open contests. Vitest 1,922 passed, 35 skipped. Browser specs touching the dashboard pass on both projects with no retries. No sideways overflow on desktop or mobile.

**`88650e9` test(e2e).** The full suite at `02f9576` gave 338 passed, 24 skipped, 2 failed: the catalogue spec assumed one course per subject, which Core Algorithms broke. It now checks a course from another subject is excluded.

**PR #6.** `feat/foundation-stabilize` pushed, opened against `feat/learn-library`. Not merged. Check its CI at the start of the next session.

**Known, not fixed:** `authored-courses.spec` failed once earlier, with cause unknown. It has passed every run since. The full browser suite and production build have not been re-run at `54ca938`.

**`f590dd9` feat(campus).** The college page opens on each role's own work: exams and drives for students, exams to mark for faculty, drives and outcomes for officers, members and audit for admins. `getTeachingQueue` is tested across teachers, tenants and students.

**`f0b3329` feat(workspace).** Ctrl+Enter runs, Ctrl+Shift+Enter submits, focus mode covers the site chrome, and the editor pane is dark unless the person chose light. Problems only.

**Full gate at `f0b3329`, no retries.** Playwright 343 passed, 25 skipped, 0 failed. Vitest 1,923 passed, 35 skipped. Lint 0 errors. Build completed.

**Seen once, not reproduced:** the Next dev overlay showed "1 Issue" on one mobile admin screenshot. A clean load of that page logged no console errors. Cause unknown.

**Vercel preview** fails on PRs #3, #4, #5 and #6. Part of the open Vercel decision; not investigated further.

## Next exact task

Visualizer as a laboratory (roadmap 1.5): queues, hash tables and minimum spanning tree, with an explanation per step. Then library metadata (3.3), then the SQL playground (4.1).
