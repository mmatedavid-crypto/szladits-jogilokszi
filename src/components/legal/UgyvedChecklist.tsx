import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { CaseFile } from "@/lib/legal/types";
import { detectMissingFields, generateRiskFlags } from "@/lib/legal/logic";

interface Props {
  c: CaseFile;
  onClose: () => void;
}

type CheckItem = {
  label: string;
  done: boolean;
  hint?: string;
};

export function UgyvedChecklist({ c, onClose }: Props) {
  const missing = useMemo(() => detectMissingFields(c), [c]);
  const risks = useMemo(() => generateRiskFlags(c), [c]);

  const tartalmi: CheckItem[] = [
    {
      label: "Ügyazonosító kitöltve",
      done: !!c.ugyAzonosito.trim(),
      hint: "Pl. 2026-001 — a saját iktatási rendszered szerint.",
    },
    {
      label: "Eljáró ügyvéd neve a sajátod (nem a demo dr. Szladits Anna)",
      done:
        !!c.eljaroUgyved.nev.trim() &&
        !/szladits anna/i.test(c.eljaroUgyved.nev),
      hint: "Cseréld a saját nevedre, hogy az ellenjegyzési blokk hitelesen nézzen ki.",
    },
    {
      label: "KASZ szám kitöltve (saját)",
      done:
        !!c.eljaroUgyved.kaszSzam.trim() &&
        c.eljaroUgyved.kaszSzam !== "36071234",
    },
    {
      label: "Iroda neve és címe kitöltve",
      done:
        !!c.eljaroUgyved.iroda.trim() && !!c.eljaroUgyved.irodaCim.trim(),
    },
    {
      label: "Legalább egy eladó és egy vevő felvéve",
      done:
        c.parties.some((p) => p.szerep === "elado") &&
        c.parties.some((p) => p.szerep === "vevo"),
    },
    {
      label: "Ingatlan helyrajzi száma és címe megadva",
      done:
        !!c.property.helyrajziSzam.trim() &&
        !!c.property.cim.trim() &&
        !!c.property.telepules.trim(),
    },
    {
      label: "Vételár megadva",
      done: !!c.payment.teljesVetelar.trim(),
    },
    {
      label: "Nincs kritikus hiányzó mező",
      done: missing.length === 0,
      hint:
        missing.length > 0
          ? `${missing.length} hiányzó mező — nézd át a jobb oldali "Hiányzó adatok" panelt.`
          : undefined,
    },
    {
      label: "Magas/kritikus kockázati flagek átnézve",
      done: !risks.some(
        (r) => r.severity === "magas" || r.severity === "kritikus",
      ),
      hint: risks.some(
        (r) => r.severity === "magas" || r.severity === "kritikus",
      )
        ? "Van magas vagy kritikus szintű flag — nézd át, mielőtt elküldöd."
        : undefined,
    },
  ];

  const technikai: CheckItem[] = [
    {
      label: "Szerződéstervezet generálva és átfutva",
      done: false,
      hint: "Menj a 7. lépésre, generálj le mindent, és olvasd át legalább egyszer.",
    },
    {
      label: "Word (.docx) export tesztelve",
      done: false,
      hint: "Töltsd le a .docx-et és nyisd meg Wordben — ellenőrizd a formázást.",
    },
    {
      label: "B400, Pmt. adatlap, illetékkalkuláció PDF letöltve",
      done: false,
      hint: "A 'Speciális modulok' fülön — generáld le legalább egyszer, hogy lásd a kimenetet.",
    },
    {
      label: "Jogi asszisztens (AI) kipróbálva 1-2 kérdéssel",
      done: false,
      hint: "Pl. „Milyen kockázatai vannak ennek az ügyletnek?”",
    },
  ];

  const jogiDisclaimer: CheckItem[] = [
    {
      label: "Tudatosítva: ez TERVEZET, nem helyettesíti az ügyvédi munkát",
      done: false,
    },
    {
      label:
        "Tudatosítva: tulajdoni lap, térképmásolat, cégkivonat, gyámhatósági határozat → ügyvédi feladat",
      done: false,
    },
    {
      label: "Tudatosítva: a JÜB lekérdezés MOCK (nem éles)",
      done: false,
    },
    {
      label:
        "Tudatosítva: adatok jelenleg localStorage-ban — éles használathoz GDPR-kompatibilis tárolás kell",
      done: false,
    },
  ];

  const kerdesek = [
    "Hiányzik-e a szerződéstervezetből olyan kötelező klauzula, amit te mindig beleteszel?",
    "A Pmt. átvilágítási adatlap, B400, illetékkalkuláció mezői megfelelnek a gyakorlatnak?",
    "Hol illeszthető be a saját ügymenetedbe (ügyfélfelvétel? első konzultáció után? szerződéskötés előtt?)",
    "Milyen kockázatokat nem mernél rábízni egy ilyen eszközre?",
    "Érdemes lenne-e valódi TAKARNET / JÜB integrációt építeni, vagy maradjon segédeszköz?",
  ];

  const Section = ({
    title,
    items,
  }: {
    title: string;
    items: CheckItem[];
  }) => (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span
              className={`mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                it.done
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-card"
              }`}
              aria-hidden
            >
              {it.done ? "✓" : ""}
            </span>
            <span className="flex-1">
              <span className={it.done ? "text-foreground" : "text-foreground"}>
                {it.label}
              </span>
              {it.hint && (
                <span className="block text-muted-foreground mt-0.5">
                  {it.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const automataKitoltottek = tartalmi.filter((i) => i.done).length;
  const automataOsszesen = tartalmi.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-lg bg-card border border-border shadow-xl my-4">
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
          <div>
            <div className="font-semibold">
              Mielőtt elküldöd az ügyvédednek
            </div>
            <div className="text-[11px] opacity-80">
              Automatikus ellenőrzés + manuális checklist
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-primary-foreground/80 hover:text-primary-foreground text-2xl leading-none px-2"
            aria-label="Bezárás"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
            <strong>Automatikus tartalmi ellenőrzés:</strong>{" "}
            {automataKitoltottek}/{automataOsszesen} rendben.
            {automataKitoltottek < automataOsszesen && (
              <span className="text-muted-foreground">
                {" "}
                A pirossal jelölt pontokat töltsd ki, mielőtt elküldöd.
              </span>
            )}
          </div>

          <Section title="1. Tartalmi előkészítés (automatikus)" items={tartalmi} />
          <Section title="2. Technikai teszt (manuális — pipáld le magadnak)" items={technikai} />
          <Section title="3. Jogi disclaimer (tudatosítsd magadban)" items={jogiDisclaimer} />

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              4. Kérdések, amiket érdemes feltenni az ügyvédnek
            </h3>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-foreground">
              {kerdesek.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>

          <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs">
            <strong className="text-accent">Tipp:</strong> publikáld a projektet
            (jobb felső sarok → Publish), és küldj linket képernyőkép helyett.
            A noindex meta már be van állítva, az oldal nem indexelődik.
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Bezárás
          </Button>
        </div>
      </div>
    </div>
  );
}
