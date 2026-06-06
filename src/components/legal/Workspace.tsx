import { useEffect, useMemo, useState } from "react";
import {
  TRANSACTION_TYPE_LABELS,
  INTERNAL_FOOTER,
  type CaseFile,
  type Party,
  type TransactionType,
  type NaturalPerson,
  type Company,
  type ZartkertStatus,
  type Severity,
} from "@/lib/legal/types";
import {
  loadCase,
  saveCase,
  clearCase,
  emptyCase,
  demoCase,
  createCase,
  listCases,
  newId,
} from "@/lib/legal/state";
import {
  calculateAge,
  determineCapacityStatus,
  CAPACITY_LABEL,
  generateRiskFlags,
  detectMissingFields,
  generateAttachmentList,
  generateCaseSummary,
} from "@/lib/legal/logic";
import { generateContractDraft } from "@/lib/legal/contract";
import { Modulok } from "@/components/legal/Modulok";
import { JogiAsszisztens } from "@/components/legal/JogiAsszisztens";
import { UgyvedChecklist } from "@/components/legal/UgyvedChecklist";
import { IntakeLinkPanel } from "@/components/legal/IntakeLinkPanel";
import { CaseSwitcher } from "@/components/legal/CaseSwitcher";
import { Button } from "@/components/ui/button";


type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "1. Ügylet típusa" },
  { id: 2, label: "2. Felek" },
  { id: 3, label: "3. Ingatlan" },
  { id: 4, label: "4. Vételár és fizetés" },
  { id: 5, label: "5. Birtokbaadás" },
  { id: 6, label: "6. Speciális modulok" },
  { id: 7, label: "7. Kimenetek / tervezet" },
];

const SEVERITY_LABEL: Record<Severity, string> = {
  alacsony: "Alacsony",
  kozepes: "Közepes",
  magas: "Magas",
  kritikus: "Kritikus",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  alacsony: "var(--risk-low)",
  kozepes: "var(--risk-med)",
  magas: "var(--risk-high)",
  kritikus: "var(--risk-crit)",
};

