import type { CaseFile, NaturalPerson, Company } from "./types";
import { emptyModulok } from "./modulok";
import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// In-memory case store, hydrated from Lovable Cloud (per-user).
// All public functions remain synchronous to preserve the call sites in
// Workspace.tsx, CaseSwitcher.tsx, IntakeLinkPanel.tsx and adatbekero.
// Writes update the in-memory store synchronously and queue a debounced
// background upsert to Supabase. Hydration is async and must be awaited
// from the authenticated Workspace on mount before rendering.
// =====================================================================

interface CaseStore {
  activeId: string;
  cases: Record<string, CaseFile>;
}

let store: CaseStore = { activeId: "", cases: {} };
let currentUserId: string | null = null;
let hydrated = false;

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DEBOUNCE_MS = 800;

export function emptyCase(): CaseFile {
  return {
    ugyAzonosito: "",
    letrehozva: "",
    eljaroUgyved: { nev: "", kaszSzam: "", iroda: "", irodaCim: "", email: "", telefon: "", website: "", rovidHeader: "", logoDataUrl: "", pecsetDataUrl: "" },
    transactionTypes: [],
    parties: [],
    property: {
      telepules: "",
      iranyitoszam: "",
      cim: "",
      helyrajziSzam: "",
      ingatlanTipus: "",
      muvelesiAg: "",
      alapterulet: "",
      tulajdoniHanyad: "1/1",
      tarsashaziAlbetet: false,
      teremgarazsTarolo: false,
      energetikaiTanusitvany: "",
      birtokbanElado: true,
      hasznalatiStatusz: "",
      birtokbaadasTervezett: "",
      encumbrances: {
        jelzalog: false,
        vegrehajtas: false,
        haszonelvezet: false,
        elidegenitesiTilalom: false,
        elovasarlasiJog: false,
        szolgalmiJog: false,
        egyeb: "",
      },
      tehermentesitesiTerv: "",
    },
    payment: {
      teljesVetelar: "",
      penznem: "HUF",
      afaKezeles: "",
      foglaloVan: false,
      foglaloOsszeg: "",
      elolegVan: false,
      onero: "",
      bankhitelVan: false,
      bankNeve: "",
      hitelOsszeg: "",
      hitelFolyositasHatarido: "",
      reszletfizetes: false,
      fizetesiUtemezes: "",
      ugyvediLetet: false,
      meglevoTeherKivaltas: false,
      tehermentesitesModja: "",
      utalasiSzamlaszam: "",
    },
    possession: {
      datum: "",
      feltetel: "",
      kozmuAtiras: true,
      kulcsAtadas: true,
      eladoKikoltozes: "",
      ingosagokMaradnak: false,
      ingosagokListaja: "",
      kotberKesedelem: false,
      kotberOsszeg: "",
    },
    special: {
      zartkertStatus: undefined,
      foldforgalmi: {
        fold: false,
        muvelesiAg: "",
        vevoFoldmuves: false,
        eladoFoldmuves: false,
        vevoHelybenLako: false,
        vevoSzomszed: false,
        haszonberlet: false,
        foldhasznalo: false,
        elovasarlasErintett: false,
        kifuggesztes: false,
        hatosagiJovahagyas: false,
        tulajdonszerzesiKorlat: false,
        nyilatkozatok: false,
        nyomtatasiValtozat: "sima",
        biztonsagiOkmanySorszam: "",
        biztonsagiOkmanyKiallito: "",
      },
    },
    modulok: emptyModulok(),
    intake: {
      elado: { token: "", letrehozva: "", utoljaraMentve: "", beadva: false, beadvaIdo: "" },
      vevo: { token: "", letrehozva: "", utoljaraMentve: "", beadva: false, beadvaIdo: "" },
    },
  };
}

