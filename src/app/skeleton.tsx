import type { ReactNode } from "react";

/** Grey placeholder for a block that's still loading. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-border/70 dark:bg-foreground/10 ${className}`} />;
}

/** Back link and title placeholders shared by every screen, then the screen's own blocks. */
export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <Bone className="h-4 w-28 rounded-md" />
      <Bone className="mt-3 h-8 w-56 rounded-md" />
      {children}
    </main>
  );
}

/** A bordered table with a few rows, for standings and settlement tables. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
          <Bone className="h-4 w-4 rounded-md" />
          <Bone className="h-4 flex-1 rounded-md" />
          <Bone className="h-4 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
