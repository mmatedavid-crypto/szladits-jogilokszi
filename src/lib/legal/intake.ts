// Adatbekérő (client intake) utilities.
// A token-alapú belső demo: az ügyvéd generálja a linket, az eladó/vevő ugyanazon
// böngészőben megnyitja és kitölti az adatait. A token a CaseFile.intake mezőben tárolva.

import type { CaseFile, NaturalPerson, PartyRole, Party } from "./types";

export function generateIntakeToken(role: PartyRole): string {
  const rnd = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  return `${role}-${rnd}`;
}

export function getIntakeUrl(token: string): string {
  if (typeof window === "undefined") return `/adatbekero/${token}`;
  return `${window.location.origin}/adatbekero/${token}`;
}

export function findRoleByToken(c: CaseFile, token: string): PartyRole | null {
  if (c.intake.elado.token && c.intake.elado.token === token) return "elado";
  if (c.intake.vevo.token && c.intake.vevo.token === token) return "vevo";
  return null;
}

// A párt, akinek adatait az intake form kitölti (az adott role első természetes személye).
export function findPartyForRole(c: CaseFile, role: PartyRole): NaturalPerson | undefined {
  return c.parties.find(
    (p): p is NaturalPerson => p.kind === "termeszetes" && p.szerep === role,
  );
}

// Az intake form-on KÖTELEZŐEN bekért természetes személy mezők.
const REQUIRED_PARTY_FIELDS: { key: keyof NaturalPerson; label: string }[] = [
  { key: "nev", label: "Név" },
  { key: "szuletesiNev", label: "Születési név" },
  { key: "anyjaNeve", label: "Anyja neve" },
  { key: "szuletesiHely", label: "Születési hely" },
  { key: "szuletesiDatum", label: "Születési idő" },
  { key: "lakcim", label: "Lakcím" },
  { key: "okmanyAzonosito", label: "Okmányazonosító" },
  { key: "adoazonosito", label: "Adóazonosító jel" },
  { key: "allampolgarsag", label: "Állampolgárság" },
  { key: "tulajdoniHanyad", label: "Tulajdoni hányad" },
];

// Az ingatlan / vételár / fizetés / birtokbaadás mezők — a vevő intake formjában jelennek meg
// (az eladó form viszont az ingatlan és a terhek részt mutatja). Az ügyvéd a végén egységesíti.
export interface CompletionResult {
  szazalek: number;
  kitoltott: number;
  osszes: number;
  hianyok: string[];
}

export function calculateIntakeCompletion(c: CaseFile, role: PartyRole): CompletionResult {
  const party = findPartyForRole(c, role);
  const hianyok: string[] = [];
  let kitoltott = 0;
  let osszes = 0;

  // Személyes adatok
  for (const f of REQUIRED_PARTY_FIELDS) {
    osszes++;
    const val = party ? String(party[f.key] ?? "").trim() : "";
    if (val) kitoltott++;
    else hianyok.push(`${role === "elado" ? "Eladó" : "Vevő"} — ${f.label}`);
  }

  // Az eladótól: ingatlan + terhek; a vevőtől: vételár + fizetés + birtokbaadás
  if (role === "elado") {
    const pr = c.property;
    const ingMezok: [string, string][] = [
      ["Település", pr.telepules],
      ["Cím", pr.cim],
      ["Helyrajzi szám", pr.helyrajziSzam],
      ["Ingatlan típusa", pr.ingatlanTipus],
      ["Alapterület (m²)", pr.alapterulet],
    ];
    for (const [lbl, v] of ingMezok) {
      osszes++;
      if (v.trim()) kitoltott++;
      else hianyok.push(`Ingatlan — ${lbl}`);
    }
    osszes++;
    if (pr.energetikaiTanusitvany.trim()) kitoltott++;
    else hianyok.push("Ingatlan — Energetikai tanúsítvány");
  } else {
    const pm = c.payment;
    const fizMezok: [string, string][] = [
      ["Teljes vételár", pm.teljesVetelar],
      ["Utalási célszámlaszám", pm.utalasiSzamlaszam],
    ];
    for (const [lbl, v] of fizMezok) {
      osszes++;
      if (v.trim()) kitoltott++;
      else hianyok.push(`Fizetés — ${lbl}`);
    }
    if (pm.foglaloVan) {
      osszes++;
      if (pm.foglaloOsszeg.trim()) kitoltott++;
      else hianyok.push("Fizetés — Foglaló összege");
    }
    if (pm.bankhitelVan) {
      osszes++;
      if (pm.bankNeve.trim()) kitoltott++;
      else hianyok.push("Fizetés — Bank neve");
      osszes++;
      if (pm.hitelOsszeg.trim()) kitoltott++;
      else hianyok.push("Fizetés — Hitel összege");
    }
    osszes++;
    if (c.possession.datum.trim()) kitoltott++;
    else hianyok.push("Birtokbaadás — Dátum");
  }

  const szazalek = osszes === 0 ? 0 : Math.round((kitoltott / osszes) * 100);
  return { szazalek, kitoltott, osszes, hianyok };
}

// Hozzáad / lecserél egy adott role-hoz tartozó természetes személyt a felek között.
export function upsertNaturalPersonForRole(
  c: CaseFile,
  role: PartyRole,
  patch: Partial<NaturalPerson>,
): Party[] {
  const idx = c.parties.findIndex(
    (p) => p.kind === "termeszetes" && p.szerep === role,
  );
  if (idx >= 0) {
    const updated = { ...(c.parties[idx] as NaturalPerson), ...patch } as NaturalPerson;
    const copy = [...c.parties];
    copy[idx] = updated;
    return copy;
  }
  const created: NaturalPerson = {
    kind: "termeszetes",
    id: `${role}_${Math.random().toString(36).slice(2, 9)}`,
    szerep: role,
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
    ...patch,
  };
  return [...c.parties, created];
}