export function Workspace() {
  const [c, setC] = useState<CaseFile>(() => emptyCase());
  const [step, setStep] = useState<StepId>(1);
  const [hydrated, setHydrated] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [outputTab, setOutputTab] =
    useState<"szerzodes" | "hianyzo" | "kockazat" | "mellekletek" | "osszefoglalo">(
      "szerzodes",
    );

  useEffect(() => {
    let loaded = loadCase();
    // Ha még nincs egyetlen mentett ügy sem, hozzunk létre egy újat,
    // hogy a CaseSwitcher tudjon közte és új ügyek között váltani.
    if (listCases().length === 0) {
      loaded = createCase("Új ügy");
    }
    setC(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveCase(c);
  }, [c, hydrated]);

  const risks = useMemo(() => generateRiskFlags(c), [c]);
  const missing = useMemo(() => detectMissingFields(c), [c]);
  const attachments = useMemo(() => generateAttachmentList(c), [c]);
  const summary = useMemo(() => generateCaseSummary(c), [c]);
  const contract = useMemo(() => generateContractDraft(c), [c]);

  const update = (fn: (draft: CaseFile) => void) => {
    setC((prev) => {
      const copy: CaseFile = JSON.parse(JSON.stringify(prev));
      fn(copy);
      return copy;
    });
  };

  const handleLoadDemo = () => {
    // A demo adatok az aktuális ügybe töltődnek (megőrizve az id-t),
    // hogy ne hozzon létre minden klikk új duplikátumot.
    const demo = demoCase();
    demo.id = c.id;
    demo.cimke = "Demo — Kovács / Szabó";
    setC(demo);
  };
  const handleClear = () => {
    // Csak az aktív ügyet törli.
    clearCase();
    // Töltsünk be valamit, hogy ne maradjon árva állapot.
    const remaining = listCases();
    if (remaining.length > 0) {
      setC(loadCase());
    } else {
      setC(createCase("Új ügy"));
    }
  };

  const handleCopy = () => {
    const text =
      outputTab === "szerzodes"
        ? contract
        : outputTab === "osszefoglalo"
          ? summary
          : outputTab === "hianyzo"
            ? missing.map((m) => `[${m.group}] ${m.field}${m.reszlet ? " — " + m.reszlet : ""}`).join("\n")
            : outputTab === "kockazat"
              ? risks
                  .map(
                    (r) =>
                      `[${SEVERITY_LABEL[r.severity].toUpperCase()}] ${r.cim}\n  Miért: ${r.miert}\n  Ellenőrizendő: ${r.ellenorizendo}`,
                  )
                  .join("\n\n")
              : attachments
                  .map((a) => `${a.kotelezo ? "[KÖTELEZŐ]" : "[ajánlott]"} ${a.cim} — ${a.indok}`)
                  .join("\n");
    void navigator.clipboard.writeText(text);
  };
  const handlePrint = async () => {
    // Kontrollált PDF export — NEM használunk window.print()-et, hogy a böngésző
    // által beillesztett URL / preview-... / .app / időbélyeg fejléc-lábléc
    // NE jelenjen meg a kimeneten. A PDF jsPDF-fel készül, beágyazott Noto Serif
    // fonttal, oldalszám-lábléccel, ügyvédi letterhead-del.
    try {
      const { generateContractPdf } = await import("@/lib/legal/contractPdf");
      const blob = await generateContractPdf(c, contract);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c.ugyAzonosito || "tervezet"}-szerzodes.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export hiba:", err);
      alert(
        "A PDF generálása nem sikerült. Próbálja meg a Word (.docx) exportot, majd nyomtassa abból PDF-be a böngésző fejléc/lábléc nélkül.",
      );
    }
  };
  const exportFile = async (
    kind: "txt" | "html" | "docx" | "review-md",
    variant: "sima" | "biztonsagi_okmany" = "sima",
  ) => {
    const suffix = variant === "biztonsagi_okmany" ? "-zoldpapir" : "";
    let filename = `${c.ugyAzonosito || "tervezet"}-szerzodes${suffix}.${kind}`;
    let blob: Blob;
    if (kind === "review-md") {
      const { generateClauseReviewReport } = await import("@/lib/legal/clauseReviewReport");
      const report = generateClauseReviewReport(c);
      const prefix = report.title.includes("HIANYOS-TERVEZET") ? "HIANYOS-TERVEZET-" : "";
      filename = `${prefix}${c.ugyAzonosito || "tervezet"}-klauzula-review-report.md`;
      blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    } else if (kind === "docx") {
      const { generateContractDocx } = await import("@/lib/legal/docx");
      blob = await generateContractDocx(contract, c.ugyAzonosito, variant, c);
    } else {
      const content =
        kind === "txt"
          ? contract
          : `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>${c.ugyAzonosito || "Szerződéstervezet"}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:32px auto;padding:24px;white-space:pre-wrap;color:#1a1a2e;}h1{font-size:18px;}</style></head><body><pre>${contract.replace(/[<>&]/g, (s) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[s] as string)}</pre></body></html>`;
      blob = new Blob([content], { type: kind === "txt" ? "text/plain" : "text/html" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="no-print border-b border-border bg-primary text-primary-foreground">
        <div className="px-6 py-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Szladits Magánjogi Asszisztens
            </h1>
            <p className="text-xs opacity-80 mt-1">
              Belső okiratszerkesztési tesztverzió ügyvédi irodák számára — szabálylogikával támogatott okiratszerkesztési demo. Jogi review szükséges.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CaseSwitcher
              current={c}
              saveCurrent={() => saveCase(c)}
              onLoaded={(loaded) => setC(loaded)}
            />
            <Button size="sm" variant="default" onClick={() => setChecklistOpen(true)}>
              ✅ Ügyvédi ellenőrző lista
            </Button>
            <Button size="sm" variant="default" onClick={() => setChatOpen(true)}>
              💬 Jogi asszisztens (AI)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setStep(7);
                setOutputTab("szerzodes");
              }}
            >
              Dokumentumcsomag megnyitása
            </Button>
            <Button size="sm" variant="secondary" onClick={handleLoadDemo}>
              Demo adatok betöltése
            </Button>
            <Button size="sm" variant="secondary" onClick={handleClear}>
              Aktív ügy törlése
            </Button>
          </div>

        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row no-print">
        {/* Sidebar */}
        <nav className="lg:w-64 border-b lg:border-b-0 lg:border-r border-border bg-sidebar text-sidebar-foreground">
          <ul className="p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {STEPS.map((s) => (
              <li key={s.id} className="flex-shrink-0">
                <button
                  onClick={() => setStep(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    step === s.id
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-sidebar-border space-y-3">
            <div>
              <label className="block">Ügyazonosító:</label>
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.ugyAzonosito}
                onChange={(e) => update((d) => void (d.ugyAzonosito = e.target.value))}
                placeholder="pl. 2026-001"
              />
            </div>
            <div className="pt-2 border-t border-sidebar-border">
              <div className="font-semibold text-foreground mb-1">Ügyvédi iroda (letterhead)</div>
              <p className="text-[10px] text-muted-foreground mb-1">
                Ez az adatcsomag jelenik meg a generált PDF tetején fejlécként és az ellenjegyzésnél. Szladits-brand a kliensnek küldött szerződésen NEM látszik.
              </p>
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.iroda}
                onChange={(e) => update((d) => void (d.eljaroUgyved.iroda = e.target.value))}
                placeholder="Ügyvédi iroda neve"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.nev}
                onChange={(e) => update((d) => void (d.eljaroUgyved.nev = e.target.value))}
                placeholder="dr. Vezetéknév Keresztnév (eljáró ügyvéd)"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.kaszSzam}
                onChange={(e) => update((d) => void (d.eljaroUgyved.kaszSzam = e.target.value))}
                placeholder="KASZ szám"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.irodaCim}
                onChange={(e) => update((d) => void (d.eljaroUgyved.irodaCim = e.target.value))}
                placeholder="Iroda címe"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.telefon ?? ""}
                onChange={(e) => update((d) => void (d.eljaroUgyved.telefon = e.target.value))}
                placeholder="Telefon"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.email ?? ""}
                onChange={(e) => update((d) => void (d.eljaroUgyved.email = e.target.value))}
                placeholder="E-mail"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.website ?? ""}
                onChange={(e) => update((d) => void (d.eljaroUgyved.website = e.target.value))}
                placeholder="Weboldal"
              />
              <input
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm text-foreground"
                value={c.eljaroUgyved.rovidHeader ?? ""}
                onChange={(e) => update((d) => void (d.eljaroUgyved.rovidHeader = e.target.value))}
                placeholder="Rövid header sor (pl. szakterület)"
              />
            </div>
          </div>
        </nav>

        {/* Main + live panel */}
        <main className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_360px]">
          <section className="p-6 overflow-y-auto">
            <DraftBanner />
            <IntakeLinkPanel c={c} update={update} />
            {step === 1 && <Step1 c={c} update={update} />}
            {step === 2 && <Step2 c={c} update={update} />}
            {step === 3 && <Step3 c={c} update={update} />}
            {step === 4 && <Step4 c={c} update={update} />}
            {step === 5 && <Step5 c={c} update={update} />}
            {step === 6 && (
              <>
                <Modulok c={c} update={update} />
                <div className="mt-8 pt-6 border-t border-border">
                  <Step6 c={c} update={update} />
                </div>
              </>
            )}
            {step === 7 && (
              <Step7
                c={c}
                tab={outputTab}
                setTab={setOutputTab}
                contract={contract}
                summary={summary}
                missing={missing}
                risks={risks}
                attachments={attachments}
                onCopy={handleCopy}
                onPrint={handlePrint}
                onExport={exportFile}
              />
            )}
            <div className="mt-8 flex justify-between">
              <Button
                variant="outline"
                disabled={step === 1}
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as StepId) : s))}
              >
                Előző lépés
              </Button>
              <Button
                disabled={step === 7}
                onClick={() => setStep((s) => (s < 7 ? ((s + 1) as StepId) : s))}
              >
                Következő lépés
              </Button>
            </div>
          </section>

          {/* Live panel */}
          <aside className="border-t xl:border-t-0 xl:border-l border-border bg-card p-4 overflow-y-auto">
            <h2 className="text-sm font-semibold mb-2 text-foreground">
              Hiányzó adatok ({missing.length})
            </h2>
            <ul className="text-xs space-y-1 mb-4 max-h-48 overflow-y-auto pr-1">
              {missing.length === 0 && (
                <li className="text-muted-foreground">Nincs azonosított hiány.</li>
              )}
              {missing.map((m, i) => (
                <li key={i} className="text-foreground">
                  <span className="font-mono text-muted-foreground">[{m.group}]</span>{" "}
                  {m.field}
                  {m.reszlet ? (
                    <span className="text-muted-foreground"> — {m.reszlet}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <h2 className="text-sm font-semibold mb-2 text-foreground">
              Kockázati flagek ({risks.length})
            </h2>
            <ul className="space-y-2">
              {risks.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Nincs azonosított kockázat. Ügyvédi ellenőrzés továbbra is szükséges.
                </li>
              )}
              {risks.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-border p-2 text-xs"
                  style={{ borderLeft: `4px solid ${SEVERITY_COLOR[r.severity]}` }}
                >
                  <div className="font-semibold text-foreground">{r.cim}</div>
                  <div
                    className="uppercase tracking-wide text-[10px] mt-0.5"
                    style={{ color: SEVERITY_COLOR[r.severity] }}
                  >
                    {SEVERITY_LABEL[r.severity]}
                  </div>
                  <div className="text-muted-foreground mt-1">{r.miert}</div>
                </li>
              ))}
            </ul>
          </aside>
        </main>
      </div>

      {/* Print area */}
      <div className="print-area hidden print:block">
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", fontSize: 12 }}>
          {contract}
        </pre>
      </div>

      <footer className="no-print border-t border-border bg-secondary text-secondary-foreground px-6 py-3 text-xs">
        {INTERNAL_FOOTER}
      </footer>

      {chatOpen && <JogiAsszisztens c={c} onClose={() => setChatOpen(false)} />}
      {checklistOpen && <UgyvedChecklist c={c} onClose={() => setChecklistOpen(false)} />}
    </div>
  );
}

