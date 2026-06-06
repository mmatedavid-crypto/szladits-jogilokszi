import type { CaseFile, NaturalPerson, Company } from "./types";
import { emptyModulok } from "./modulok";



export function emptyCase(): CaseFile {
  return {
    ugyAzonosito: "",
    letrehozva: "",
    eljaroUgyved: { nev: "", kaszSzam: "", iroda: "", irodaCim: "" },
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

// --- Multi-case storage ---
// Egy ügyvédnek több adásvétele lehet egyszerre folyamatban,
// ezért a CaseFile-eket egy közös store-ban tartjuk.
const STORE_KEY = "szladits.cases.v1";

export interface CaseSummary {
  id: string;
  cimke: string;
  ugyAzonosito: string;
  utoljaraMentve: string;
  letrehozva: string;
}

interface CaseStore {
  activeId: string;
  cases: Record<string, CaseFile>;
}

function genCaseId(): string {
  return `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeCase(raw: Partial<CaseFile>): CaseFile {
  const base = emptyCase();
  return {
    ...base,
    ...raw,
    eljaroUgyved: { ...base.eljaroUgyved, ...(raw.eljaroUgyved ?? {}) },
    modulok: { ...base.modulok, ...(raw.modulok ?? {}) },
    intake: {
      elado: { ...base.intake.elado, ...(raw.intake?.elado ?? {}) },
      vevo: { ...base.intake.vevo, ...(raw.intake?.vevo ?? {}) },
    },
  } as CaseFile;
}

function readStore(): CaseStore {
  if (typeof window === "undefined") {
    return { activeId: "", cases: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CaseStore;
      if (parsed && parsed.cases && typeof parsed.cases === "object") {
        const cases: Record<string, CaseFile> = {};
        for (const [id, c] of Object.entries(parsed.cases)) {
          const nc = normalizeCase(c as Partial<CaseFile>);
          nc.id = id;
          cases[id] = nc;
        }
        const activeId =
          parsed.activeId && cases[parsed.activeId]
            ? parsed.activeId
            : Object.keys(cases)[0] ?? "";
        return { activeId, cases };
      }
    }
    // Migráció: régi egy-ügy storage
    const legacy = window.localStorage.getItem("szladits.casefile.v2");
    if (legacy) {
      const c = normalizeCase(JSON.parse(legacy) as Partial<CaseFile>);
      const id = genCaseId();
      c.id = id;
      c.cimke = c.ugyAzonosito || "Korábbi ügy";
      c.utoljaraMentve = new Date().toISOString();
      const store: CaseStore = { activeId: id, cases: { [id]: c } };
      writeStore(store);
      return store;
    }
  } catch {
    // ignore
  }
  return { activeId: "", cases: {} };
}

function writeStore(store: CaseStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function listCases(): CaseSummary[] {
  const store = readStore();
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
  return readStore().activeId;
}

export function loadCase(): CaseFile {
  const store = readStore();
  if (store.activeId && store.cases[store.activeId]) {
    return store.cases[store.activeId];
  }
  // Üres állapot — még nincs egy ügy sem
  return emptyCase();
}

/** Megkeresi azt az ügyet, amelyhez egy adott intake token tartozik. */
export function findCaseByIntakeToken(token: string): CaseFile | null {
  if (!token) return null;
  const store = readStore();
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
  if (typeof window === "undefined" || !c.id) return;
  const store = readStore();
  store.cases[c.id] = {
    ...c,
    utoljaraMentve: new Date().toISOString(),
  };
  writeStore(store);
}


export function saveCase(c: CaseFile) {
  if (typeof window === "undefined") return;
  const store = readStore();
  let id = c.id || store.activeId;
  if (!id) {
    id = genCaseId();
  }
  const next: CaseFile = {
    ...c,
    id,
    cimke: c.cimke || c.ugyAzonosito || "Névtelen ügy",
    utoljaraMentve: new Date().toISOString(),
  };
  store.cases[id] = next;
  store.activeId = id;
  writeStore(store);
}

export function switchCase(id: string): CaseFile | null {
  const store = readStore();
  if (!store.cases[id]) return null;
  store.activeId = id;
  writeStore(store);
  return store.cases[id];
}

export function createCase(label?: string): CaseFile {
  const store = readStore();
  const c = emptyCase();
  const id = genCaseId();
  c.id = id;
  c.cimke = label?.trim() || "Új ügy";
  c.letrehozva = new Date().toISOString();
  c.utoljaraMentve = new Date().toISOString();
  store.cases[id] = c;
  store.activeId = id;
  writeStore(store);
  return c;
}

export function duplicateCase(id: string): CaseFile | null {
  const store = readStore();
  const src = store.cases[id];
  if (!src) return null;
  const copy: CaseFile = JSON.parse(JSON.stringify(src));
  const newIdv = genCaseId();
  copy.id = newIdv;
  copy.cimke = `${src.cimke || src.ugyAzonosito || "Ügy"} (másolat)`;
  copy.letrehozva = new Date().toISOString();
  copy.utoljaraMentve = new Date().toISOString();
  store.cases[newIdv] = copy;
  store.activeId = newIdv;
  writeStore(store);
  return copy;
}

export function renameCase(id: string, label: string) {
  const store = readStore();
  const c = store.cases[id];
  if (!c) return;
  c.cimke = label.trim() || c.ugyAzonosito || "Névtelen ügy";
  c.utoljaraMentve = new Date().toISOString();
  writeStore(store);
}

export function deleteCase(id: string): CaseFile | null {
  const store = readStore();
  if (!store.cases[id]) return null;
  delete store.cases[id];
  if (store.activeId === id) {
    store.activeId = Object.keys(store.cases)[0] ?? "";
  }
  writeStore(store);
  return store.activeId ? store.cases[store.activeId] : null;
}

/** Csak az aktív ügyet törli (a régi „Mentés törlése" gomb viselkedés). */
export function clearCase() {
  const store = readStore();
  if (store.activeId) {
    deleteCase(store.activeId);
  }
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
    muvelesiAg: "—",
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
