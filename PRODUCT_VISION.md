# Tech Epitome — Product Vision

> **Product promise:** Master Technology. Build with Confidence.
>
> Tech Epitome is a completely free, high-quality technology learning and campus career-readiness platform. It combines a public self-directed learning product with a separate institution-sponsored Campus product, on a shared and secure engineering foundation.

This document is the long-term product source of truth. It describes the intended product, not a claim that every feature already exists. For verified delivery state, dependencies, release gates and known gaps, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

## 1. Product principles

1. **Free for everyone.** No subscriptions, premium tiers, paywalls, paid AI credits, or feature gates based on payment. Do not introduce billing.
2. **Learning outcomes over feature counts.** Build complete learning journeys, not disconnected screens or inflated content counts.
3. **Real functionality only.** No fake buttons, placeholder dashboards, mock production data, simulated success, or UI-only implementations presented as complete.
4. **Original and properly licensed content.** Create original educational material or use content with verified compatible licences and required attribution. Never copy proprietary problem statements, explanations, tests, notes, branding or course material from other platforms.
5. **Security and privacy by design.** Enforce authorization on the server and in the database where applicable. Minimize collection and retention of student data.
6. **Accessible, responsive and polished.** Support keyboard navigation, semantic HTML, readable contrast, reduced motion and mobile/tablet/desktop layouts.
7. **Distinct product experiences.** Learn and Campus have different audiences, information architecture and visual tone; they may share underlying services.
8. **Honest capability labels.** Distinguish production-verified, implemented-awaiting-configuration, partial, planned and blocked capabilities.
9. **Test the whole journey.** A feature is not complete merely because a component, endpoint, schema or isolated unit test exists.
10. **Keep infrastructure boundaries intact.** Tech Epitome must remain operationally isolated from the separate DPDP compliance application and its data, containers, volumes, networks, proxy configuration and secrets.

## 2. Product structure

### A. Tech Epitome Learn — public learning product

A self-directed learning environment for anyone learning computer science, programming and software engineering. Users can create ordinary public accounts without belonging to a college.

#### Learning library and structured content
- Searchable catalogue of courses, chapters, lessons, notes, problem sets, practice paths and other learning resources.
- Filters and sorting appropriate to the actual content model: subject/domain, topic/subtopic, difficulty, content type, course/path, tags, estimated duration, publication state and learner progress where meaningful.
- Clear content metadata: learning outcomes, prerequisites, level, estimated effort, author/source, licence and last-updated/version information where applicable.
- Course and lesson pages with structured content blocks, code examples, diagrams, quizzes, linked problems and interactive visualizations.
- Bookmarks, private notes, highlights, history, continue-learning and progress tracking.
- Accessible reading experience, table of contents, responsive layouts and useful empty/error/loading states.

#### Computer science and programming curriculum
Build coherent, sequenced, original material, including:
- Programming foundations and problem-solving methodology.
- Data structures and algorithms: arrays, strings, hashing, linked lists, stacks, queues, trees, heaps, graphs, sorting, searching, recursion, greedy methods, backtracking, dynamic programming and complexity analysis.
- Object-oriented programming, clean code, SOLID and design patterns.
- Databases, SQL, transactions, indexing and data modelling.
- Operating systems, networking, computer architecture and core CS foundations.
- Software engineering, Git, testing, debugging and maintainability.
- System design and low-level design, with trade-offs and realistic case studies.
- Additional tracks only when there is a real curriculum, content and assessment behind them.

Courses must have meaningful objectives, ordered modules/chapters, substantive lessons, examples, checks for understanding and relevant practice. Do not create thin placeholder courses just to increase catalogue size.

#### Coding practice and assessment
- A curated, growing catalogue of original or appropriately licensed coding problems.
- Problem statements, constraints, examples, hidden tests, difficulty, topics/patterns, hints and editorial explanations.
- Monaco-based coding workspace with a clearly supported set of languages.
- Run and Submit workflows with real execution, test results, limits and useful diagnostics.
- Practice sets, daily challenge, contests, progress history, bookmarks and revision.
- Profiles and achievements grounded in actual user activity.
- Long-term content ambition: approximately 2,000 quality problems, built progressively with provenance and quality review. This is a target, not a present-tense claim.

