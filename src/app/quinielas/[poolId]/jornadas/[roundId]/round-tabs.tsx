"use client";

import { useState, type ReactNode } from "react";

type Tab = "mine" | "everyone";

const TABS: [Tab, string][] = [
  ["mine", "Mis pics"],
  ["everyone", "Pics de todos"],
];

/**
 * Your picks and everyone's, once a match has locked. Opens on whichever is more useful
 * right now (the page decides). Your picks stay mounted when hidden so switching back
 * keeps the form as it was; everyone's picks mount when shown, so the table scrolls to
 * the next match and only polls ESPN while you're looking.
 */
export function RoundTabs({ initial, mine, everyone }: { initial: Tab; mine: ReactNode; everyone: ReactNode }) {
  const [tab, setTab] = useState(initial);

  return (
    <div className="mt-6">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 text-sm font-semibold">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 transition ${
              tab === id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div hidden={tab !== "mine"} className="mt-4">
        {mine}
      </div>
      {tab === "everyone" && everyone}
    </div>
  );
}
