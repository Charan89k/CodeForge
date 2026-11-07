# Tech Epitome products and feature status

Tech Epitome is two products on one account system.

- **Learn** is public: problems, contests, courses and the Live Visualizer. No
  college is needed.
- **Campus** belongs to a college: classes, exams and placement preparation.
  Membership comes only from an invitation or a verified college email domain.

| Area | Entry point | Who gets in |
| --- | --- | --- |
| Learn | `/explore`, `/login`, `/signup` | Anyone |
| Campus students | `/campus/login/student` | Active student membership |
| Campus faculty | `/campus/login/teacher` | Active faculty or institution admin membership |
| Platform admin | `/admin/login` | `User.role = ADMIN` |

A sign-in page only chooses where a successful sign-in goes next. Roles are read
from the database on every request, so changing a URL grants nothing. See
[TENANCY.md](TENANCY.md) for row-level security.

## Status key

- **Live**: implemented and tested.
- **Needs configuration**: built, but off until an operator supplies a service.
- **Partial**: useful now, with the stated gap.
- **Planned**: not built. Nothing in the product presents it as available.

## Learn

| Feature | Status | Notes |
| --- | --- | --- |
| Problem library, filters, search | Live | 150 original problems, in Python, JavaScript, Java and C++ |
| Run and Submit | Needs configuration | Requires an isolated worker; see [EXECUTION.md](EXECUTION.md) |
| Submission history, hints, solutions | Live | Solutions are original |
| Problem provenance and licensed import | Live | `npm run problems:import`; no licensed set has been imported |
| Courses, chapters, quizzes, notes, highlights | Live | 3 seeded courses with 77 chapters, plus the authored courses below |
| Course library: search, filters, sorting | Live | Subject, level, chapter difficulty, course length and your own progress, all in the URL. No filter by topic or tag, because courses do not have them |
| Live Visualizer, guided algorithms | Live | 14 algorithms; every frame comes from running the algorithm |
| Live Visualizer, your own code | Live | Python and JavaScript, traced in your browser |
| Daily challenge and streak | Live | Solves are recorded only once Submit is configured |
| Contests and standings | Partial | Admin-created, scored ICPC-style. No ratings or virtual contests. Needs Submit |
| Leaderboard and public profiles | Live | Opt-in; nobody is listed by default |
| AI tutor | Needs configuration | Requires an AI provider key |
| Course CMS: authoring, review, publishing, version history | Live | Admin-only. Markdown lessons, or raw blocks for older chapters. Knowledge checks are written with `npm run courses:author`; there is no screen for them, and one cannot be replaced once live |
| Original courses | Partial | Programming Foundations and Database Foundations: 18 lessons, 18 knowledge checks, every example run by a test. Written and tested; they reach a site only when an operator runs `npm run courses:author` there. More subjects are not written yet |
| SQL problems and playground | Planned | |
| Code playground | Planned | |
| Discussions and community | Planned | |
| Contest ratings | Planned | |
| Visual debugger with breakpoints | Planned | |

## Campus

| Feature | Status | Notes |
| --- | --- | --- |
| Separate student and faculty sign-in and navigation | Live | |
| Invitations, roster import, domain verification | Live | Without email, the inviter gets a one-time link |
| Classes, assignments, progress | Live | |
| Question banks, multiple choice and coding | Live | Coding needs Run and Submit |
| Exams: scheduling, frozen versions, autosave, deadlines, grading, release | Live | |
| Exam overview across classes | Live | |
| Analytics and audit log | Live | |
| Aptitude practice | Partial | 24 original questions with explanations |
| Mock interviews, text | Needs configuration | Requires an AI provider key |
| Interview preparation tracks and roadmaps | Live | |
| Voice interviews and recording | Planned | |
| Proctoring | Planned | Needs a privacy review first |
| Placement officer role, drives, recruiter CRM, eligibility, reports and CSV export | Live | Stages move by hand; no interview scheduling, offer letters or recruiter logins |
| Resume builder | Planned | |
| Plagiarism detection | Planned | |

## Accounts

| Feature | Status | Notes |
| --- | --- | --- |
| Password sign-in, sessions, revocation | Live | |
| Password reset | Live | By email once configured; an admin can issue a one-time link |
| Email verification | Needs configuration | Requires an email provider |
| Google and GitHub sign-in | Needs configuration | Requires OAuth credentials |

## External configuration

| Service | Enables | Settings |
| --- | --- | --- |
| Email (Resend) | Invitations, reset, verification, reminders | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` |
| AI (Anthropic) | Tutor, mock interviews | `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` |
| Execution worker on a separate host | Run, Submit, contests, coding exams | `CODE_EXECUTION_ENABLED`, `CODE_EXECUTION_DRIVER`, `CODE_EXECUTION_API_URL`, `CODE_EXECUTION_API_KEY` |
| OAuth | Social sign-in | `AUTH_GOOGLE_*`, `AUTH_GITHUB_*` |