export interface CaseSummary {
  id: string;
  cimke: string;
  ugyAzonosito: string;
  utoljaraMentve: string;
  letrehozva: string;
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCase(raw: Partial<CaseFile> | null | undefined): CaseFile {
  const base = emptyCase();
  if (!raw) return base;
  const rawModulok = raw.modulok;
  return {
    ...base,
    ...raw,
    eljaroUgyved: { ...base.eljaroUgyved, ...(raw.eljaroUgyved ?? {}) },
    modulok: {
      ...base.modulok,
      ...(rawModulok ?? {}),
      pmt: { ...base.modulok.pmt, ...(rawModulok?.pmt ?? {}) },
      b400: { ...base.modulok.b400, ...(rawModulok?.b400 ?? {}) },
      kulfoldi: { ...base.modulok.kulfoldi, ...(rawModulok?.kulfoldi ?? {}) },
      tarsashaz: { ...base.modulok.tarsashaz, ...(rawModulok?.tarsashaz ?? {}) },
      ellenorzes: { ...base.modulok.ellenorzes, ...(rawModulok?.ellenorzes ?? {}) },
    },
    intake: {
      elado: { ...base.intake.elado, ...(raw.intake?.elado ?? {}) },
      vevo: { ...base.intake.vevo, ...(raw.intake?.vevo ?? {}) },
    },
  } as CaseFile;
}

/**
 * Strip the top-level metadata (id, cimke, ugyAzonosito, letrehozva, utoljaraMentve)
 * before writing CaseFile contents into the `data` jsonb column. We store those
 * fields in their own columns so we can query and order without parsing JSON.
 */
function dataPayload(c: CaseFile): Record<string, unknown> {
  const { id: _id, cimke: _cimke, ugyAzonosito: _ua, letrehozva: _lh, utoljaraMentve: _um, ...rest } = c;
  void _id; void _cimke; void _ua; void _lh; void _um;
  return rest;
}

/** Hydrate the in-memory store from Lovable Cloud for the signed-in user.
 *  Called by the authenticated Workspace on mount. Safe to call multiple times. */
export async function hydrateCases(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    store = { activeId: "", cases: {} };
    currentUserId = null;
    hydrated = true;
    return;
  }
  currentUserId = user.id;

  const { data, error } = await supabase
    .from("matters")
    .select("*")
    .is("deleted_at", null)
    .order("utoljara_mentve", { ascending: false });

  if (error) {
    console.error("[state] hydrateCases failed:", error);
    store = { activeId: "", cases: {} };
    hydrated = true;
    return;
  }

  const cases: Record<string, CaseFile> = {};
  for (const row of data ?? []) {
    const c = normalizeCase((row.data as Partial<CaseFile>) ?? {});
    c.id = row.id;
    c.cimke = row.cimke ?? "Névtelen ügy";
    c.ugyAzonosito = row.ugy_azonosito ?? "";
    c.letrehozva = row.letrehozva ?? row.created_at ?? "";
    c.utoljaraMentve = row.utoljara_mentve ?? row.updated_at ?? "";
    cases[row.id] = c;
  }
  const activeId = Object.keys(cases)[0] ?? "";
  store = { activeId, cases };
  hydrated = true;
}

export function isCasesHydrated(): boolean {
  return hydrated;
}

export function resetCasesStore() {
  for (const t of saveTimers.values()) clearTimeout(t);
  saveTimers.clear();
  store = { activeId: "", cases: {} };
  currentUserId = null;
  hydrated = false;
}

// ---------- background persistence ----------

async function syncIntakeTokens(c: CaseFile) {
  if (!c.id) return;
  const rows: Array<{ token: string; matter_id: string; szerep: "elado" | "vevo" }> = [];
  for (const szerep of ["elado", "vevo"] as const) {
    const tok = c.intake?.[szerep]?.token;
    if (tok) rows.push({ token: tok, matter_id: c.id, szerep });
  }
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("intake_tokens")
    .upsert(rows, { onConflict: "token" });
  if (error) console.error("[state] intake token sync failed:", error);
}

async function persistMatter(c: CaseFile) {
  if (!currentUserId || !c.id) return;
  const payload = {
    id: c.id,
    user_id: currentUserId,
    cimke: c.cimke ?? "Névtelen ügy",
    ugy_azonosito: c.ugyAzonosito ?? "",
    // Postgres jsonb column — cast to satisfy the generated row type.
    data: dataPayload(c) as unknown as never,
    letrehozva: c.letrehozva || new Date().toISOString(),
    utoljara_mentve: new Date().toISOString(),
  };
  const { error } = await supabase.from("matters").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[state] matter persist failed:", error);
    return;
  }
  await syncIntakeTokens(c);
}

