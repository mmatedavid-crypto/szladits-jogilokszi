import { useState } from "react";
import type { CaseFile, PartyRole } from "@/lib/legal/types";
import {
  generateIntakeToken,
  getIntakeUrl,
  calculateIntakeCompletion,
} from "@/lib/legal/intake";
import { Button } from "@/components/ui/button";

export function IntakeLinkPanel({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4 mb-6">
      <header className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Adatbekérő linkek (ügyfél kitöltéshez)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Az ügyvéd elküldi a privát linket az eladónak és a vevőnek. A beérkező
            adatokból a rendszer szerződéstervezetet, hiányzó adat listát és
            ügyvédi ellenőrző listát készít. A végleges okiratot az ügyvéd ellenőrzi és
            ellenjegyzi.
          </p>
        </div>
      </header>
      <div className="grid md:grid-cols-2 gap-3">
        <RoleCard role="elado" label="Eladó adatlap" c={c} update={update} />
        <RoleCard role="vevo" label="Vevő adatlap" c={c} update={update} />
      </div>
    </section>
  );
}

function RoleCard({
  role,
  label,
  c,
  update,
}: {
  role: PartyRole;
  label: string;
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const status = c.intake[role];
  const completion = calculateIntakeCompletion(c, role);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    update((d) => {
      d.intake[role] = {
        token: generateIntakeToken(role),
        letrehozva: new Date().toISOString(),
        utoljaraMentve: "",
        beadva: false,
        beadvaIdo: "",
      };
    });
  };
  const regenerate = () => {
    if (!confirm("Új link generálása érvényteleníti a korábbit. Folytatja?")) return;
    generate();
  };
  const url = status.token ? getIntakeUrl(status.token) : "";
  const copy = () => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <StatusBadge status={status} />
      </div>

      {!status.token ? (
        <Button size="sm" variant="default" onClick={generate}>
          Adatbekérő link generálása
        </Button>
      ) : (
        <>
          <div className="flex gap-1 mb-2">
            <input
              readOnly
              value={url}
              className="flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs font-mono text-foreground"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? "Másolva" : "Másolás"}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/adatbekero/${status.token}`} target="_blank" rel="noreferrer">
                Megnyitás
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completion.szazalek}%` }}
              />
            </div>
            <span className="text-muted-foreground font-mono w-24 text-right">
              {completion.szazalek}% kész ({completion.kitoltott}/{completion.osszes})
            </span>
          </div>
          {completion.hianyok.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Hiányzó adatok ({completion.hianyok.length})
              </summary>
              <ul className="mt-1 pl-4 list-disc space-y-0.5 text-foreground/80">
                {completion.hianyok.slice(0, 10).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
                {completion.hianyok.length > 10 && (
                  <li className="text-muted-foreground">
                    +{completion.hianyok.length - 10} további
                  </li>
                )}
              </ul>
            </details>
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={regenerate}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Új link generálása
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CaseFile["intake"]["elado"] }) {
  if (!status.token) {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
        Nincs link
      </span>
    );
  }
  if (status.beadva) {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary text-primary-foreground">
        Beküldve
      </span>
    );
  }
  if (status.utoljaraMentve) {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-accent-foreground">
        Kitöltés alatt
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
      Elküldhető
    </span>
  );
}
