import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Szladits Magánjogi Asszisztens" },
      {
        name: "description",
        content:
          "Ügyvédi munkát támogató magánjogi asszisztens: adatbekérő linkek, klauzula review report, szerződéstervezet és ügyvédi ellenőrző lista egy strukturált munkafelületen.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setSignedIn(!!data?.user);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const openAssistant = () => {
    if (signedIn) navigate({ to: "/app" });
    else navigate({ to: "/auth" });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader signedIn={signedIn} onOpenAssistant={openAssistant} />

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Belső tesztverzió ügyvédi irodáknak
            </div>
            <h1 className="mt-6 font-display text-4xl leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Ügyvédi munkát támogató<br />magánjogi asszisztens.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Adatbekérő linkek, klauzula review report, szerződéstervezet és ügyvédi
              ellenőrző lista egy strukturált munkafelületen. Az AI javasol — Ön dönt.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={openAssistant}>
                Asszisztens megnyitása →
              </Button>
              {!signedIn && (
                <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                  Bejelentkezés / regisztráció
                </Link>
              )}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              🔒 Ügyvédi titoktartás · EU-szerverek · fiókhoz kötött tárolás
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="Adatbekérő linkek"
              body="Ügyfeleit strukturált kérdőívekkel gyűjtheti be. Válaszok áttekinthetően, ügyre szabva."
            />
            <FeatureCard
              title="Klauzula review report"
              body="Klauzulák elemzése, kockázatok azonosítása, javaslatok és hivatkozások átlátható jelentésben."
            />
            <FeatureCard
              title="Szerződéstervezet"
              body="Ügyre szabott szerződéstervezet készítése sablonok és intelligens segítség alapján."
            />
            <FeatureCard
              title="Ügyvédi ellenőrző lista"
              body="Lépésről lépésre vezetett ellenőrzési folyamat. Semmi fontos ne maradjon ki."
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <Mark title="Megbízható" body="Biztonság és szakértelem." />
            <Mark title="Precíz" body="Struktúra és átláthatóság." />
            <Mark title="Intelligens" body="AI támogatás, emberi kontroll." />
            <Mark title="Diszkrét" body="Visszafogott, professzionális megjelenés." />
          </div>
        </div>
      </section>

      <section className="bg-card border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">
            Próbálja ki az asszisztenst.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Az asszisztens használatához bejelentkezés szükséges. Az ügyei és a kitöltött adatok a fiókjához kötve maradnak meg.
          </p>
          <div className="mt-8">
            <Button size="lg" onClick={openAssistant}>
              Asszisztens megnyitása →
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SiteHeader({ signedIn, onOpenAssistant }: { signedIn: boolean | null; onOpenAssistant: () => void }) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Monogram />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-xl text-foreground">Szladits</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Magánjogi Asszisztens
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {signedIn === false && (
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Bejelentkezés
            </Link>
          )}
          <Button size="sm" onClick={onOpenAssistant}>
            Asszisztens megnyitása
          </Button>
        </div>
      </div>
    </header>
  );
}

function Monogram() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-accent shadow-sm">
      <span className="font-display text-lg leading-none">S</span>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-6">
      <div className="mb-4 h-8 w-8 rounded-full border border-accent/40 bg-accent/5 flex items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </div>
      <h3 className="font-display text-lg text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Mark({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col">
      <div className="h-px w-12 bg-accent mb-3" />
      <div className="font-display text-base text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{body}</div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Monogram />
          <div className="font-display text-sm text-foreground">
            Szladits <span className="text-muted-foreground"> · JOG. STRUKTÚRA. INTELLIGENCIA.</span>
          </div>
        </div>
        <div>© {new Date().getFullYear()} Szladits Magánjogi Asszisztens. Minden jog fenntartva.</div>
      </div>
    </footer>
  );
}
