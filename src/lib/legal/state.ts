import type { CaseFile, NaturalPerson, Company } from "./types";
import { emptyModulok } from "./modulok";

const STORAGE_KEY = "szladits.casefile.v2";

export function emptyCase(): CaseFile {
  return {
    ugyAzonosito: "",
    letrehozva: new Date().toISOString(),
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
      },
    },
    modulok: emptyModulok(),
  };
}

export function loadCase(): CaseFile {
  if (typeof window === "undefined") return emptyCase();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCase();
    const parsed = JSON.parse(raw) as Partial<CaseFile>;
    const base = emptyCase();
    return {
      ...base,
      ...parsed,
      modulok: { ...base.modulok, ...(parsed.modulok ?? {}) },
    } as CaseFile;
  } catch {
    return emptyCase();
  }
}

export function saveCase(c: CaseFile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}

export function clearCase() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function newId(prefix = "p"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function demoCase(): CaseFile {
  const base = emptyCase();
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