#### Aptitude and placement preparation
- Quantitative aptitude, logical reasoning, verbal ability and other relevant assessment categories.
- Topic-wise practice, timed tests, explanations, difficulty progression and performance analytics.
- A substantial long-term question bank (the 75,000-question ambition is a target, not a requirement to seed low-quality or duplicate questions).
- Original or properly licensed questions with source/licence tracking and editorial validation.

#### Interactive learning tools
- Live code visualizer that explains the learner's own supported code execution step by step.
- Algorithm/data-structure visualizations with meaningful controls and state.
- Debugging and tracing exercises.
- SQL playground with a genuinely isolated database/runtime and safe seeded datasets.
- System design and low-level design workspaces with diagrams, constraints and trade-off explanations.
- Additional playgrounds only when their execution and isolation model is real and safe.

#### AI-assisted learning
- Context-aware AI tutor that can use the current lesson, problem, code and learner's explicit context.
- Socratic hints and explanations that support learning rather than simply giving away answers.
- AI-generated study guidance and interview practice where useful.
- Provider abstraction, server-side credentials, rate limits, abuse controls, transparent AI labelling and graceful unavailable states.
- AI output must not be presented as authoritative grading or guaranteed career advice.

#### Community and personal growth
- Public learner profiles and shareable achievements.
- Optional discussion/help spaces, comments or study groups with moderation, reporting and abuse controls.
- Contests, streaks, revision schedules and personal learning goals.
- Community features must not expose private notes, private transcripts or institutional records.

### B. Tech Epitome Campus — institution-sponsored platform

A separate, institution-oriented experience for colleges, students, faculty, placement/training officers and authorized administrators. College-sponsored access does not turn Campus into a public Learn account or grant access merely because someone knows a college email domain.

#### Institutional identity and access
- Institution onboarding and verified institutional identity.
- College email/domain verification plus approved membership, invitation or roster-based admission as configured by the institution.
- Roles and scoped permissions for students, faculty, placement officers, institution administrators and platform administrators.
- Tenant isolation across every query, mutation, export, background job, cache and file access.
- Role changes, suspensions and removals take effect promptly; audit sensitive administrative actions.
- Separate, clear sign-in and navigation experiences for different Campus roles where that improves usability.

#### Teaching and learning operations
- Institution-specific courses, cohorts, batches and learning paths.
- Faculty course authoring/assignment workflows and student enrolment.
- Assignments, deadlines, submissions, grading, feedback and progress.
- Coding, MCQ and aptitude assessments.
- Exam authoring, publishing, scheduling, attempts, autosave, server-enforced deadlines and audited grade changes.
- Student/faculty dashboards based on authorized, real data.
- Exports and reports with scoped access and audit trails.

#### Interview and career readiness
- Text-based AI mock interviews, with voice-based interviews as a later capability after reliable speech infrastructure and consent/privacy design.
- Interview modes may include DSA, behavioural, system design and low-level design.
- Feedback should cite evidence from the student's own transcript and be clearly labelled AI-generated; avoid false precision and automated high-stakes decisions.
- Preparation tracks, communication coaching, resume guidance and career-readiness resources.
- Students should be able to understand and improve their readiness, not be reduced to opaque scores.

#### Placement management
- Placement officer workspace and institution-scoped student records.
- Recruiter/company records, contacts, notes and activity history.
- Placement drives, job descriptions, eligibility criteria and explainable eligibility decisions.
- Applications, student opt-in, application status and stage transitions.
- Interview scheduling and communication workflows.
- Offers, offer acceptance/decline, joining/status tracking and appropriate document handling.
- Reports and CSV exports with permission checks, audit logs and privacy safeguards.
- Future recruiter-facing access only with explicitly designed identity, permissions and data boundaries.
- Placement workflows must support the real process end-to-end; a recruiter table or dashboard alone is not a complete placement module.

