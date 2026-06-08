import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CaseFile } from "@/lib/legal/types";
import { detectMissingFields, generateRiskFlags } from "@/lib/legal/logic";

interface Props {
  c: CaseFile;
  onClose: () => void;
}

type Priority = "magas" | "kozepes" | "alacsony";
type Status = "kesz" | "folyamatban" | "hatralevo";

type Task = {
  id: string;
  label: string;
  hint?: string;
  priority: Priority;
  /** auto = state derived from CaseFile, manual = user toggled */
  kind: "auto" | "manual";
  done: boolean;
};

type Group = {
  id: string;
  title: string;
  subtitle?: string;
  tasks: Task[];
};

const MANUAL_KEY = "ugyved-checklist-manual-v1";

function loadManual(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(MANUAL_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveManual(state: Record<string, boolean>) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function UgyvedChecklist({ c, onClose }: Props) {
  const missing = useMemo(() => detectMissingFields(c), [c]);
  const risks = useMemo(() => generateRiskFlags(c), [c]);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setManual(loadManual());
  }, []);

  const toggleManual = (id: string) => {
    setManual((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveManual(next);
      return next;
    });
  };

  const groups: Group[] = useMemo(() => {
    const tartalmi: Task[] = [
      {
        id: "ugyazonosito",
        label: "Ügyazonosító kitöltve",
        hint: "Pl. 2026-001 — a saját iktatási rendszered szerint.",
        priority: "kozepes",
        kind: "auto",
        done: !!c.ugyAzonosito.trim(),
      },
      {
        id: "ugyved-nev",
        label: "Eljáró ügyvéd a sajátod (nem a demo dr. Szladits Anna)",
        hint: "Cseréld a saját nevedre — különben az ellenjegyzés blokk nem hiteles.",
        priority: "magas",
        kind: "auto",
        done:
          !!c.eljaroUgyved.nev.trim() &&
          !/szladits anna/i.test(c.eljaroUgyved.nev),
      },
      {
        id: "kasz",
        label: "KASZ szám kitöltve (saját)",
        priority: "magas",
        kind: "auto",
        done:
          !!c.eljaroUgyved.kaszSzam.trim() &&
          c.eljaroUgyved.kaszSzam !== "36071234",
      },
      {
        id: "iroda",
        label: "Iroda neve és címe kitöltve",
        priority: "kozepes",
        kind: "auto",
        done:
          !!c.eljaroUgyved.iroda.trim() && !!c.eljaroUgyved.irodaCim.trim(),
      },
      {
        id: "felek",
        label: "Legalább egy eladó és egy vevő felvéve",
        priority: "magas",
        kind: "auto",
        done:
          c.parties.some((p) => p.szerep === "elado") &&
          c.parties.some((p) => p.szerep === "vevo"),
      },
      {
        id: "ingatlan",
        label: "Ingatlan helyrajzi száma, címe, települése megadva",
        priority: "magas",
        kind: "auto",
        done:
          !!c.property.helyrajziSzam.trim() &&
          !!c.property.cim.trim() &&
          !!c.property.telepules.trim(),
      },
      {
        id: "vetelar",
        label: "Vételár megadva",
        priority: "magas",
        kind: "auto",
        done: !!c.payment.teljesVetelar.trim(),
      },
      {
        id: "missing",
        label: "Nincs kritikus hiányzó mező",
        hint:
          missing.length > 0
            ? `${missing.length} hiányzó mező — nézd át a "Hiányzó adatok" panelt.`
            : undefined,
        priority: "magas",
        kind: "auto",
        done: missing.length === 0,
      },
      {
        id: "risks",
        label: "Magas/kritikus kockázati flagek átnézve",
        hint: risks.some(
          (r) => r.severity === "magas" || r.severity === "kritikus",
        )
          ? "Van magas/kritikus szintű flag — nézd át, mielőtt küldöd."
          : undefined,
        priority: "magas",
        kind: "auto",
        done: !risks.some(
          (r) => r.severity === "magas" || r.severity === "kritikus",
        ),
      },
    ];

    const technikai: Task[] = [
      {
        id: "m-tervezet",
        label: "Szerződéstervezet generálva és átfutva",
        hint: "Menj a 7. lépésre, generálj le mindent, és olvasd át legalább egyszer.",
        priority: "magas",
        kind: "manual",
        done: !!manual["m-tervezet"],
      },
      {
        id: "m-docx",
        label: "Word (.docx) export tesztelve",
        hint: "Töltsd le a .docx-et, nyisd meg Wordben, ellenőrizd a formázást.",
        priority: "kozepes",
        kind: "manual",
        done: !!manual["m-docx"],
      },
      {
        id: "m-modulok",
        label: "B400E/ONYA előkészítő, Pmt. adatlap, illetékkalkuláció PDF letöltve",
        hint: "A 'Speciális modulok' fülön — generáld le legalább egyszer.",
        priority: "kozepes",
        kind: "manual",
        done: !!manual["m-modulok"],
      },
      {
        id: "m-ai",
        label: "Jogi asszisztens (AI) kipróbálva 1-2 kérdéssel",
        hint: "Pl. „Milyen kockázatai vannak ennek az ügyletnek?”",
        priority: "alacsony",
        kind: "manual",
        done: !!manual["m-ai"],
      },
    ];

    const disclaimer: Task[] = [
      {
        id: "d-tervezet",
        label: "Tudatosítva: ez TERVEZET, nem helyettesíti az ügyvédi munkát",
        priority: "magas",
        kind: "manual",
        done: !!manual["d-tervezet"],
      },
      {
        id: "d-ugyvedi",
        label:
          "Tudatosítva: tulajdoni lap, térképmásolat, cégkivonat, gyámhatósági határozat → ügyvédi feladat",
        priority: "kozepes",
        kind: "manual",
        done: !!manual["d-ugyvedi"],
      },
      {
        id: "d-jub",
        label: "Tudatosítva: a JÜB lekérdezés MOCK (nem éles)",
        priority: "kozepes",
        kind: "manual",
        done: !!manual["d-jub"],
      },
      {
        id: "d-gdpr",
        label:
          "Tudatosítva: adatok jelenleg localStorage-ban — éles használathoz GDPR-kompatibilis tárolás kell",
        priority: "magas",
        kind: "manual",
        done: !!manual["d-gdpr"],
      },
    ];

    return [
      {
        id: "g-tartalmi",
        title: "Tartalmi előkészítés",
        subtitle: "Automatikus — az adatokból számolva",
        tasks: tartalmi,
      },
      {
        id: "g-technikai",
        title: "Technikai teszt",
        subtitle: "Manuális — pipáld le magadnak",
        tasks: technikai,
      },
      {
        id: "g-disclaimer",
        title: "Jogi disclaimer",
        subtitle: "Tudatosítsd, mielőtt küldöd",
        tasks: disclaimer,
      },
    ];
  }, [c, missing, risks, manual]);

  const kerdesek = [
    "Hiányzik-e a szerződéstervezetből olyan kötelező klauzula, amit te mindig beleteszel?",
    "A Pmt. átvilágítási adatlap, B400E/ONYA előkészítő és illetékkalkuláció mezői megfelelnek a gyakorlatnak?",
    "Hol illeszthető be a saját ügymenetedbe (ügyfélfelvétel? első konzultáció után? szerződéskötés előtt?)",
    "Milyen kockázatokat nem mernél rábízni egy ilyen eszközre?",
    "Érdemes lenne-e valódi TAKARNET / JÜB integrációt építeni, vagy maradjon segédeszköz?",
  ];

  const allTasks = groups.flatMap((g) => g.tasks);
  const done = allTasks.filter((t) => t.done).length;
  const total = allTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const blockers = allTasks.filter(
    (t) => !t.done && t.priority === "magas",
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-lg bg-card border border-border shadow-xl my-4 overflow-hidden">
        {/* Header — ClickUp style: title + meta + progress */}
        <div className="px-5 py-4 border-b border-border bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ügyvédi ellenőrző lista
              </div>
              <div className="font-semibold text-foreground mt-0.5">
                Mielőtt elküldöd az ügyvédednek
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-2xl leading-none px-1"
              aria-label="Bezárás"
            >
              ×
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <Stat label="Kész" value={`${done}/${total}`} tone="ok" />
            <Stat
              label="Blokkoló"
              value={String(blockers)}
              tone={blockers > 0 ? "bad" : "muted"}
            />
            <Stat label="Haladás" value={`${pct}%`} tone="muted" />
            <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
          {groups.map((g) => {
            const gDone = g.tasks.filter((t) => t.done).length;
            const isCollapsed = !!collapsed[g.id];
            return (
              <section key={g.id} className="bg-card">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [g.id]: !p[g.id] }))
                  }
                  className="w-full flex items-center gap-2 px-5 py-2.5 bg-secondary/40 hover:bg-secondary/60 border-b border-border text-left"
                >
                  <span className="text-xs text-muted-foreground w-3">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    {g.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {gDone}/{g.tasks.length}
                  </span>
                  {g.subtitle && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {g.subtitle}
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <ul>
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={
                          t.kind === "manual"
                            ? () => toggleManual(t.id)
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {/* Kérdések as a passive section */}
          <section className="bg-card">
            <div className="px-5 py-2.5 bg-secondary/40 border-b border-border">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Kérdések az ügyvédnek
              </span>
            </div>
            <ol className="list-decimal pl-10 pr-5 py-3 space-y-1.5 text-xs text-foreground">
              {kerdesek.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2 bg-card">
          <span className="text-[11px] text-muted-foreground">
            Tipp: publikáld a projektet és küldj linket képernyőkép helyett. A
            noindex meta már aktív.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Bezárás
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "bad" | "muted";
}) {
  const toneCls =
    tone === "ok"
      ? "text-primary"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${toneCls}`}>
        {value}
      </span>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle?: () => void;
}) {
  const status: Status = task.done ? "kesz" : "hatralevo";
  const interactive = !!onToggle;

  return (
    <li
      className={`group flex items-start gap-3 px-5 py-2.5 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors ${
        interactive ? "cursor-pointer" : ""
      }`}
      onClick={onToggle}
      role={interactive ? "button" : undefined}
    >
      {/* Checkbox */}
      <span
        className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
          task.done
            ? "bg-primary text-primary-foreground border-primary"
            : "border-input bg-card group-hover:border-primary/50"
        }`}
        aria-hidden
      >
        {task.done ? "✓" : ""}
      </span>

      {/* Label + hint */}
      <div className="flex-1 min-w-0">
        <div
          className={`text-xs ${
            task.done
              ? "text-muted-foreground line-through"
              : "text-foreground"
          }`}
        >
          {task.label}
        </div>
        {task.hint && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {task.hint}
          </div>
        )}
      </div>

      {/* Right side: priority + status pills */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <PriorityChip priority={task.priority} />
        <StatusChip status={status} kind={task.kind} />
      </div>
    </li>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  const map: Record<Priority, { label: string; cls: string }> = {
    magas: {
      label: "Magas",
      cls: "bg-destructive/10 text-destructive border-destructive/30",
    },
    kozepes: {
      label: "Közepes",
      cls: "bg-accent/15 text-accent-foreground border-accent/40",
    },
    alacsony: {
      label: "Alacsony",
      cls: "bg-muted text-muted-foreground border-border",
    },
  };
  const { label, cls } = map[priority];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function StatusChip({
  status,
  kind,
}: {
  status: Status;
  kind: "auto" | "manual";
}) {
  const map: Record<Status, { label: string; cls: string }> = {
    kesz: {
      label: "Kész",
      cls: "bg-primary/10 text-primary border-primary/30",
    },
    folyamatban: {
      label: "Folyamatban",
      cls: "bg-accent/15 text-accent-foreground border-accent/40",
    },
    hatralevo: {
      label: kind === "auto" ? "Hiányzik" : "Hátralévő",
      cls: "bg-muted text-muted-foreground border-border",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