function DraftBanner() {
  return (
    <div className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
      <strong className="text-accent">TERVEZET</strong> — ügyvédi ellenőrzés és ellenjegyzés szükséges. A rendszer nem helyettesíti az ügyvéd szakmai döntését.
    </div>
  );
}

// ---------- Small form primitives ----------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[60px] ${props.className ?? ""}`} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[color:var(--primary)]"
      />
      <span>{label}</span>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-foreground mb-3 border-b border-border pb-2">
      {children}
    </h2>
  );
}

// ---------- Step 1 ----------

function Step1({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const toggle = (t: TransactionType) =>
    update((d) => {
      const i = d.transactionTypes.indexOf(t);
      if (i >= 0) d.transactionTypes.splice(i, 1);
      else d.transactionTypes.push(t);
    });
  return (
    <div>
      <SectionTitle>Ügylet és ingatlan típusa</SectionTitle>
      <p className="text-xs text-muted-foreground mb-3">
        Több jelölő egyszerre is választható. A választás befolyásolja a kockázati flageket, a mellékletlistát és a szerződéstervezet szakaszait.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
          <Check
            key={t}
            checked={c.transactionTypes.includes(t)}
            onChange={() => toggle(t)}
            label={TRANSACTION_TYPE_LABELS[t]}
          />
        ))}
      </div>
      {c.transactionTypes.includes("zartkert") && (
        <div className="mt-6 rounded-md border border-border bg-secondary p-4">
          <h3 className="text-sm font-semibold mb-2">Zártkert minősítés</h3>
          <Select
            value={c.special.zartkertStatus ?? ""}
            onChange={(e) =>
              update(
                (d) =>
                  void (d.special.zartkertStatus = (e.target.value || undefined) as
                    | ZartkertStatus
                    | undefined),
              )
            }
          >
            <option value="">— válassz —</option>
            <option value="muveles_alol_kivett">Művelés alól kivett</option>
            <option value="mezogazdasagi">Mezőgazdasági művelési ágban nyilvántartott</option>
            <option value="nem_ismert">Nem ismert, ügyvédi ellenőrzést igényel</option>
          </Select>
        </div>
      )}
    </div>
  );
}

// ---------- Step 2 ----------

function Step2({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const addNatural = (szerep: "elado" | "vevo") =>
    update((d) => {
      const p: NaturalPerson = {
        kind: "termeszetes",
        id: newId(),
        szerep,
        nev: "",
        szuletesiNev: "",
        anyjaNeve: "",
        szuletesiHely: "",
        szuletesiDatum: "",
        lakcim: "",
        okmanyAzonosito: "",
        adoazonosito: "",
        allampolgarsag: "magyar",
        tulajdoniHanyad: "1/1",
      };
      d.parties.push(p);
    });
  const addCompany = (szerep: "elado" | "vevo") =>
    update((d) => {
      const p: Company = {
        kind: "ceg",
        id: newId(),
        szerep,
        cegnev: "",
        cegjegyzekszam: "",
        adoszam: "",
        szekhely: "",
        kepviseloNeve: "",
        kepviseletModja: "",
        cegkivonatDatuma: "",
        alairasiCimpeldanySzukseges: true,
        tulajdoniHanyad: "1/1",
        kulfoldiSzekhely: false,
      };
      d.parties.push(p);
    });
  const remove = (id: string) =>
    update((d) => {
      d.parties = d.parties.filter((p) => p.id !== id);
    });
  return (
    <div>
      <SectionTitle>Felek</SectionTitle>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" onClick={() => addNatural("elado")}>+ Eladó (természetes)</Button>
        <Button size="sm" onClick={() => addNatural("vevo")}>+ Vevő (természetes)</Button>
        <Button size="sm" variant="outline" onClick={() => addCompany("elado")}>+ Eladó (cég)</Button>
        <Button size="sm" variant="outline" onClick={() => addCompany("vevo")}>+ Vevő (cég)</Button>
      </div>
      {c.parties.length === 0 && (
        <p className="text-xs text-muted-foreground">Nincs fél rögzítve.</p>
      )}
      <div className="space-y-4">
        {c.parties.map((p) => (
          <PartyCard key={p.id} party={p} update={update} onRemove={() => remove(p.id)} />
        ))}
      </div>
    </div>
  );
}

function PartyCard({
  party,
  update,
  onRemove,
}: {
  party: Party;
  update: (fn: (d: CaseFile) => void) => void;
  onRemove: () => void;
}) {
  const patch = <K extends keyof Party>(k: K, v: Party[K]) =>
    update((d) => {
      const target = d.parties.find((x) => x.id === party.id);
      if (target) (target as unknown as Record<string, unknown>)[k as string] = v as unknown;
    });
  const patchRep = (k: string, v: string) =>
    update((d) => {
      const target = d.parties.find((x) => x.id === party.id);
      if (!target || target.kind !== "termeszetes") return;
      const rep = target.kepviselo ?? {
        nev: "",
        minoseg: "",
        lakcim: "",
        azonosito: "",
        hatarozat: "",
      };
      (rep as unknown as Record<string, string>)[k] = v;
      target.kepviselo = rep;
    });

  const roleLabel = party.szerep === "elado" ? "Eladó" : "Vevő";
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          {roleLabel} — {party.kind === "termeszetes" ? "természetes személy" : "jogi személy"}
        </h3>
        <div className="flex items-center gap-2">
          <Select
            value={party.szerep}
            onChange={(e) => patch("szerep", e.target.value as "elado" | "vevo")}
          >
            <option value="elado">Eladó</option>
            <option value="vevo">Vevő</option>
          </Select>
          <Button size="sm" variant="destructive" onClick={onRemove}>Törlés</Button>
        </div>
      </div>

      {party.kind === "termeszetes" ? (
        <NaturalForm
          p={party}
          patch={(k, v) => patch(k as keyof Party, v as Party[keyof Party])}
          patchRep={patchRep}
        />
      ) : (
        <CompanyForm
          p={party}
          patch={(k, v) => patch(k as keyof Party, v as Party[keyof Party])}
        />
      )}
    </div>
  );
}