#### Institutional insights
- Course/assignment/exam performance and learning progress.
- Skill/readiness trends, cohort comparisons and intervention signals.
- Placement funnel, drive participation, eligibility and offer analytics.
- Faculty and institutional reports with clear definitions and data provenance.
- Access must be purpose-limited; no institution may see another institution's records.

### C. Shared platform foundation

Reuse services where doing so improves correctness and maintainability, without collapsing Learn and Campus into one undifferentiated experience.

- Authentication, session management, authorization and account lifecycle.
- Content model, CMS, review, publication, version history and provenance.
- Problem catalogue, assessment engine and progress/revision services.
- Secure code execution orchestration.
- AI provider abstraction and usage controls.
- Email/in-app notifications and scheduled jobs.
- File/object storage with access control, scanning and retention.
- Analytics, audit events and reporting.
- Institution/tenant context and database-level isolation.
- Observability, health checks, backups and recovery.

## 3. Content quality and provenance

- Every problem, course, lesson, question, explanation and asset must have a traceable origin.
- Store author/source, licence, attribution requirements and review state where relevant.
- Do not use a simple blocked-name list as proof that content is original or legally usable.
- Do not scrape or reproduce proprietary content from LeetCode, CodeChef, HackerRank, GeeksforGeeks, AllCSNotes, Codeforces or other publishers without explicit rights.
- Validate correctness, ambiguity, difficulty, examples, tests, explanations and accessibility before publishing.
- Prefer a small, excellent, complete learning path over thousands of weak or duplicated items.
- Clearly label community and AI-generated content and apply moderation/review before it becomes trusted curriculum.

## 4. Security, privacy and reliability requirements

### Authentication and authorization
- Validate all inputs at trust boundaries.
- Enforce permissions in server services/actions/routes and database policies where appropriate; UI hiding is never authorization.
- Prevent IDOR, cross-tenant access, privilege escalation, unsafe account linking and session persistence after suspension/demotion.
- Protect invitation and reset tokens: single-use, expiring, hashed at rest and scoped to the intended action.
- Rate-limit sensitive and abuse-prone endpoints.

### Code execution and playgrounds
- Never execute untrusted learner code inside the main Next.js application process or on the DPDP host.
- Use a separately operated execution service with strong sandboxing, resource/time/process limits, filesystem isolation, network restrictions, cleanup and abuse controls.
- Verify the actual production worker isolation before enabling Run/Submit.
- Keep execution disabled and clearly explain why if safe infrastructure is unavailable.

### AI and interviews
- Keep API keys and provider credentials server-side.
- Apply per-user and global budgets, rate limits, timeouts and safe failure handling.
- Minimize transcript retention, explain it to users, support deletion where appropriate and run configured retention jobs.
- Never let model output alone trigger a high-stakes academic, disciplinary or hiring decision.

### Proctoring
- Treat proctoring as a separately reviewed, optional and privacy-sensitive capability.
- Require clear notice and consent, data minimization, retention limits, accessibility accommodations and human review.
- Do not automatically accuse or penalize a student based on uncertain face, gaze, movement or anomaly detection.

### Operations
- Encrypted off-server backups, retention policy and tested restoration are release requirements for production data.
- Monitor health, errors, latency, job failures and security events.
- Use additive, reviewed migrations and a rollback/recovery plan.
- Do not expose operational runbooks, private host details, secrets, tokens, private IPs or DPDP infrastructure information in this public repository.
- Never modify the separate DPDP application, its database, containers, volumes, networks, proxy configuration, environment or secrets while working on Tech Epitome.

## 5. Experience and design direction

The product should feel deliberate, premium, clear and purpose-built—not like a generic AI-generated SaaS dashboard.