function queuePersist(c: CaseFile) {
  if (!c.id) return;
  const existing = saveTimers.get(c.id);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    saveTimers.delete(c.id!);
    void persistMatter(c);
  }, SAVE_DEBOUNCE_MS);
  saveTimers.set(c.id, t);
}

// ---------- public API (synchronous, in-memory) ----------

export function listCases(): CaseSummary[] {
  return Object.values(store.cases)
    .map<CaseSummary>((c) => ({
      id: c.id ?? "",
      cimke: c.cimke || c.ugyAzonosito || "Névtelen ügy",
      ugyAzonosito: c.ugyAzonosito,
      utoljaraMentve: c.utoljaraMentve ?? "",
      letrehozva: c.letrehozva,
    }))
    .sort((a, b) =>
      (b.utoljaraMentve || b.letrehozva).localeCompare(
        a.utoljaraMentve || a.letrehozva,
      ),
    );
}

export function getActiveCaseId(): string {
  return store.activeId;
}

export function loadCase(): CaseFile {
  if (store.activeId && store.cases[store.activeId]) {
    return store.cases[store.activeId];
  }
  return emptyCase();
}

/** Synchronous local lookup — kept for legacy callers. The public intake
 *  page must use the RPC-backed loader, not this. */
export function findCaseByIntakeToken(token: string): CaseFile | null {
  if (!token) return null;
  for (const c of Object.values(store.cases)) {
    if (
      c.intake?.elado?.token === token ||
      c.intake?.vevo?.token === token
    ) {
      return c;
    }
  }
  return null;
}

export function saveCaseById(c: CaseFile) {
  if (!c.id) return;
  const next: CaseFile = {
    ...c,
    utoljaraMentve: new Date().toISOString(),
  };
  store.cases[c.id] = next;
  queuePersist(next);
}

export function saveCase(c: CaseFile) {
  let id = c.id || store.activeId;
  if (!id) id = genId();
  const next: CaseFile = {
    ...c,
    id,
    cimke: c.cimke || c.ugyAzonosito || "Névtelen ügy",
    letrehozva: c.letrehozva || new Date().toISOString(),
    utoljaraMentve: new Date().toISOString(),
  };
  store.cases[id] = next;
  store.activeId = id;
  queuePersist(next);
}

export function switchCase(id: string): CaseFile | null {
  if (!store.cases[id]) return null;
  store.activeId = id;
  return store.cases[id];
}

export function createCase(label?: string): CaseFile {
  const c = emptyCase();
  c.id = genId();
  c.cimke = label?.trim() || "Új ügy";
  c.letrehozva = new Date().toISOString();
  c.utoljaraMentve = new Date().toISOString();
  store.cases[c.id] = c;
  store.activeId = c.id;
  queuePersist(c);
  return c;
}

export function duplicateCase(id: string): CaseFile | null {
  const src = store.cases[id];
  if (!src) return null;
  const copy: CaseFile = JSON.parse(JSON.stringify(src));
  copy.id = genId();
  copy.cimke = `${src.cimke || src.ugyAzonosito || "Ügy"} (másolat)`;
  // Új intake tokeneket NEM másolunk, hogy ne lyukadjon ki a token→ügy mapping.
  copy.intake = {
    elado: { token: "", letrehozva: "", utoljaraMentve: "", beadva: false, beadvaIdo: "" },
    vevo: { token: "", letrehozva: "", utoljaraMentve: "", beadva: false, beadvaIdo: "" },
  };
  copy.letrehozva = new Date().toISOString();
  copy.utoljaraMentve = new Date().toISOString();
  store.cases[copy.id!] = copy;
  store.activeId = copy.id!;
  queuePersist(copy);
  return copy;
}

export function renameCase(id: string, label: string) {
  const c = store.cases[id];
  if (!c) return;
  c.cimke = label.trim() || c.ugyAzonosito || "Névtelen ügy";
  c.utoljaraMentve = new Date().toISOString();
  queuePersist(c);
}

export function deleteCase(id: string): CaseFile | null {
  if (!store.cases[id]) return null;
  delete store.cases[id];
  if (store.activeId === id) {
    store.activeId = Object.keys(store.cases)[0] ?? "";
  }
  // Hard delete on server (intake_tokens cascade).
  void supabase.from("matters").delete().eq("id", id).then(({ error }) => {
    if (error) console.error("[state] delete failed:", error);
  });
  return store.activeId ? store.cases[store.activeId] : null;
}

