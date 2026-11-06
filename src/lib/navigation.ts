import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Bookmark,
  Building2,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  Highlighter,
  Library,
  LayoutDashboard,
  ListChecks,
  Medal,
  MessagesSquare,
  Network,
  PlayCircle,
  Repeat2,
  Route,
  Shapes,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";

import { canAccess, FEATURES, type Feature } from "@/lib/auth/access";

/**
 * Application navigation, defined once as data.
 *
 * The sidebar, the command palette and the mobile drawer all read this, so a
 * new section appears everywhere at once and cannot be half-added.
 *
 * This list contains only routes that exist. Sections belonging to later
 * phases (Behavioral, Companies) are added
 * here as they ship - a nav entry that 404s is the same broken promise as a
 * "coming soon" button. The roadmap lives in README.md, not in the UI.
 */

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Feature gate. Omitted means visible to every signed-in user. */
  feature?: Feature;
  /** Short description, used by the command palette. */
  description?: string;
  /** Match child routes for active state. Defaults to true. */
  matchNested?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const primaryNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        matchNested: false,
        description: "Your progress, streak and what to do next",
      },
      {
        title: "Review",
        href: "/review",
        icon: Repeat2,
        description: "Recall what you have learned, before you forget it",
      },
    ],
  },
  {
    label: "Practice",
    items: [
      {
        title: "Problems",
        href: "/problems",
        icon: ListChecks,
        description: "Search and filter the catalogue, solve, track attempts",
      },
      {
        title: "Daily Challenge",
        href: "/daily",
        icon: CalendarCheck,
        description: "One problem a day, the same for everyone",
      },
      {
        title: "Contests",
        href: "/contests",
        icon: Trophy,
        description: "Timed problem sets with live standings",
      },
      {
        title: "Leaderboard",
        href: "/leaderboard",
        icon: Medal,
        description: "Learners who chose to be listed, ranked by problems solved",
      },
      {
        title: "Live Visualizer",
        href: "/visualize",
        icon: PlayCircle,
        feature: FEATURES.VISUALIZE,
        description: "Step through algorithms frame by frame, or your own code",
      },
    ],
  },
  {
    // Individual learning: concepts, patterns and problems in one section.
    label: "Learn",
    items: [
      {
        title: "All courses",
        href: "/learn",
        icon: Library,
        description: "Search every course and chapter, with your progress",
        matchNested: false,
      },
      {
        title: "DSA",
        href: "/learn/dsa",
        icon: GraduationCap,
        description: "Structured data structures and algorithms curriculum",
      },
      {
        title: "System Design",
        href: "/learn/system-design",
        icon: Network,
        description: "Scale, latency, replication and the trade-offs between them",
      },
      {
        title: "Low-Level Design",
        href: "/learn/lld",
        icon: Blocks,
        description: "Responsibilities, SOLID, and the patterns worth knowing",
      },
      {
        title: "Patterns",
        href: "/patterns",
        icon: Shapes,
        feature: FEATURES.PATTERNS,
        description: "Recognise the shape of a problem",
      },
      {
        title: "Design Exercises",
        href: "/system-design",
        icon: Boxes,
        description: "Draw an architecture, submit it, compare against the reference",
      },
      {
        title: "LLD Exercises",
        href: "/lld",
        icon: Blocks,
        description: "Design the classes, defend the trade-offs",
      },
      {
        title: "AI Tutor",
        href: "/ai-tutor",
        icon: Sparkles,
        feature: FEATURES.AI_TUTOR,
        description:
          "Work through what you are stuck on, without being handed the answer",
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        title: "Bookmarks",
        href: "/dashboard/bookmarks",
        icon: Bookmark,
        description: "Everything you saved",
      },
      {
        title: "Notes",
        href: "/dashboard/notes",
        icon: FileText,
        description: "Your notes, searchable",
      },
      {
        title: "Highlights",
        href: "/dashboard/highlights",
        icon: Highlighter,
        description: "Everything you marked while reading",
      },
    ],
  },
  {
    label: "Staff",
    items: [
      {
        title: "Admin",
        href: "/admin",
        icon: ShieldCheck,
        // The only nav item behind a role. `canAccess` returns false for
        // every non-admin, so the group renders empty and disappears
        // rather than showing something that 403s.
        feature: FEATURES.ADMIN,
        description: "Users, content, AI usage and the audit log",
      },
    ],
  },
];

/**
 * The two products. Learn is public; Campus belongs to a college. The path
 * decides which navigation shows, so each reads as its own product.
 */
export type Product = "learn" | "campus";

const CAMPUS_PATHS = ["/campus", "/interviews", "/prepare", "/roadmaps"];

export function productForPath(pathname: string): Product {
  return CAMPUS_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ? "campus"
    : "learn";
}

/**
 * The visual surface a page belongs to, which is finer than the product:
 * Learn reads as a warm publication, while the coding workspaces and the
 * visualizer stay dark developer tools. Only tokens differ, so it is CSS's
 * concern; see `[data-surface]` in globals.css.
 */