function NaturalForm({
  p,
  patch,
  patchRep,
}: {
  p: NaturalPerson;
  patch: (k: string, v: unknown) => void;
  patchRep: (k: string, v: string) => void;
}) {
  const age = calculateAge(p.szuletesiDatum);
  const cap = determineCapacityStatus(p);
  const isMinor =
    cap === "cselekvokeptelen_kiskoru" || cap === "korlatozottan_cselekvokepes_kiskoru";
  const isRestricted =
    cap === "nagykoru_korlatozott" ||
    cap === "cselekvokeptelen_nagykoru" ||
    cap === "gondnokkal" ||
    cap === "ellenorzes_szukseges";
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Név"><TextInput value={p.nev} onChange={(e) => patch("nev", e.target.value)} /></Field>
        <Field label="Születési név"><TextInput value={p.szuletesiNev} onChange={(e) => patch("szuletesiNev", e.target.value)} /></Field>
        <Field label="Anyja neve"><TextInput value={p.anyjaNeve} onChange={(e) => patch("anyjaNeve", e.target.value)} /></Field>
        <Field label="Születési hely"><TextInput value={p.szuletesiHely} onChange={(e) => patch("szuletesiHely", e.target.value)} /></Field>
        <Field label="Születési dátum"><TextInput type="date" value={p.szuletesiDatum} onChange={(e) => patch("szuletesiDatum", e.target.value)} /></Field>
        <Field label="Lakcím"><TextInput value={p.lakcim} onChange={(e) => patch("lakcim", e.target.value)} /></Field>
        <Field label="Okmány azonosító"><TextInput value={p.okmanyAzonosito} onChange={(e) => patch("okmanyAzonosito", e.target.value)} /></Field>
        <Field label="Adóazonosító jel"><TextInput value={p.adoazonosito} onChange={(e) => patch("adoazonosito", e.target.value)} /></Field>
        <Field label="Állampolgárság"><TextInput value={p.allampolgarsag} onChange={(e) => patch("allampolgarsag", e.target.value)} /></Field>
        <Field label="Tulajdoni hányad"><TextInput value={p.tulajdoniHanyad} onChange={(e) => patch("tulajdoniHanyad", e.target.value)} placeholder="pl. 1/2" /></Field>
      </div>

      <div className="mt-3 rounded-md bg-secondary p-3 text-xs">
        <div>
          Életkor: <strong>{age ?? "—"}</strong> · Cselekvőképességi státusz:{" "}
          <strong>{CAPACITY_LABEL[cap]}</strong>
        </div>
        {age !== null && age >= 18 && (
          <div className="mt-2">
            <Field label="Cselekvőképesség (felülírás)">
              <Select
                value={p.capacityOverride ?? "nagykoru_teljes"}
                onChange={(e) => patch("capacityOverride", e.target.value)}
              >
                <option value="nagykoru_teljes">Teljesen cselekvőképes</option>
                <option value="nagykoru_korlatozott">Részlegesen korlátozott</option>
                <option value="cselekvokeptelen_nagykoru">Cselekvőképtelen nagykorú</option>
                <option value="gondnokkal">Gondnokkal jár el</option>
                <option value="ellenorzes_szukseges">Ügyvédi ellenőrzést igényel</option>
              </Select>
            </Field>
          </div>
        )}
      </div>

      {isMinor && (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
          <div className="text-xs font-semibold text-accent mb-2">
            Kiskorú fél — törvényes képviselő szükséges. Gyámhatósági jóváhagyás szükségessége ügyvédi ellenőrzést igényel.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Képviselő neve"><TextInput value={p.kepviselo?.nev ?? ""} onChange={(e) => patchRep("nev", e.target.value)} /></Field>
            <Field label="Képviselő minősége"><TextInput value={p.kepviselo?.minoseg ?? ""} onChange={(e) => patchRep("minoseg", e.target.value)} placeholder="szülő / gyám" /></Field>
            <Field label="Képviselő lakcíme"><TextInput value={p.kepviselo?.lakcim ?? ""} onChange={(e) => patchRep("lakcim", e.target.value)} /></Field>
            <Field label="Képviselő azonosítója"><TextInput value={p.kepviselo?.azonosito ?? ""} onChange={(e) => patchRep("azonosito", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            <Check
              checked={!!p.kiskoruIngatlanEladasa}
              onChange={(v) => patch("kiskoruIngatlanEladasa", v)}
              label="Kiskorú ingatlanának eladása"
            />
            <Check
              checked={!!p.kiskoruIngatlanMegterhelese}
              onChange={(v) => patch("kiskoruIngatlanMegterhelese", v)}
              label="Kiskorú ingatlanának megterhelése"
            />
            <Check
              checked={!!p.nemTehermentesSzerzes}
              onChange={(v) => patch("nemTehermentesSzerzes", v)}
              label="Nem tehermentes ingatlanszerzés"
            />
          </div>
        </div>
      )}

      {isRestricted && (
        <div className="mt-3 rounded-md border border-accent/40 bg-accent/5 p-3">
          <div className="text-xs font-semibold text-accent mb-2">
            Cselekvőképességi státusz ügyvédi ellenőrzést igényel.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Gondnok / törvényes képviselő neve"><TextInput value={p.kepviselo?.nev ?? ""} onChange={(e) => patchRep("nev", e.target.value)} /></Field>
            <Field label="Bírósági határozat / ügycsoport"><TextInput value={p.kepviselo?.hatarozat ?? ""} onChange={(e) => patchRep("hatarozat", e.target.value)} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyForm({
  p,
  patch,
}: {
  p: Company;
  patch: (k: string, v: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="Cégnév"><TextInput value={p.cegnev} onChange={(e) => patch("cegnev", e.target.value)} /></Field>
      <Field label="Cégjegyzékszám"><TextInput value={p.cegjegyzekszam} onChange={(e) => patch("cegjegyzekszam", e.target.value)} /></Field>
      <Field label="Adószám"><TextInput value={p.adoszam} onChange={(e) => patch("adoszam", e.target.value)} /></Field>
      <Field label="Székhely"><TextInput value={p.szekhely} onChange={(e) => patch("szekhely", e.target.value)} /></Field>
      <Field label="Képviselő neve"><TextInput value={p.kepviseloNeve} onChange={(e) => patch("kepviseloNeve", e.target.value)} /></Field>
      <Field label="Képviselet módja"><TextInput value={p.kepviseletModja} onChange={(e) => patch("kepviseletModja", e.target.value)} placeholder="önálló / együttes" /></Field>
      <Field label="Cégkivonat dátuma"><TextInput type="date" value={p.cegkivonatDatuma} onChange={(e) => patch("cegkivonatDatuma", e.target.value)} /></Field>
      <Field label="Tulajdoni hányad"><TextInput value={p.tulajdoniHanyad} onChange={(e) => patch("tulajdoniHanyad", e.target.value)} /></Field>
      <div className="flex flex-col gap-2 justify-end">
        <Check
          checked={p.alairasiCimpeldanySzukseges}
          onChange={(v) => patch("alairasiCimpeldanySzukseges", v)}
          label="Aláírási címpéldány / aláírásminta szükséges"
        />
        <Check
          checked={p.kulfoldiSzekhely}
          onChange={(v) => patch("kulfoldiSzekhely", v)}
          label="Külföldi székhely"
        />
      </div>
    </div>
  );
}

// ---------- Step 3 ----------

function Step3({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const p = c.property;
  const patch = (k: string, v: unknown) =>
    update((d) => {
      (d.property as unknown as Record<string, unknown>)[k] = v;
    });
  const patchEnc = (k: string, v: unknown) =>
    update((d) => {
      (d.property.encumbrances as unknown as Record<string, unknown>)[k] = v;
    });
  return (
    <div>
      <SectionTitle>Ingatlan adatai</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Település"><TextInput value={p.telepules} onChange={(e) => patch("telepules", e.target.value)} /></Field>
        <Field label="Irányítószám"><TextInput value={p.iranyitoszam} onChange={(e) => patch("iranyitoszam", e.target.value)} /></Field>
        <Field label="Cím"><TextInput value={p.cim} onChange={(e) => patch("cim", e.target.value)} /></Field>
        <Field label="Helyrajzi szám"><TextInput value={p.helyrajziSzam} onChange={(e) => patch("helyrajziSzam", e.target.value)} /></Field>
        <Field label="Ingatlan típusa"><TextInput value={p.ingatlanTipus} onChange={(e) => patch("ingatlanTipus", e.target.value)} /></Field>
        <Field label="Művelési ág"><TextInput value={p.muvelesiAg} onChange={(e) => patch("muvelesiAg", e.target.value)} /></Field>
        <Field label="Alapterület (m²)"><TextInput value={p.alapterulet} onChange={(e) => patch("alapterulet", e.target.value)} /></Field>
        <Field label="Tulajdoni hányad"><TextInput value={p.tulajdoniHanyad} onChange={(e) => patch("tulajdoniHanyad", e.target.value)} /></Field>
        <Field label="Energetikai tanúsítvány"><TextInput value={p.energetikaiTanusitvany} onChange={(e) => patch("energetikaiTanusitvany", e.target.value)} /></Field>
        <Field label="Használati státusz">
          <Select value={p.hasznalatiStatusz} onChange={(e) => patch("hasznalatiStatusz", e.target.value)}>
            <option value="">— válassz —</option>
            <option value="lakott">Lakott</option>
            <option value="ures">Üres</option>
            <option value="berbeadott">Bérbe adott</option>
          </Select>
        </Field>
        <Field label="Birtokbaadás tervezett dátuma"><TextInput type="date" value={p.birtokbaadasTervezett} onChange={(e) => patch("birtokbaadasTervezett", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        <Check checked={p.tarsashaziAlbetet} onChange={(v) => patch("tarsashaziAlbetet", v)} label="Társasházi albetét" />
        <Check checked={p.teremgarazsTarolo} onChange={(v) => patch("teremgarazsTarolo", v)} label="Teremgarázs / tároló kapcsolódik" />
        <Check checked={p.birtokbanElado} onChange={(v) => patch("birtokbanElado", v)} label="Birtokban van az eladó" />
      </div>

      <h3 className="text-sm font-semibold mt-6 mb-2">Tulajdoni lap — terhek és jogok</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <Check checked={p.encumbrances.jelzalog} onChange={(v) => patchEnc("jelzalog", v)} label="Jelzálogjog" />
        <Check checked={p.encumbrances.vegrehajtas} onChange={(v) => patchEnc("vegrehajtas", v)} label="Végrehajtási jog" />
        <Check checked={p.encumbrances.haszonelvezet} onChange={(v) => patchEnc("haszonelvezet", v)} label="Haszonélvezeti jog" />
        <Check checked={p.encumbrances.elidegenitesiTilalom} onChange={(v) => patchEnc("elidegenitesiTilalom", v)} label="Elidegenítési és terhelési tilalom" />
        <Check checked={p.encumbrances.elovasarlasiJog} onChange={(v) => patchEnc("elovasarlasiJog", v)} label="Elővásárlási jog" />
        <Check checked={p.encumbrances.szolgalmiJog} onChange={(v) => patchEnc("szolgalmiJog", v)} label="Szolgalmi jog" />
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Egyéb teher / megjegyzés"><TextArea value={p.encumbrances.egyeb} onChange={(e) => patchEnc("egyeb", e.target.value)} /></Field>
        <Field label="Tehermentesítési terv"><TextArea value={p.tehermentesitesiTerv} onChange={(e) => patch("tehermentesitesiTerv", e.target.value)} /></Field>
      </div>
    </div>
  );
}

// ---------- Step 4 ----------

function Step4({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const p = c.payment;
  const patch = (k: string, v: unknown) =>
    update((d) => {
      (d.payment as unknown as Record<string, unknown>)[k] = v;
    });
  return (
    <div>
      <SectionTitle>Vételár és fizetés</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Teljes vételár"><TextInput value={p.teljesVetelar} onChange={(e) => patch("teljesVetelar", e.target.value)} /></Field>
        <Field label="Pénznem">
          <Select value={p.penznem} onChange={(e) => patch("penznem", e.target.value)}>
            <option value="HUF">HUF</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
        <Field label="ÁFA-kezelés (kötelező)">
          <Select value={p.afaKezeles} onChange={(e) => patch("afaKezeles", e.target.value)}>
            <option value="">— ügyvédi döntés szükséges —</option>
            <option value="afa_korin_kivuli">ÁFA-körön kívüli ügylet</option>
            <option value="afa_mentes">ÁFA-mentes (Áfa tv. 86. §)</option>
            <option value="tartalmazza_27">Vételár tartalmazza a 27% ÁFÁ-t</option>
            <option value="tartalmazza_5">Vételár tartalmazza az 5% ÁFÁ-t (új építésű)</option>
            <option value="forditott">Fordított adózás (Áfa tv. 142. §)</option>
          </Select>
        </Field>
        <Field label="Önerő összege"><TextInput value={p.onero} onChange={(e) => patch("onero", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
        <Check checked={p.foglaloVan} onChange={(v) => patch("foglaloVan", v)} label="Foglaló van" />
        <Check checked={p.elolegVan} onChange={(v) => patch("elolegVan", v)} label="Előleg van" />
        <Check checked={p.reszletfizetes} onChange={(v) => patch("reszletfizetes", v)} label="Részletfizetés" />
        <Check checked={p.ugyvediLetet} onChange={(v) => patch("ugyvediLetet", v)} label="Ügyvédi letét" />
        <Check checked={p.bankhitelVan} onChange={(v) => patch("bankhitelVan", v)} label="Bankhitel van" />
        <Check checked={p.meglevoTeherKivaltas} onChange={(v) => patch("meglevoTeherKivaltas", v)} label="Meglévő teher kiváltása" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        {p.foglaloVan && (
          <Field label="Foglaló összege"><TextInput value={p.foglaloOsszeg} onChange={(e) => patch("foglaloOsszeg", e.target.value)} /></Field>
        )}
        {p.bankhitelVan && (
          <>
            <Field label="Bank neve"><TextInput value={p.bankNeve} onChange={(e) => patch("bankNeve", e.target.value)} /></Field>
            <Field label="Hitel összege"><TextInput value={p.hitelOsszeg} onChange={(e) => patch("hitelOsszeg", e.target.value)} /></Field>
            <Field label="Hitel folyósítás határideje"><TextInput type="date" value={p.hitelFolyositasHatarido} onChange={(e) => patch("hitelFolyositasHatarido", e.target.value)} /></Field>
          </>
        )}
        {p.reszletfizetes && (
          <Field label="Fizetési ütemezés"><TextArea value={p.fizetesiUtemezes} onChange={(e) => patch("fizetesiUtemezes", e.target.value)} /></Field>
        )}
        {p.meglevoTeherKivaltas && (
          <Field label="Tehermentesítés módja"><TextArea value={p.tehermentesitesModja} onChange={(e) => patch("tehermentesitesModja", e.target.value)} /></Field>
        )}
        <Field label="Utalási célszámlaszám"><TextInput value={p.utalasiSzamlaszam} onChange={(e) => patch("utalasiSzamlaszam", e.target.value)} /></Field>
      </div>
      {p.bankhitelVan && (
        <div className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-3 text-xs">
          <strong className="text-accent">Banki finanszírozás kockázatai:</strong> banki folyósítás
          feltételei, önerő/hitel bontás, bejegyzési engedély kezelése, függőben tartás,
          banki jelzálog és elidegenítési tilalom — ügyvédi ellenőrzést igényel.
        </div>
      )}
    </div>
  );
}

// ---------- Step 5 ----------

function Step5({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const p = c.possession;
  const patch = (k: string, v: unknown) =>
    update((d) => {
      (d.possession as unknown as Record<string, unknown>)[k] = v;
    });
  return (
    <div>
      <SectionTitle>Birtokbaadás</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Birtokbaadás dátuma"><TextInput type="date" value={p.datum} onChange={(e) => patch("datum", e.target.value)} /></Field>
        <Field label="Birtokbaadás feltétele"><TextInput value={p.feltetel} onChange={(e) => patch("feltetel", e.target.value)} /></Field>
        <Field label="Eladó kiköltözési kötelezettsége"><TextInput value={p.eladoKikoltozes} onChange={(e) => patch("eladoKikoltozes", e.target.value)} /></Field>
        <Field label="Ingóságok listája (ha maradnak)"><TextArea value={p.ingosagokListaja} onChange={(e) => patch("ingosagokListaja", e.target.value)} /></Field>
        <Field label="Kötbér összege (ha van)"><TextInput value={p.kotberOsszeg} onChange={(e) => patch("kotberOsszeg", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
        <Check checked={p.kozmuAtiras} onChange={(v) => patch("kozmuAtiras", v)} label="Közműóra átírás" />
        <Check checked={p.kulcsAtadas} onChange={(v) => patch("kulcsAtadas", v)} label="Kulcsátadás" />
        <Check checked={p.ingosagokMaradnak} onChange={(v) => patch("ingosagokMaradnak", v)} label="Ingóságok maradnak" />
        <Check checked={p.kotberKesedelem} onChange={(v) => patch("kotberKesedelem", v)} label="Kötbér késedelem esetén" />
      </div>
    </div>
  );
}

// ---------- Step 6 ----------

function Step6({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  const f = c.special.foldforgalmi;
  const patchF = (k: string, v: unknown) =>
    update((d) => {
      (d.special.foldforgalmi as unknown as Record<string, unknown>)[k] = v;
    });
  const agriRelevant =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  const minors = c.parties.filter(
    (p) => p.kind === "termeszetes" && (
      determineCapacityStatus(p) === "cselekvokeptelen_kiskoru" ||
      determineCapacityStatus(p) === "korlatozottan_cselekvokepes_kiskoru"
    ),
  );
  const restricted = c.parties.filter(
    (p) => p.kind === "termeszetes" && [
      "nagykoru_korlatozott", "cselekvokeptelen_nagykoru", "gondnokkal", "ellenorzes_szukseges",
    ].includes(determineCapacityStatus(p)),
  );
  const companies = c.parties.filter((p) => p.kind === "ceg");
  const foreigners = c.parties.filter(
    (p) =>
      (p.kind === "termeszetes" && p.allampolgarsag && p.allampolgarsag.toLowerCase() !== "magyar") ||
      (p.kind === "ceg" && p.kulfoldiSzekhely),
  );

  return (
    <div>
      <SectionTitle>Speciális modulok</SectionTitle>

      {agriRelevant ? (
        <div className="rounded-md border border-accent/50 bg-accent/5 p-4 mb-6">
          <h3 className="text-sm font-semibold text-accent mb-2">Földforgalmi ellenőrző</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Termőföld / mezőgazdasági föld esetén a földforgalmi szabályok, elővásárlási jogok,
            jóváhagyási és kifüggesztési kötelezettségek ügyvédi ellenőrzése kötelező.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Művelési ág"><TextInput value={f.muvelesiAg} onChange={(e) => patchF("muvelesiAg", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            <Check checked={f.fold} onChange={(v) => patchF("fold", v)} label="Ingatlan földnek minősül" />
            <Check checked={f.vevoFoldmuves} onChange={(v) => patchF("vevoFoldmuves", v)} label="Vevő földműves" />
            <Check checked={f.eladoFoldmuves} onChange={(v) => patchF("eladoFoldmuves", v)} label="Eladó földműves" />
            <Check checked={f.vevoHelybenLako} onChange={(v) => patchF("vevoHelybenLako", v)} label="Vevő helyben lakó" />
            <Check checked={f.vevoSzomszed} onChange={(v) => patchF("vevoSzomszed", v)} label="Vevő helyben lakó szomszéd" />
            <Check checked={f.haszonberlet} onChange={(v) => patchF("haszonberlet", v)} label="Haszonbérleti szerződés van" />
            <Check checked={f.foldhasznalo} onChange={(v) => patchF("foldhasznalo", v)} label="Földhasználó bejegyezve" />
            <Check checked={f.elovasarlasErintett} onChange={(v) => patchF("elovasarlasErintett", v)} label="Elővásárlási jog érintett" />
            <Check checked={f.kifuggesztes} onChange={(v) => patchF("kifuggesztes", v)} label="Kifüggesztés szükséges" />
            <Check checked={f.hatosagiJovahagyas} onChange={(v) => patchF("hatosagiJovahagyas", v)} label="Hatósági jóváhagyás szükséges" />
            <Check checked={f.tulajdonszerzesiKorlat} onChange={(v) => patchF("tulajdonszerzesiKorlat", v)} label="Tulajdonszerzési korlát érintett" />
            <Check checked={f.nyilatkozatok} onChange={(v) => patchF("nyilatkozatok", v)} label="Nyilatkozatok szükségesek" />
          </div>

          <div className="mt-5 pt-4 border-t border-accent/30">
            <h4 className="text-xs font-semibold text-accent mb-2">
              Nyomtatási változat (Földforgalmi tv. szerinti okiratkiállítás)
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Földforgalmi szerződést a 47/2014. (II. 26.) Korm. rendelet szerinti biztonsági
              okmányon („zöld papír") kell véglegesíteni. A sima nyomtatott változat belső
              munkapéldányként, egyeztetésre szolgál.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Nyomtatási változat">
                <Select
                  value={f.nyomtatasiValtozat}
                  onChange={(e) => patchF("nyomtatasiValtozat", e.target.value)}
                >
                  <option value="sima">Sima nyomtatott (munkapéldány)</option>
                  <option value="biztonsagi_okmany">Biztonsági okmány („zöld papír")</option>
                </Select>
              </Field>
              <Field label="Biztonsági okmány sorszáma">
                <TextInput
                  value={f.biztonsagiOkmanySorszam}
                  onChange={(e) => patchF("biztonsagiOkmanySorszam", e.target.value)}
                  placeholder="pl. AB 1234567"
                />
              </Field>
              <Field label="Kiállító / forgalmazó">
                <TextInput
                  value={f.biztonsagiOkmanyKiallito}
                  onChange={(e) => patchF("biztonsagiOkmanyKiallito", e.target.value)}
                  placeholder="pl. Pénzjegynyomda"
                />
              </Field>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-6">
          Földforgalmi modul nem releváns (az 1. lépésben nem választott mezőgazdasági ingatlant).
        </p>
      )}

      {c.transactionTypes.includes("zartkert") && (
        <div className="rounded-md border border-border bg-secondary p-4 mb-6">
          <h3 className="text-sm font-semibold mb-2">Zártkert</h3>
          <p className="text-xs text-muted-foreground">
            A zártkert minősítés (művelés alól kivett vagy mezőgazdasági) az 1. lépésben állítható.
            Mezőgazdasági nyilvántartás esetén a földforgalmi szabályok alkalmazhatóságát ügyvédileg vizsgálni kell.
          </p>
        </div>
      )}

      {(minors.length > 0 || restricted.length > 0) && (
        <div className="rounded-md border border-accent/50 bg-accent/5 p-4 mb-6">
          <h3 className="text-sm font-semibold text-accent mb-2">Kiskorú / gondnokolt fél</h3>
          <ul className="text-xs list-disc pl-5 space-y-1">
            <li>Törvényes képviselő / gondnok adatai hiányozhatnak — ellenőrizendő.</li>
            <li>Gyámhatósági jóváhagyás szükségessége ügyvédi ellenőrzést igényel.</li>
            <li>Ügylet csak megfelelő képviseleti és jóváhagyási feltételekkel kezelhető.</li>
          </ul>
        </div>
      )}

      {companies.length > 0 && (
        <div className="rounded-md border border-accent/50 bg-accent/5 p-4 mb-6">
          <h3 className="text-sm font-semibold text-accent mb-2">Céges fél</h3>
          <ul className="text-xs list-disc pl-5 space-y-1">
            <li>Cégkivonat frissessége és tartalma.</li>
            <li>Aláírási címpéldány / aláírásminta.</li>
            <li>Képviseleti jogosultság (önálló / együttes).</li>
            <li>Tényleges tulajdonosi nyilatkozat — pénzmosási ellenőrzés.</li>
          </ul>
        </div>
      )}

      {foreigners.length > 0 && (
        <div className="rounded-md border border-accent/50 bg-accent/5 p-4 mb-6">
          <h3 className="text-sm font-semibold text-accent mb-2">Külföldi fél</h3>
          <ul className="text-xs list-disc pl-5 space-y-1">
            <li>Személyazonosítás (útlevél, tartózkodási engedély).</li>
            <li>Idegen nyelvű iratok fordítása.</li>
            <li>Meghatalmazás formai követelménye.</li>
            <li>Apostille / konzuli felülhitelesítés lehetősége.</li>
            <li>Esetleges tulajdonszerzési korlátok ügyvédi ellenőrzése.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Step 7 ----------

function Step7({
  c,
  tab,
  setTab,
  contract,
  summary,
  missing,
  risks,
  attachments,
  onCopy,
  onPrint,
  onExport,
}: {
  c: CaseFile;
  tab: "szerzodes" | "hianyzo" | "kockazat" | "mellekletek" | "osszefoglalo";
  setTab: (t: "szerzodes" | "hianyzo" | "kockazat" | "mellekletek" | "osszefoglalo") => void;
  contract: string;
  summary: string;
  missing: ReturnType<typeof detectMissingFields>;
  risks: ReturnType<typeof generateRiskFlags>;
  attachments: ReturnType<typeof generateAttachmentList>;
  onCopy: () => void;
  onPrint: () => void;
  onExport: (
    kind: "txt" | "html" | "docx" | "review-md",
    variant?: "sima" | "biztonsagi_okmany",
  ) => Promise<void>;
}) {
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "szerzodes", label: "Szerződéstervezet" },
    { id: "hianyzo", label: `Hiányzó adatok (${missing.length})` },
    { id: "kockazat", label: `Kockázati pontok (${risks.length})` },
    { id: "mellekletek", label: `Mellékletlista (${attachments.length})` },
    { id: "osszefoglalo", label: "Ügyleti összefoglaló" },
  ];

  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");

  const groups: Record<string, typeof missing> = {};
  missing.forEach((m) => {
    groups[m.group] = groups[m.group] ?? [];
    groups[m.group].push(m);
  });

  return (
    <div>
      <SectionTitle>Dokumentumcsomag</SectionTitle>
      <div className="mb-4 rounded-md border border-border bg-card p-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground mr-2">
          A teljes dokumentumcsomag exportja (tervezet — ügyvédi ellenjegyzésre vár):
        </span>
        <Button size="sm" variant="default" onClick={() => void onExport("docx", "sima")}>
          📝 Word — sima nyomtatott
        </Button>
        {agri && (
          <Button
            size="sm"
            variant="default"
            onClick={() => void onExport("docx", "biztonsagi_okmany")}
            title='Földforgalmi tv. szerinti biztonsági okmány („zöld papír") változat'
          >
            🟢 Word — biztonsági okmány („zöld papír")
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => void onExport("html")}>
          .html
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void onExport("txt")}>
          .txt
        </Button>
        <Button size="sm" variant="outline" onClick={() => void onExport("review-md")}>
          Klauzula review report megnyitása
        </Button>
        <Button size="sm" variant="secondary" onClick={onPrint}>
          Nyomtatás / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={onCopy}>
          Másolás vágólapra
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm rounded-t-md border-b-2 -mb-[1px] ${
              tab === t.id
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "szerzodes" && (
        <pre className="rounded-md border border-border bg-card p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
          {contract}
        </pre>
      )}

      {tab === "hianyzo" && (
        <div className="space-y-4">
          {Object.keys(groups).length === 0 && (
            <p className="text-sm text-muted-foreground">Nincs azonosított hiány.</p>
          )}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="rounded-md border border-border bg-card p-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {g}
              </h3>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {items.map((m, i) => (
                  <li key={i}>
                    {m.field}
                    {m.reszlet && <span className="text-muted-foreground"> — {m.reszlet}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "kockazat" && (
        <div className="space-y-2">
          {risks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nincs azonosított kockázat. Ügyvédi ellenőrzés továbbra is szükséges.
            </p>
          )}
          {risks.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border bg-card p-3"
              style={{ borderLeft: `4px solid ${SEVERITY_COLOR[r.severity]}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{r.cim}</h3>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: SEVERITY_COLOR[r.severity], color: "white" }}
                >
                  {SEVERITY_LABEL[r.severity]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Miért fontos:</strong> {r.miert}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Ügyvédi ellenőrzés tárgya:</strong> {r.ellenorizendo}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "mellekletek" && (
        <ul className="space-y-2">
          {attachments.map((a, i) => (
            <li key={i} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{a.cim}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    a.kotelezo ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.kotelezo ? "kötelező" : "ajánlott"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{a.indok}</p>
            </li>
          ))}
        </ul>
      )}

      {tab === "osszefoglalo" && (
        <pre className="rounded-md border border-border bg-card p-4 text-xs whitespace-pre-wrap font-mono leading-relaxed">
          {summary}
        </pre>
      )}
    </div>
  );
}
