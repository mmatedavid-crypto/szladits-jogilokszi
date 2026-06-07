import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Bejelentkezés — Szladits Magánjogi Asszisztens" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Ha valaki már be van lépve, vigyük a Workspace-be.
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) navigate({ to: "/app", replace: true });
    })();
  }, [navigate]);

  const onOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + "/app",
      });
      if (result.error) {
        setError(result.error.message || "A bejelentkezés nem sikerült.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-16">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Vissza a főoldalra
        </a>

        <div className="mt-10 rounded-md border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-3xl text-foreground">Bejelentkezés</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Az asszisztens használatához bejelentkezés szükséges. Az ügyei a fiókjához kötve, biztonságosan tárolódnak.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              {busy ? "Folyamatban…" : "Bejelentkezés Google fiókkal"}
            </button>

            <button
              type="button"
              disabled
              title="Az Apple bejelentkezés konfigurációra vár — Services ID, Team ID, Key ID és Sign in with Apple kulcs szükséges."
              className="w-full inline-flex items-center justify-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
            >
              <AppleIcon />
              Bejelentkezés Apple fiókkal
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 ml-2">
                hamarosan
              </span>
            </button>

            {error && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            A bejelentkezéssel elfogadja az ügyvédi titoktartásra és adatkezelésre vonatkozó belső szabályzatot. A rendszer tesztverzió — éles használathoz külön szerződés szükséges.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.97 8.97 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.36 1.43c0 1.14-.41 2.21-1.24 3.21-1 1.18-2.21 1.87-3.52 1.76-.02-.13-.04-.27-.04-.41 0-1.1.47-2.27 1.3-3.24.42-.5.95-.91 1.6-1.24.65-.32 1.27-.5 1.85-.54l.05.46zM21 17.45c-.45 1.06-.99 2.04-1.62 2.95-.86 1.24-1.57 2.1-2.11 2.58-.83.79-1.74 1.2-2.7 1.22-.69 0-1.52-.2-2.49-.6-.97-.4-1.86-.6-2.68-.6-.86 0-1.78.2-2.76.6-.97.4-1.76.61-2.36.63-.93.04-1.84-.38-2.74-1.25-.58-.51-1.32-1.4-2.21-2.66-.95-1.35-1.74-2.91-2.36-4.68-.66-1.92-.99-3.78-.99-5.58 0-2.07.45-3.85 1.34-5.34A7.8 7.8 0 0 1 5.05 2c1.18-.7 2.45-1.06 3.82-1.08.74 0 1.7.23 2.9.67 1.19.45 1.95.68 2.28.68.25 0 1.1-.27 2.53-.8 1.36-.49 2.5-.7 3.44-.62 2.55.21 4.47 1.21 5.74 3.03-2.28 1.38-3.41 3.31-3.39 5.79.02 1.93.72 3.54 2.1 4.82.62.59 1.32 1.05 2.1 1.38-.17.5-.35.97-.54 1.42z"/>
    </svg>
  );
}