export function clearCase() {
  if (store.activeId) deleteCase(store.activeId);
}

export function newId(prefix = "p"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function demoCase(): CaseFile {
  const base = emptyCase();
  base.letrehozva = new Date().toISOString();
  base.ugyAzonosito = "DEMO-2026-001";
  base.eljaroUgyved = {
    nev: "dr. Szladits Anna",
    kaszSzam: "36071234",
    iroda: "Szladits Ügyvédi Iroda",
    irodaCim: "1051 Budapest, Október 6. utca 12. II/4.",
  };
  base.transactionTypes = ["lakas", "tarsashazi_albetet", "hitellel_erintett"];
  const elado: NaturalPerson = {
    kind: "termeszetes",
    id: newId(),
    szerep: "elado",
    nev: "Kovács Béla",
    szuletesiNev: "Kovács Béla",
    anyjaNeve: "Nagy Erzsébet",
    szuletesiHely: "Budapest",
    szuletesiDatum: "1965-04-12",
    lakcim: "1052 Budapest, Váci utca 10.",
    okmanyAzonosito: "123456AB",
    adoazonosito: "8412345678",
    allampolgarsag: "magyar",
    tulajdoniHanyad: "1/1",
  };
  const vevo: NaturalPerson = {
    kind: "termeszetes",
    id: newId(),
    szerep: "vevo",
    nev: "Szabó Anna",
    szuletesiNev: "Szabó Anna",
    anyjaNeve: "Kiss Mária",
    szuletesiHely: "Debrecen",
    szuletesiDatum: "1990-09-23",
    lakcim: "4024 Debrecen, Piac utca 5.",
    okmanyAzonosito: "654321CD",
    adoazonosito: "8498765432",
    allampolgarsag: "magyar",
    tulajdoniHanyad: "1/1",
  };
  const bank: Company = {
    kind: "ceg",
    id: newId(),
    szerep: "vevo",
    cegnev: "Példa Kft. (társvevő)",
    cegjegyzekszam: "01-09-123456",
    adoszam: "12345678-2-41",
    szekhely: "1051 Budapest, Példa tér 1.",
    kepviseloNeve: "Tóth Péter ügyvezető",
    kepviseletModja: "önálló",
    cegkivonatDatuma: "2026-05-01",
    alairasiCimpeldanySzukseges: true,
    tulajdoniHanyad: "0/0",
    kulfoldiSzekhely: false,
  };
  base.parties = [elado, vevo, bank];
  base.property = {
    ...base.property,
    telepules: "Budapest",
    iranyitoszam: "1052",
    cim: "Váci utca 10. fszt. 2.",
    helyrajziSzam: "24567/0/A/2",
    ingatlanTipus: "lakás (társasházi albetét)",
    muvelesiAg: "",
    alapterulet: "62",
    tarsashaziAlbetet: true,
    teremgarazsTarolo: true,
    energetikaiTanusitvany: "HET-2026-00123",
    hasznalatiStatusz: "lakott",
    birtokbaadasTervezett: "2026-08-15",
    encumbrances: {
      ...base.property.encumbrances,
      jelzalog: true,
    },
    tehermentesitesiTerv:
      "Az eladó banki jelzálogja a vételárból kerül kiváltásra ügyvédi letét útján.",
  };
  base.payment = {
    ...base.payment,
    teljesVetelar: "85000000",
    afaKezeles: "afa_korin_kivuli",
    foglaloVan: true,
    foglaloOsszeg: "5000000",
    elolegVan: true,
    onero: "25000000",
    bankhitelVan: true,
    bankNeve: "Példa Bank Zrt.",
    hitelOsszeg: "55000000",
    hitelFolyositasHatarido: "2026-07-31",
    ugyvediLetet: true,
    meglevoTeherKivaltas: true,
    tehermentesitesModja: "Vételárból, banki kiváltási nyilatkozat alapján.",
    utalasiSzamlaszam: "12345678-12345678-12345678",
  };
  base.possession.datum = "2026-08-15";
  base.possession.feltetel = "A teljes vételár megfizetése.";
  return base;
}
