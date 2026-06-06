// Kiegészítő modulok: B400, Pmt., JÜB, 251/2014, Társasház, Ellenőrzési checklist
// Belső tesztverzió — minden eredmény ügyvédi visszaigazolást igényel.

export interface PmtAdatok {
  ugyfelTipus: "termeszetes" | "ceg";
  azonositasModja: "szemelyes" | "elektronikus" | "video";
  tenylegesTulajdonosNeve: string;
  tenylegesTulajdonosCim: string;
  tenylegesTulajdonosSzulHely: string;
  tenylegesTulajdonosSzulIdo: string;
  tulajdoniReszesedes: string;
  pep: boolean; // kiemelt közszereplő
  pepReszlet: string;
  kockazatiBesorolas: "alacsony" | "kozepes" | "magas";
  kockazatiIndok: string;
  forrasIgazolt: boolean;
  forrasMegjegyzes: string;
}

export interface B400Adatok {
  szerzodesDatuma: string;
  vetelar: string;
  szerzettHanyad: string;
  illetekkedvezmenyKod: string;
  forgalmiErtek: string;
  megjegyzes: string;
}

export interface JubResultat {
  okmanySzam: string;
  okmanyTipus: string;
  nev: string;
  status: "ervenyes" | "korozott" | "lejart" | "ismeretlen";
  lekerdezesIdeje: string;
  mockId: string;
}

export interface KulfoldiVevoModul {
  alkalmazando: boolean;
  vevoAllampolgarsag: string;
  eea: boolean; // EGT-állam polgára (mentesülhet)
  engedelyKerelmeKell: boolean;
  szandeknyilatkozat: string;
  kerelemElokeszitve: boolean;
  megjegyzes: string;
}

export interface TarsashaziModul {
  alapitoOkiratEllenoirzve: boolean;
  szmszEllenoirzve: boolean;
  kozosKoltsegTartozasEllenoirizve: boolean;
  kozosKoltsegTartozasOsszeg: string;
  kozosKepviseloNev: string;
  kozosKepviseloIgazolas: boolean;
  hazirendAtadva: boolean;
  felujitasiAlap: string;
  megjegyzes: string;
}

export interface EllenorzesiChecklist {
  tulajdoniLapBeszerezve: boolean;
  tulajdoniLapDatuma: string;
  terkepmasolatBeszerezve: boolean;
  cegkivonatBeszerezve: boolean;
  cegkivonatDatuma: string;
  alarrasiCimpeldanyBeszerezve: boolean;
  gyamhatosagiHatarozatBeszerezve: boolean;
  gyamhatosagiHatarozatSzama: string;
  okmanyellenorzes: boolean;
  energetikaiTanusitvanyBeszerezve: boolean;
  egyebJegyzet: string;
}

export interface ModulokState {
  pmt: PmtAdatok;
  b400: B400Adatok;
  jub: JubResultat | null;
  kulfoldi: KulfoldiVevoModul;
  tarsashaz: TarsashaziModul;
  ellenorzes: EllenorzesiChecklist;
}

export function emptyModulok(): ModulokState {
  return {
    pmt: {
      ugyfelTipus: "termeszetes",
      azonositasModja: "szemelyes",
      tenylegesTulajdonosNeve: "",
      tenylegesTulajdonosCim: "",
      tenylegesTulajdonosSzulHely: "",
      tenylegesTulajdonosSzulIdo: "",
      tulajdoniReszesedes: "",
      pep: false,
      pepReszlet: "",
      kockazatiBesorolas: "alacsony",
      kockazatiIndok: "",
      forrasIgazolt: false,
      forrasMegjegyzes: "",
    },
    b400: {
      szerzodesDatuma: "",
      vetelar: "",
      szerzettHanyad: "1/1",
      illetekkedvezmenyKod: "",
      forgalmiErtek: "",
      megjegyzes: "",
    },
    jub: null,
    kulfoldi: {
      alkalmazando: false,
      vevoAllampolgarsag: "",
      eea: true,
      engedelyKerelmeKell: false,
      szandeknyilatkozat: "",
      kerelemElokeszitve: false,
      megjegyzes: "",
    },
    tarsashaz: {
      alapitoOkiratEllenoirzve: false,
      szmszEllenoirzve: false,
      kozosKoltsegTartozasEllenoirizve: false,
      kozosKoltsegTartozasOsszeg: "",
      kozosKepviseloNev: "",
      kozosKepviseloIgazolas: false,
      hazirendAtadva: false,
      felujitasiAlap: "",
      megjegyzes: "",
    },
    ellenorzes: {
      tulajdoniLapBeszerezve: false,
      tulajdoniLapDatuma: "",
      terkepmasolatBeszerezve: false,
      cegkivonatBeszerezve: false,
      cegkivonatDatuma: "",
      alarrasiCimpeldanyBeszerezve: false,
      gyamhatosagiHatarozatBeszerezve: false,
      gyamhatosagiHatarozatSzama: "",
      okmanyellenorzes: false,
      energetikaiTanusitvanyBeszerezve: false,
      egyebJegyzet: "",
    },
  };
}

// JÜB mock — DEMO célokra; a valódi JÜB ügyvédi azonosítást és külön rendszerhozzáférést igényel.
export function mockJubLekerdezes(input: {
  okmanySzam: string;
  okmanyTipus: string;
  nev: string;
}): JubResultat {
  return {
    okmanySzam: input.okmanySzam,
    okmanyTipus: input.okmanyTipus,
    nev: input.nev,
    status: "ervenyes",
    lekerdezesIdeje: new Date().toISOString(),
    mockId: "MOCK-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
  };
}
