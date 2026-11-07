"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Filters sit beside the results on a wide screen and fold away on a phone. */
export function FilterDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full lg:hidden"
        aria-expanded={open}
        aria-controls="library-filters"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filters
        {activeCount > 0 && <span className="tabular-nums">({activeCount})</span>}
      </Button>
      <div
        id="library-filters"
        className={cn(open ? "block" : "hidden", "mt-4 lg:mt-0 lg:block")}
      >
        {children}
      </div>
    </div>
  );
}
