import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, ListChecks, type LucideIcon } from "lucide-react";

import { TutorPanel } from "@/components/tutor/tutor-panel";
import { DesignThumb } from "@/components/system-design/design-thumb";
import { requireUser } from "@/lib/auth/session";
import { labelFor } from "@/lib/tutor/context";
import { GLOBAL_QUICK_ACTIONS } from "@/lib/tutor/types";
import { loadContextBundle } from "@/services/tutor";

export const metadata: Metadata = {
  title: "AI Tutor",
  description:
    "Ask about anything in the curriculum. The tutor knows what you have studied.",
};

/**
 * The general tutor.
 *
 * Deliberately the least capable of the three entry points, and it says so.
 * A tutor that knows which chapter you are reading and what your code does
 * gives materially better help than one answering in the abstract, so this
 * page points at the contextual entry points rather than pretending to
 * replace them. It exists for the questions that genuinely span the
 * curriculum — "what should I study next", "why do I keep failing these" —
 * which is also why its context is the learner's progress rather than a
 * page.
 */
export default async function AiTutorPage() {
  const user = await requireUser("/ai-tutor");

  const bundle = await loadContextBundle({ kind: "GLOBAL" }, user.id);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row">
      <Link
        href="/ai-tutor/history"
        className="text-sm font-medium text-info hover:text-brand-300 lg:hidden"
      >
        Your past conversations
      </Link>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <TutorPanel
          anchor={{ kind: "GLOBAL" }}
          label={
            bundle
              ? labelFor(bundle)
              : { contextType: "GLOBAL", primary: null, secondary: null, chips: [] }
          }
          quickActions={GLOBAL_QUICK_ACTIONS}
        />
      </div>

      <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto lg:block">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <DesignThumb kind="chat" className="h-28 w-full border-b border-border" />
          <div className="p-4">
            <h2 className="text-sm font-semibold">Better with context</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Open the tutor from inside a chapter or a problem and it reads what you
              are looking at — the lesson text, the problem, your code, and your last
              failing test.
            </p>
          </div>
        </div>

        <Link
          href="/ai-tutor/history"
          className="block px-1 text-sm font-medium text-info hover:text-brand-300"
        >
          Your past conversations
        </Link>

        <nav aria-label="Places to open the tutor" className="space-y-2">
          <ContextLink
            href="/learn/dsa"
            icon={GraduationCap}
            title="Open the curriculum"
            description="Ask about the chapter you are reading."
          />
          <ContextLink
            href="/problems"
            icon={ListChecks}
            title="Pick a problem"
            description="Get hints one rung at a time, and help with failing tests."
          />
        </nav>
      </aside>
    </div>
  );
}

function ContextLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: "/learn/dsa" | "/problems";
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-brand-500/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-300">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium transition-colors group-hover:text-brand-200">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