- **Learn:** warm, editorial, content-first, calm reading and discovery.
- **Coding:** focused, dense where useful, dark-capable developer workspace; editor and problem statement take priority.
- **Visualizer/playgrounds:** interactive laboratory with visible state, controls and explanations.
- **Campus:** professional institutional software with clear hierarchy, efficient workflows, accessible data tables and role-aware navigation.
- Use consistent design tokens, typography, spacing, states and components while allowing each shell its own visual character.
- Avoid gratuitous gradients/glows, excessive glassmorphism, oversized rounded cards, decorative charts, repeated generic tiles and unnecessary animation.
- Every visible control must work. Every chart must represent real data. Every empty state must explain what can be done next.
- Support light/dark themes if the existing architecture supports them consistently; do not create a half-working theme.

## 6. Definition of done

A feature is complete only when all applicable items are satisfied:

1. The user journey and acceptance criteria are documented.
2. Data model and migrations are reviewed, safe and tenant-aware.
3. Server-side authorization and input validation are implemented.
4. UI works responsively, accessibly and across loading/empty/error/success states.
5. The workflow is genuinely end-to-end with real persistence and real dependencies.
6. Unit and integration tests cover business rules, permissions and failure cases.
7. Browser tests cover the important real user journey on desktop and mobile where relevant.
8. Security, privacy, performance and operational implications are reviewed.
9. Documentation and this repository's implementation status are updated.
10. CI passes; known flakes and skipped tests are explicitly reported.
11. Production configuration and dependencies are verified before claiming production readiness.
12. Deployment is a separate, explicitly authorized step; passing tests do not authorize deployment.

## 7. Delivery strategy

Build in coherent vertical slices, in dependency order. Suggested sequence (reorder only with a documented reason):

1. Stabilize repository/branch/PR history, security baseline, backups and release process.
2. Keep the two product shells, identity, roles and tenant isolation correct.
3. Complete content CMS, provenance and the learning-library discovery experience.
4. Build high-quality foundational courses and lesson assessments.
5. Grow original coding and aptitude content with editorial validation.
6. Complete secure code execution and coding-practice journeys.
7. Complete Learn progress, revision, contests and learner profiles.
8. Complete AI tutor and interview capabilities after provider and privacy configuration.
9. Complete Campus courses, assignments and examinations.
10. Complete placement workflows end-to-end, including scheduling and recruiter-facing boundaries where justified.
11. Add career tools, communication coaching and institutional analytics.
12. Add community and additional playgrounds only with moderation and safe infrastructure.

This is a roadmap, not permission to implement every layer at once. Each work session should select one bounded, valuable vertical slice and finish it properly.

## 8. Working agreement for AI coding agents

Before changing code:

- Read this file, [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md), README and relevant architecture/security docs.
- Inspect the actual current branch, working tree, open PRs, recent commits and CI state. Never assume a prior session's branch/commit status is still current.
- Follow repository hooks and all existing safety gates exactly. Gather facts before editing; do not bypass, disable or weaken hooks.
- Preserve production work and never force-push, reset, rewrite history or overwrite user changes without explicit authorization.
- Identify the feature's callers, data model, API/service contracts, permissions, tests and relevant documentation before editing.
- Do not make unrelated changes or start several overlapping workstreams.
- Do not deploy, run production migrations, alter production data or restart infrastructure unless the user explicitly authorizes that exact operation.
- Keep Tech Epitome and the separate DPDP system isolated.
- Use conventional commits. Do not automatically commit unless the user has explicitly asked for a commit in that task.
- At the end, report files changed, behaviour delivered, tests run/results, CI, security/permission implications, remaining gaps and the exact commit/branch.

After changing code:

- Update IMPLEMENTATION_STATUS.md with evidence-backed state, not optimistic claims.
- Record tests and CI with run links/IDs when available.
- Record configuration and operational blockers without revealing secret values.
- Do not mark a roadmap item complete merely because a partial implementation exists.

## 9. Scope boundaries

- Tech Epitome is free; do not add monetization or billing.
- Do not conflate this product with the separate CampusOS project.
- Do not merge unrelated client/startup projects into this repository.
- Do not add proprietary third-party content or branding.
- Do not claim support for a language, integration, AI provider, voice workflow, code judge, proctoring system or production dependency until it is configured and verified.
