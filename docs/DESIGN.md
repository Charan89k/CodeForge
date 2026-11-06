# Tech Epitome design system

**Surfaces (2026-11-01, owner's decision).** `surfaceForPath` in
`src/lib/navigation.ts` gives every shell page a surface, and tokens key off
`[data-surface]` in `globals.css`. **Learn** (library, courses, dashboard,
problem list) is a warm publication: cream paper or warm charcoal, ink text, one
terracotta accent, navy links, and Source Serif 4 (`font-editorial`) for `h1`,
`h2` and `.reading`. **Workspace** (problem and design editors), **Lab**
(visualizer), **Campus** and **Admin** keep the navy and indigo tokens below.
Contrast is enforced by `src/lib/design/contrast.test.ts`. Do not hard-code
colours: a raw hex would ignore the surface.

Structure follows the AlgoMaster reference (a dense, dark-first developer
tool). Colour is Tech Epitome's own: deep navy surfaces and a single **indigo**
accent, with cyan for information and teal for success (palette switched from
charcoal and ember on 2026-10-29 at the owner's request). Phase 1 (2026-10-28) added an editorial layer chosen with the Tasteful
plugin: a serif display face and hairline rules from GoShuin
(aestudio.studio), ruled flat cards from Stash (stash.cool). The premium
redesign (2026-10-30, branch `redesign/premium-ui`, guided by UI UX Pro Max's
"Minimalism & Swiss Style" / "Developer Mono" recommendation) replaced the serif
with IBM Plex Sans + JetBrains Mono, tightened the radius scale and moved section
labels to numbered mono. The logo is a flat indigo mark; no gradients anywhere.

Tokens live in `src/app/globals.css`. Use the Tailwind names below, never raw
hex values.

## Colour

| Role            | Class                                                              | Notes                                                                  |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Page            | `bg-background`                                                    | Deep navy, never pure black                                            |
| Card / panel    | `bg-card border border-border`                                     | One tonal step up, 1px hairline                                        |
| Muted fill      | `bg-muted/40`, `bg-accent/40` hover                                | Inputs, chips, hover rows                                              |
| Primary text    | `text-foreground`                                                  |                                                                        |
| Supporting text | `text-muted-foreground`                                            | Descriptions, table headers                                            |
| Meta text       | `text-subtle-foreground`                                           | Timestamps, counts, captions (still >= 4.5:1)                          |
| Raised surface  | `bg-popover`, `shadow-raised`                                      | Menus, dialogs, the landing preview; the only shadow token             |
| Action / accent | `bg-primary` (indigo), `text-brand-300/400`, `bg-brand-500/12` tint | **One filled indigo CTA per view.** Everything else is outline or ghost |
| Links in tables | `text-info`                                                        | Problem/item titles in lists                                           |
| Difficulty      | `<DifficultyBadge>`                                                | Coloured text only, never a filled pill                                |
| Status          | `text-success`, `text-warning`, `text-destructive`, `text-info`; `Badge`/`Alert` variants `success`, `warning`, `info`, `destructive` | Never indigo: a state must not read as an action |
| Visuals         | `viz-*`, `brand-*` on `.viz-canvas`                                 | Only inside diagrams and visualizations                                |

No gradient text, glows or washes. `.text-gradient-ember`, `.bg-hero-haze` and
`.grid-backdrop` were removed in Phase 1.

### Palette (2026-10-29, owner-specified)

| Token | Dark | Light |
| --- | --- | --- |
| `background` | `#080d19` | `#f7f8fc` |
| `card` | `#0d1424` | `#ffffff` |
| `popover` (raised) | `#111b2e` | `#ffffff` |
| `secondary`, `accent` (elevated, hover) | `#172238` | `#eef2fa` |
| `foreground` | `#f3f6ff` | `#15213a` |
| `muted-foreground` | `#a4b0c6` | `#53627a` |
| `subtle-foreground` | `#7e8aa3` | `#5e6a82` (the brief's `#738098` is 3.98:1 on white, so darkened) |
| `border` | `#25324a` | `#dce3ef` |
| `primary` | `#6557f5` (white text 4.96:1) | `#4f46e5` (6.29:1) |
| `brand-400` (secondary accent) | `#818cf8` | `#4f46e5` |
| `info` / `viz-compare` (cyan) | `#22d3ee` | `#0e7490` |
| `success`, `warning`, `destructive` | `#34d399`, `#fbbf24`, `#f87171` | `#15803d`, `#b45309`, `#dc2626` |

Every text colour is >= 4.5:1 on every surface it is used on (measured).
Light `brand-100`..`brand-400` are dark text shades because components written
dark-first use them as accent text on tinted fills. Highlight colour key
`ember` is stored data and still renders amber.

### Theme

Light, dark or system (the default), chosen from the header menu and
persisted by next-themes, which applies the class before first paint. The
Monaco editor follows it (`tech-epitome-dark` / `-light`). Nothing rendered
on the server may depend on the theme; that is a hydration mismatch.

## Type

IBM Plex Sans for UI, body and display (`font-sans`; `.display` is weight 600,
-0.032em, line-height 1.04); JetBrains Mono for code, numbers and labels
(`font-mono`, slashed zero). Both via `next/font`. Chosen from UI UX Pro Max's
"Developer Mono" pairing.

| Use           | Classes                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Hero display  | `display text-5xl sm:text-6xl lg:text-5xl xl:text-[3.25rem]` (smaller beside the two-column preview) |
| Page title    | `<PageHeader>`: `tracking-headline text-2xl font-semibold sm:text-3xl`; a string `eyebrow` renders as `.label-mono`|
| Section title | `text-lg font-semibold tracking-headline`                                                       |
| Card title    | `text-base font-semibold`                                                                       |
| Body          | `text-sm` (app), `text-base`/`text-lg` (marketing)                                              |
| Meta / labels | `text-xs`/`text-sm text-muted-foreground`, sentence case.                                        |
| Section label | `.label-mono uppercase tracking-wider`, numbered on marketing: `01 / Learn`                    |
| Long reading  | `.reading` (17px / 1.75)                                                                        |

## Shape and depth

- Flat. Depth comes from tonal steps and 1px borders, not shadows. At most `shadow-sm`.
- `--radius` is 0.375rem; every `rounded-*` token derives from it
  (`sm` 3px, `md` 4.5px, `lg` 6px, `xl` 9px).
- **`rounded-md`** for every button (marketing CTAs included), input and badge-like
  tag. No pill buttons; `rounded-full` is for dots, avatars and progress only.
- **`rounded-lg`/`rounded-xl`** for panels, cards, dialogs. No `rounded-2xl`.
- Active navigation: rail items get a 2px primary bar on the left; header
  section menus get a 2px primary underline on the header's bottom border.
- Prefer ruled lists (`border-t` + `border-b` rows) over a grid of identical cards.

## Layout

- Shell: sticky 56px header with section menus (`SiteHeader`), floating icon rail
  (`AppRail`), page in `main`. Do not add page-level sidebars that duplicate nav.
- App page container: `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8`.
  Reading pages: three panes (chapter tree, ~44rem content, "On this page").
- Marketing content: `max-w-6xl`; each section is a ruled band (`border-t`) with
  a numbered mono label and a sans display title, `py-16 sm:py-20`. Feature lists
  are ruled (icon inline with the title, `border-t pt-4`), not card grids.
  Headers are solid `bg-background`, no backdrop blur. Overlays are `bg-black/50`.
- 4px spacing base. Inputs and default buttons 36px (`sm` 32px, `lg` 40px); hero CTAs 44px.

## Components (patterns to reuse)

- **Feature card**: `MiniDiagram` thumbnail (`src/components/marketing/mini-diagrams.tsx`)
  on the left or top, title, one-line muted description, optional "New" pill.
- **Grouped table**: `rounded-xl border bg-card`, collapsible header with a
  progress bar (`bg-muted h-1.5` track, `bg-brand-500` fill), muted 12px
  column headers, 12px row padding, `divide-y`. See `PatternGroupTable`.
- **Progress card**: right-rail `bg-card rounded-xl border p-4` with per-row
  bars.
- **Stat tile**: `StatTile` in `components/common`.
- **Tabs in a pane**: underline style with an indigo bar under the active tab
  (see `PaneTab` in `problem-workspace.tsx`).
- **Empty states**: `EmptyState`. Never a dead end: always a next step.
- **Section heading**: `SectionHeading` (`components/common`): title, optional
  count and description over a hairline. Used across Campus.
- **Campus**: `CampusTrail` breadcrumb in the `PageHeader` eyebrow; a ruled stat
  strip rather than tiles; `NativeSelect` for plain dropdowns in forms.
- **Admin tables**: `bg-card border-border overflow-x-auto rounded-lg border`
  around a `min-w-[48rem]` table, mono column labels, `px-4 py-2.5` cells.
  `Pagination` takes a `noun` so the count names what the list holds.
- **Problem page on phones**: the server picks the first layout from
  `Sec-CH-UA-Mobile` or the user agent (`isLikelyMobileRequest`), so a phone gets
  tabs on first paint rather than swapping after hydration. iPads get the desktop
  layout. The media query still has the final say, so a narrowed desktop window
  switches to tabs after load.

## Rules

- Do keep indigo as the only action colour; cyan (`text-info`) is for links in lists.
- Don't append `→` to links or buttons; underline text links instead.
- Navigation comes from `navForViewer(viewer)` in `src/lib/navigation.ts`; staff
  links are listed for admins only. Pages still enforce access themselves.
- Do keep visualization colours inside diagrams.
- Don't put difficulty in filled pills.
- Don't introduce pricing, upgrade, premium or paywall language. Tech Epitome is free.
- Every control keeps an accessible name; never remove focus rings.
- Mobile first: no horizontal page scroll at 390px; tables scroll inside their card.
