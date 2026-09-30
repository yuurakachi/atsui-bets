"use client";

import { useState } from "react";

interface Props {
  title: string;
  status: string;
  message: string;
}

/** Ready-to-send group message: opens WhatsApp to pick the chat, or copies it. */
export function ReminderCard({ title, status, message }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{status}</span>
      </p>
      <pre className="mt-3 rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm whitespace-pre-wrap break-words">
        {message}
      </pre>
      <div className="mt-3 flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-center font-semibold text-accent-foreground"
        >
          Mandar por WhatsApp
        </a>
        <button type="button" onClick={copy} className="rounded-lg border border-border px-3 py-2 transition hover:border-accent">
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
