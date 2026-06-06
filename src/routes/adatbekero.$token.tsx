import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { findCaseByIntakeToken, saveCaseById, emptyCase } from "@/lib/legal/state";
import {
  findRoleByToken,
  findPartyForRole,
  upsertNaturalPersonForRole,
  calculateIntakeCompletion,
} from "@/lib/legal/intake";
import type { CaseFile, NaturalPerson, PartyRole } from "@/lib/legal/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/adatbekero/$token")({
  head: () => ({
    meta: [
      { title: "Adatbekérő — ügyvédi adásvételi ügylet" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { token } = Route.useParams();
  const [c, setC] = useState<CaseFile>(() => emptyCase());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const found = findCaseByIntakeToken(token);
    if (found) setC(found);
    setHydrated(true);
  }, [token]);

  const role = useMemo(() => (hydrated ? findRoleByToken(c, token) : null), [c, token, hydrated]);

  const update = (fn: (d: CaseFile) => void) => {
    setC((prev) => {
      const copy: CaseFile = JSON.parse(JSON.stringify(prev));
      fn(copy);
      if (role) copy.intake[role].utoljaraMentve = new Date().toISOString();
      saveCaseById(copy);
      return copy;
    });
  };


  if (!hydrated) {
    return <Shell><p className="text-sm text-muted-foreground">Betöltés…</p></Shell>;
  }

  if (!role) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Érvénytelen vagy lejárt adatbekérő link
        </h1>
        <p className="text-sm text-muted-foreground">
          A link nem található. Kérjük, vegye fel a kapcsolatot az eljáró ügyvéddel egy új,
          érvényes link kéréséhez.
        </p>
      </Shell>
    );
  }

  const status = c.intake[role];
  const party = findPartyForRole(c, role);
  const completion = calculateIntakeCompletion(c, role);

  const setParty = (patch: Partial<NaturalPerson>) =>
    update((d) => {
      d.parties = upsertNaturalPersonForRole(d, role, patch);
    });

  const submit = () => {
    update((d) => {
      d.intake[role].beadva = true;
      d.intake[role].beadvaIdo = new Date().toISOString();
    });
  };

  return (
    <Shell>
      <Header role={role} c={c} completion={completion} status={status} />
      <FormSection title="1. Az Ön szerepe az ügyletben">
        <div className="text-sm text-foreground">
          {role === "elado" ? "Eladó" : "Vevő"}
          <span className="text-xs text-muted-foreground ml-2">
            (az ügyvéd által beállított szerep)
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Amennyiben meghatalmazottként jár el, kérjük, jelezze az ügyvédnek — a meghatalmazás
          formai követelményeit külön ellenőrizzük.
        </p>
      </FormSection>

      <FormSection title="2. Személyes adatok">
        <Grid>
          <Field label="Teljes név">
            <Input value={party?.nev ?? ""} onChange={(v) => setParty({ nev: v })} />
          </Field>
          <Field label="Születési név">
            <Input value={party?.szuletesiNev ?? ""} onChange={(v) => setParty({ szuletesiNev: v })} />
          </Field>
          <Field label="Anyja neve">
            <Input value={party?.anyjaNeve ?? ""} onChange={(v) => setParty({ anyjaNeve: v })} />
          </Field>
          <Field label="Születési hely">
            <Input value={party?.szuletesiHely ?? ""} onChange={(v) => setParty({ szuletesiHely: v })} />
          </Field>
          <Field label="Születési idő">
            <Input type="date" value={party?.szuletesiDatum ?? ""} onChange={(v) => setParty({ szuletesiDatum: v })} />
          </Field>
          <Field label="Állampolgárság">
            <Input value={party?.allampolgarsag ?? ""} onChange={(v) => setParty({ allampolgarsag: v })} />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title="3. Lakcím / kézbesítési cím">
        <Field label="Lakcím (irányítószám, település, közterület, házszám)">
          <Input value={party?.lakcim ?? ""} onChange={(v) => setParty({ lakcim: v })} />
        </Field>
      </FormSection>

      <FormSection title="4. Okmány- és azonosítóadatok">
        <Grid>
          <Field label="Személyi igazolvány / útlevél száma">
            <Input value={party?.okmanyAzonosito ?? ""} onChange={(v) => setParty({ okmanyAzonosito: v })} />
          </Field>
          <Field label="Adóazonosító jel">
            <Input value={party?.adoazonosito ?? ""} onChange={(v) => setParty({ adoazonosito: v })} />
          </Field>
          <Field label="Tulajdoni hányad (pl. 1/1, 1/2)">
            <Input value={party?.tulajdoniHanyad ?? "1/1"} onChange={(v) => setParty({ tulajdoniHanyad: v })} />
          </Field>
        </Grid>
        <p className="text-xs text-muted-foreground mt-2">
          Az okmány másolatának feltöltése a következő fázisban, az ügyvédnél történik.
        </p>
      </FormSection>

      {role === "elado" && <EladoIngatlan c={c} update={update} />}
      {role === "vevo" && <VevoFizetes c={c} update={update} />}

      <FormSection title={role === "elado" ? "7. Terhek és körülmények" : "7. Egyéb körülmények"}>
        {role === "elado" ? (
          <div className="space-y-2">
            <CheckBox
              label="Az ingatlanon jelzálogjog áll fenn"
              checked={c.property.encumbrances.jelzalog}
              onChange={(v) => update((d) => void (d.property.encumbrances.jelzalog = v))}
            />
            <CheckBox
              label="Haszonélvezeti jog terheli az ingatlant"
              checked={c.property.encumbrances.haszonelvezet}
              onChange={(v) => update((d) => void (d.property.encumbrances.haszonelvezet = v))}
            />
            <CheckBox
              label="Elidegenítési és terhelési tilalom"
              checked={c.property.encumbrances.elidegenitesiTilalom}
              onChange={(v) => update((d) => void (d.property.encumbrances.elidegenitesiTilalom = v))}
            />
            <CheckBox
              label="Elővásárlási jog terheli"
              checked={c.property.encumbrances.elovasarlasiJog}
              onChange={(v) => update((d) => void (d.property.encumbrances.elovasarlasiJog = v))}
            />
            <Field label="Egyéb körülmény, megjegyzés az ügyvédnek">
              <TextArea
                value={c.property.encumbrances.egyeb}
                onChange={(v) => update((d) => void (d.property.encumbrances.egyeb = v))}
              />
            </Field>
          </div>
        ) : (
          <Field label="Egyéb körülmény, megjegyzés az ügyvédnek">
            <TextArea
              value={c.possession.feltetel}
              onChange={(v) => update((d) => void (d.possession.feltetel = v))}
            />
          </Field>
        )}
      </FormSection>

      <FormSection title="8. Dokumentumfeltöltés">
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          A dokumentumok (személyi okmány, lakcímkártya, tulajdoni lap, energetikai tanúsítvány,
          banki hitelígérvény stb.) feltöltése jelen demóban nem aktív.
          Kérjük, készítse elő ezeket — az ügyvéd az átvételt külön megerősíti.
        </div>
      </FormSection>

      <div className="mt-6 flex flex-col gap-3 rounded-md border border-accent/40 bg-accent/10 p-4">
        <p className="text-xs text-foreground">
          <strong>TERVEZET — ügyvédi ellenőrzés és ellenjegyzés szükséges.</strong>{" "}
          A beküldött adatokat az eljáró ügyvéd ellenőrzi, hiányokat pótolja, és a végleges
          okiratot ő készíti és ellenjegyzi. A rendszer önmagában nem hoz létre végleges
          szerződést.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={status.beadva}>
            {status.beadva ? "Beküldve — köszönjük" : "Adatok beküldése az ügyvédnek"}
          </Button>
          {status.beadvaIdo && (
            <span className="text-xs text-muted-foreground">
              Beküldve: {new Date(status.beadvaIdo).toLocaleString("hu-HU")}
            </span>
          )}
          {status.utoljaraMentve && !status.beadva && (
            <span className="text-xs text-muted-foreground">
              Mentve: {new Date(status.utoljaraMentve).toLocaleString("hu-HU")} (automatikus)
            </span>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Header({
  role,
  c,
  completion,
  status,
}: {
  role: PartyRole;
  c: CaseFile;
  completion: { szazalek: number; kitoltott: number; osszes: number };
  status: CaseFile["intake"]["elado"];
}) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Ügyazonosító: {c.ugyAzonosito || "—"}
      </div>
      <h1 className="text-xl font-semibold text-foreground mt-1">
        Adatbekérő — {role === "elado" ? "Eladó" : "Vevő"}
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
        Az adatokat az ügyvédje részére adja meg. A rendszer a beküldött adatokból
        szerződéstervezetet és ügyvédi ellenőrző listát készít. A végleges okiratot az
        ügyvéd ellenőrzi és ellenjegyzi.
      </p>
      {c.eljaroUgyved.nev && (
        <p className="text-xs text-muted-foreground mt-2">
          Eljáró ügyvéd: <strong className="text-foreground">{c.eljaroUgyved.nev}</strong>
          {c.eljaroUgyved.iroda ? ` — ${c.eljaroUgyved.iroda}` : ""}
          {c.eljaroUgyved.kaszSzam ? ` (KASZ: ${c.eljaroUgyved.kaszSzam})` : ""}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completion.szazalek}%` }} />
        </div>
        <span className="text-xs text-muted-foreground font-mono w-28 text-right">
          {completion.szazalek}% kész ({completion.kitoltott}/{completion.osszes})
        </span>
      </div>
      {status.beadva && (
        <p className="text-xs text-primary mt-2">
          Az adatlapot beküldte. A módosításokat az ügyvéd e-mailben kérheti.
        </p>
      )}
    </div>
  );
}

function EladoIngatlan({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  return (
    <>
      <FormSection title="5. Ingatlan adatai">
        <Grid>
          <Field label="Település">
            <Input
              value={c.property.telepules}
              onChange={(v) => update((d) => void (d.property.telepules = v))}
            />
          </Field>
          <Field label="Irányítószám">
            <Input
              value={c.property.iranyitoszam}
              onChange={(v) => update((d) => void (d.property.iranyitoszam = v))}
            />
          </Field>
          <Field label="Cím (közterület, házszám, emelet/ajtó)">
            <Input
              value={c.property.cim}
              onChange={(v) => update((d) => void (d.property.cim = v))}
            />
          </Field>
          <Field label="Helyrajzi szám">
            <Input
              value={c.property.helyrajziSzam}
              onChange={(v) => update((d) => void (d.property.helyrajziSzam = v))}
            />
          </Field>
          <Field label="Ingatlan típusa (lakás, családi ház stb.)">
            <Input
              value={c.property.ingatlanTipus}
              onChange={(v) => update((d) => void (d.property.ingatlanTipus = v))}
            />
          </Field>
          <Field label="Alapterület (m²)">
            <Input
              value={c.property.alapterulet}
              onChange={(v) => update((d) => void (d.property.alapterulet = v))}
            />
          </Field>
          <Field label="Energetikai tanúsítvány azonosítója">
            <Input
              value={c.property.energetikaiTanusitvany}
              onChange={(v) => update((d) => void (d.property.energetikaiTanusitvany = v))}
            />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title="6. Birtokbaadás">
        <Grid>
          <Field label="Birtokbaadás tervezett dátuma">
            <Input
              type="date"
              value={c.possession.datum}
              onChange={(v) => update((d) => void (d.possession.datum = v))}
            />
          </Field>
          <Field label="Az ingatlan jelenlegi állapota">
            <select
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
              value={c.property.hasznalatiStatusz}
              onChange={(e) =>
                update((d) => {
                  d.property.hasznalatiStatusz = e.target.value as
                    | "lakott"
                    | "ures"
                    | "berbeadott"
                    | "";
                })
              }
            >
              <option value="">— válasszon —</option>
              <option value="ures">Üres</option>
              <option value="lakott">Lakott (eladó által)</option>
              <option value="berbeadott">Bérbeadott</option>
            </select>
          </Field>
        </Grid>
      </FormSection>
    </>
  );
}

function VevoFizetes({
  c,
  update,
}: {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}) {
  return (
    <>
      <FormSection title="5. Vételár és fizetés">
        <Grid>
          <Field label="Teljes vételár (számokkal)">
            <Input
              value={c.payment.teljesVetelar}
              onChange={(v) => update((d) => void (d.payment.teljesVetelar = v))}
            />
          </Field>
          <Field label="Pénznem">
            <select
              className="rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground"
              value={c.payment.penznem}
              onChange={(e) =>
                update(
                  (d) => void (d.payment.penznem = e.target.value as "HUF" | "EUR" | "USD"),
                )
              }
            >
              <option value="HUF">HUF</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Önerő összege">
            <Input
              value={c.payment.onero}
              onChange={(v) => update((d) => void (d.payment.onero = v))}
            />
          </Field>
          <Field label="Utalási célszámlaszám (eladó / ügyvédi letét)">
            <Input
              value={c.payment.utalasiSzamlaszam}
              onChange={(v) => update((d) => void (d.payment.utalasiSzamlaszam = v))}
            />
          </Field>
        </Grid>
      </FormSection>

      <FormSection title="6. Foglaló / előleg / hitel">
        <div className="space-y-3">
          <CheckBox
            label="Foglalót fizetek"
            checked={c.payment.foglaloVan}
            onChange={(v) => update((d) => void (d.payment.foglaloVan = v))}
          />
          {c.payment.foglaloVan && (
            <Field label="Foglaló összege">
              <Input
                value={c.payment.foglaloOsszeg}
                onChange={(v) => update((d) => void (d.payment.foglaloOsszeg = v))}
              />
            </Field>
          )}
          <CheckBox
            label="Bankhitelből fizetek"
            checked={c.payment.bankhitelVan}
            onChange={(v) => update((d) => void (d.payment.bankhitelVan = v))}
          />
          {c.payment.bankhitelVan && (
            <Grid>
              <Field label="Bank neve">
                <Input
                  value={c.payment.bankNeve}
                  onChange={(v) => update((d) => void (d.payment.bankNeve = v))}
                />
              </Field>
              <Field label="Hitel összege">
                <Input
                  value={c.payment.hitelOsszeg}
                  onChange={(v) => update((d) => void (d.payment.hitelOsszeg = v))}
                />
              </Field>
              <Field label="Folyósítás várható határideje">
                <Input
                  type="date"
                  value={c.payment.hitelFolyositasHatarido}
                  onChange={(v) => update((d) => void (d.payment.hitelFolyositasHatarido = v))}
                />
              </Field>
            </Grid>
          )}
        </div>
      </FormSection>
    </>
  );
}

// ------ small primitives ------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-md border border-border bg-card p-6">{children}</div>
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Belső demo — ügyvédi ellenőrzésre váró adatok. A rendszer nem helyettesíti az ügyvéd
          szakmai döntését.
        </p>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      className={inputCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      className={`${inputCls} min-h-[80px]`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[color:var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