export type Surface = "learn" | "campus" | "admin" | "workspace" | "lab";

const WORKSPACE_PATHS = /^\/(problems|system-design|lld)\/[^/]+/;

export function surfaceForPath(pathname: string): Surface {
  if (productForPath(pathname) === "campus") return "campus";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/visualize" || pathname.startsWith("/visualize/")) return "lab";
  return WORKSPACE_PATHS.test(pathname) ? "workspace" : "learn";
}

/** The viewer's college, if any: the one faculty work happens in comes first. */
export type NavCampus = {
  slug: string;
  role: "STUDENT" | "FACULTY" | "INSTITUTION_ADMIN" | "PLACEMENT_OFFICER";
};

/**
 * What a given viewer should see. This only hides links; admin pages call
 * `requireAdmin` and Campus pages `requireCampusUser` or `requireMember`.
 */
export type NavViewer = {
  role: "USER" | "ADMIN";
  campusMember?: boolean;
  campus?: NavCampus | null;
} | null;

function campusNav(viewer: NavViewer): NavGroup[] {
  const member = viewer?.role === "ADMIN" || Boolean(viewer?.campusMember);
  const college = viewer?.campus ?? null;
  const groups: NavGroup[] = [
    {
      label: "Campus",
      items: [
        {
          title: college ? "My College" : "Campus",
          href: college ? `/campus/${college.slug}` : "/campus",
          icon: Building2,
          description: "Your college: classes, assignments and exams",
        },
      ],
    },
  ];
  if (!member) return groups;

  if (college && (college.role === "FACULTY" || college.role === "INSTITUTION_ADMIN")) {
    groups.push({
      label: "Teaching",
      items: [
        {
          title: "Question Banks",
          href: `/campus/${college.slug}/banks`,
          icon: Library,
          description: "Multiple-choice and coding questions for your exams",
        },
        {
          title: "Analytics",
          href: `/campus/${college.slug}/analytics`,
          icon: ChartColumn,
          description: "Participation and scores by class",
        },
        {
          title: "Import Roster",
          href: `/campus/${college.slug}/import`,
          icon: Upload,
          description: "Invite a class from a CSV",
        },
      ],
    });
  }

  groups.push(
    {
      label: "Practice",
      items: [
        {
          title: "Exams",
          href: "/campus/exams",
          icon: ClipboardList,
          description: "Upcoming and past exams across your classes",
        },
        {
          title: "DSA Practice",
          href: "/campus/practice",
          icon: ListChecks,
          description: "Patterns and problems, with your progress",
        },
        {
          title: "Aptitude",
          href: "/campus/aptitude",
          icon: Calculator,
          description: "Quantitative, logical and verbal practice sets",
        },
      ],
    },
    {
      label: "Placement",
      items: [
        ...(college
          ? [
              {
                title:
                  college.role === "STUDENT" || college.role === "FACULTY"
                    ? "Placement Drives"
                    : "Placement Office",
                href: `/campus/${college.slug}/placement`,
                icon: BriefcaseBusiness,
                description: "Drives, eligibility, applications and offers",
              },
            ]
          : []),
        {
          title: "Mock Interviews",
          href: "/interviews",
          icon: MessagesSquare,
          feature: FEATURES.AI_MOCK_INTERVIEW,
          description: "Practise an interview, then read feedback with evidence",
        },
        {
          title: "Interview Prep",
          href: "/prepare",
          icon: Compass,
          description: "Plans for the shapes interview loops come in",
        },
        {
          title: "Roadmaps",
          href: "/roadmaps",
          icon: Route,
          description: "What to learn, in what order, and where to practise it",
        },
      ],
    },
    {
      label: "Library",
      items: [
        {
          title: "Notes and Highlights",
          href: "/campus/library",
          icon: FileText,
          description:
            "Your notes, highlights and bookmarks. Your college cannot read them",
        },
      ],
    }
  );
  return groups;
}

export function navForViewer(
  viewer: NavViewer,
  product: Product = "learn"
): NavGroup[] {
  if (product === "campus") return campusNav(viewer);
  return primaryNav
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.feature !== FEATURES.ADMIN || canAccess(viewer, item.feature)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/** Flat list, for the command palette and active-route resolution. */
export const allNavItems: NavItem[] = primaryNav.flatMap((g) => g.items);

/** Public marketing navigation. */
export const marketingNav = [
  { title: "Problems", href: "/problems" },
  { title: "Courses", href: "/learn" },
  { title: "Visualizer", href: "/visualize" },
  { title: "Contests", href: "/contests" },
  { title: "Campus", href: "/campus/login" },
] as const;

/**
 * Whether a nav item should read as active for the current pathname.
 * Prefix match by default; `matchNested: false` pins it to an exact match so
 * a parent does not light up for a child that has its own entry.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === pathname) return true;
  if (item.matchNested === false) return false;
  return pathname.startsWith(`${item.href}/`);
}
