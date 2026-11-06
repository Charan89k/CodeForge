"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { surfaceForPath } from "@/lib/navigation";

/**
 * Sets the surface the design tokens key off. The attribute on this element is
 * correct on first paint; the copy on <html> is for dialogs and menus, which
 * render in a portal outside this element and only open after hydration.
 */
export function ShellSurface({ children }: { children: React.ReactNode }) {
  const surface = surfaceForPath(usePathname());

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.surface = surface;
    return () => {
      delete root.dataset.surface;
    };
  }, [surface]);

  return (
    <div
      data-surface={surface}
      className="flex min-h-full flex-1 flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}
