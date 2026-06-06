import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listCases,
  createCase,
  switchCase,
  deleteCase,
  duplicateCase,
  renameCase,
  getActiveCaseId,
  type CaseSummary,
} from "@/lib/legal/state";
import type { CaseFile } from "@/lib/legal/types";

interface Props {
  /** A jelenleg aktív CaseFile — azért kell, hogy az aktuálisan szerkesztett
   *  állapot biztosan ki legyen mentve váltás előtt. */
  current: CaseFile;
  /** A Workspace küldi be: kényszerített mentés (a debounced effect helyett). */
  saveCurrent: () => void;
  /** Új aktív ügy betöltése a Workspace state-be. */
  onLoaded: (c: CaseFile) => void;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CaseSwitcher({ current, saveCurrent, onLoaded }: Props) {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  const refresh = () => {
    setCases(listCases());
    setActiveId(getActiveCaseId());
  };

  useEffect(() => {
    refresh();
  }, [current]);

  const activeLabel =
    cases.find((x) => x.id === activeId)?.cimke ||
    current.cimke ||
    current.ugyAzonosito ||
    "Aktív ügy";

  const doSwitch = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    saveCurrent();
    const next = switchCase(id);
    if (next) onLoaded(next);
    setOpen(false);
  };

  const doNew = () => {
    saveCurrent();
    const c = createCase("Új ügy");
    onLoaded(c);
    setOpen(false);
  };

  const doDuplicate = (id: string) => {
    saveCurrent();
    const c = duplicateCase(id);
    if (c) onLoaded(c);
    refresh();
  };

  const doDelete = (id: string) => {
    const item = cases.find((x) => x.id === id);
    const name = item?.cimke || item?.ugyAzonosito || "az ügy";
    if (
      !window.confirm(
        `Biztosan törlöd: "${name}"?\nEz visszavonhatatlan — a hozzá tartozó minden adat elveszik.`,
      )
    )
      return;
    const fallback = deleteCase(id);
    if (id === activeId) {
      onLoaded(fallback ?? (createCase("Új ügy") as CaseFile));
    } else {
      refresh();
    }
  };

  const doRename = (id: string, oldLabel: string) => {
    const v = window.prompt("Ügy megnevezése:", oldLabel);
    if (v == null) return;
    renameCase(id, v);
    if (id === activeId) {
      // Frissítsük az aktív cimkét a Workspace state-ben is
      onLoaded({ ...current, cimke: v.trim() || current.cimke });
    } else {
      refresh();
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          refresh();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary-foreground/20"
      >
        <span className="opacity-70">Ügy:</span>
        <span className="font-semibold max-w-[200px] truncate">
          {activeLabel}
        </span>
        <span className="opacity-70 text-[10px]">
          ({cases.length || 1})
        </span>
        <span className="opacity-70">▾</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 z-50 w-[360px] rounded-md border border-border bg-card text-foreground shadow-xl">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Folyamatban lévő ügyek
              </span>
              <Button size="sm" variant="default" onClick={doNew}>
                + Új ügy
              </Button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
              {cases.length === 0 && (
                <li className="px-3 py-3 text-xs text-muted-foreground">
                  Még nincs mentett ügy.
                </li>
              )}
              {cases.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li
                    key={c.id}
                    className={`px-3 py-2 hover:bg-secondary/50 ${
                      isActive ? "bg-secondary/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => doSwitch(c.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {c.cimke}
                          </span>
                          {isActive && (
                            <span className="text-[10px] uppercase tracking-wider text-primary">
                              Aktív
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {c.ugyAzonosito
                            ? `Ügyazonosító: ${c.ugyAzonosito}`
                            : "Ügyazonosító nélkül"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Utolsó mentés: {formatDate(c.utoljaraMentve)}
                        </div>
                      </button>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => doRename(c.id, c.cimke)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          title="Átnevezés"
                        >
                          átnevez
                        </button>
                        <button
                          type="button"
                          onClick={() => doDuplicate(c.id)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                          title="Másolat készítése"
                        >
                          másol
                        </button>
                        <button
                          type="button"
                          onClick={() => doDelete(c.id)}
                          className="text-[11px] text-destructive hover:underline"
                          title="Törlés"
                        >
                          töröl
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
              Az ügyek a böngészőben (localStorage) tárolódnak. Éles
              használathoz GDPR-kompatibilis szerveroldali tárolás
              szükséges.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
