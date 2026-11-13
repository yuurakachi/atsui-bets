"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./push-actions";

type State =
  | { kind: "loading" }
  /** iPhone in Safari: notifications only work once the app is on the home screen. */
  | { kind: "install" }
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; subscription: PushSubscription };

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function initialState(): Promise<State> {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !installed) return { kind: "install" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "blocked" };
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? { kind: "on", subscription } : { kind: "off" };
}

/** Turns phone notifications on or off for this phone. */
export function PushToggle() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    initialState().then(setState, () => setState({ kind: "unsupported" }));
  }, []);

  if (!VAPID_PUBLIC_KEY || state.kind === "loading" || state.kind === "unsupported") return null;

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // Must run from the tap: iPhones only ask for permission after a user gesture.
      if ((await Notification.requestPermission()) !== "granted") {
        setState({ kind: "blocked" });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      const saved = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setMessage(saved.message);
      if (saved.ok) setState({ kind: "on", subscription });
      else await subscription.unsubscribe();
    } catch {
      setMessage("No se pudieron activar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (subscription: PushSubscription) => {
    setBusy(true);
    setMessage(null);
    try {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
      setState({ kind: "off" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface px-4 py-3">
      <p className="font-medium">Notificaciones</p>
      {state.kind === "install" && (
        <p className="mt-1 text-sm text-muted">
          En iPhone, primero instala la app: en Safari toca Compartir y luego “Agregar a pantalla de inicio”. Ábrela
          desde ahí para activar los avisos.
        </p>
      )}
      {state.kind === "blocked" && (
        <p className="mt-1 text-sm text-muted">
          Están bloqueadas en este celular. Permítelas en los ajustes del navegador para Atsui bets.
        </p>
      )}
      {state.kind === "off" && (
        <>
          <p className="mt-1 text-sm text-muted">
            Te avisamos cuando se abren los pics, 10 minutos antes de que cierren si te falta alguno, y quién ganó.
          </p>
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-accent px-3 py-2 font-semibold text-accent-foreground disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar notificaciones"}
          </button>
        </>
      )}
      {state.kind === "on" && (
        <p className="mt-1 flex items-center justify-between gap-3 text-sm text-muted">
          <span>Activadas en este celular.</span>
          <button
            type="button"
            onClick={() => turnOff(state.subscription)}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-muted underline hover:text-foreground disabled:opacity-60"
          >
            Desactivar
          </button>
        </p>
      )}
      {message && <p className="mt-2 text-sm">{message}</p>}
    </section>
  );
}
