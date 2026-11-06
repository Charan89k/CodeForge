# Architecture

A short map. Details: [ENGINEERING.md](ENGINEERING.md), [TENANCY.md](TENANCY.md), [CAMPUS.md](CAMPUS.md), [EXECUTION.md](EXECUTION.md), [DESIGN.md](DESIGN.md).

## Stack

Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 and shadcn, PostgreSQL through Prisma 7, Auth.js with argon2id, Vitest and Playwright.

## Shape

- **Pages never query directly.** Server components and actions call `src/services/*`, which own `PUBLISHED` filters and ownership scope.
- **Two products, one account.** `productForPath` chooses the navigation. `surfaceForPath` chooses the design tokens.
- **Tenancy.** Campus data runs through `withTenantScope`, as the `te_tenant` role, under row-level security on every table.
- **Content.** Lessons are typed blocks validated by `lib/validation/content.ts`. The CMS keeps published content on the chapter row and every edit as a `ChapterRevision`.
- **Execution.** Never in the web process. A separate worker or Judge0, off until an operator enables it. Never on the host running the DPDP application.
- **Providers.** AI and email sit behind adapters. Mock and console adapters refuse to run in production.
- **Jobs.** Cron routes, guarded by a shared secret and a single-run lock, recorded in `job_runs`. They need an external scheduler.

## Boundaries

Tech Epitome shares a host, but not a database, volume or secret, with the separate DPDP application. CampusOS is a different project. Operational detail is kept in git-ignored private documents.
