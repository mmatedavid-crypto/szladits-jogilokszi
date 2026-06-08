import type { CaseFile, Party } from "./types";
import { bemenetCasebol, formatHuf, szamolIlletek } from "./illetek";
import { B400E_BEKULDO_LABELS, B400E_STATUSZ_LABELS } from "./modulok";

export type B400ECsomagStatusz = "kesz" | "hianyos";

export interface B400ECsomagMezo {
  id: string;
  csoport: string;
  cimke: string;
  ertek: string;
  kotelezo: boolean;
  hianyos: boolean;
  megjegyzes?: string;
}

export interface B400EBeadasiCsomag {
  statusz: B400ECsomagStatusz;
  mezok: B400ECsomagMezo[];
  hianyzoMezok: B400ECsomagMezo[];
  osszefoglalo: string;
}

function partyName(p: Party | undefined): string {
  if (!p) return "";
  return p.kind === "termeszetes" ? p.nev : p.cegnev;
}

function partyTaxId(p: Party | undefined): string {
  if (!p) return "";
  return p.kind === "termeszetes" ? p.adoazonosito : p.adoszam;
}

function partyAddress(p: Party | undefined): string {
  if (!p) return "";
  return p.kind === "termeszetes" ? p.lakcim : p.szekhely;
}

function partyBirthData(p: Party | undefined): string {
  if (!p || p.kind !== "termeszetes") return "";
  return [p.szuletesiHely, p.szuletesiDatum].filter(Boolean).join(", ");
}

function addField(fields: B400ECsomagMezo[], input: Omit<B400ECsomagMezo, "hianyos">) {
  fields.push({
    ...input,
    hianyos: input.kotelezo && !String(input.ertek ?? "").trim(),
  });
}

export function generateB400EBeadasiCsomag(c: CaseFile): B400EBeadasiCsomag {
  const buyer = c.parties.find((p) => p.szerep === "vevo");
  const seller = c.parties.find((p) => p.szerep === "elado");
  const ill = szamolIlletek(bemenetCasebol(c));
  const fields: B400ECsomagMezo[] = [];

  addField(fields, {
    id: "ugyazonosito",
    csoport: "Ügyirat",
    cimke: "Ügyazonosító",
    ertek: c.ugyAzonosito,
    kotelezo: false,
  });
  addField(fields, {
    id: "statusz",
    csoport: "Ügyirat",
    cimke: "B400E munkafolyamat státusza",
    ertek: B400E_STATUSZ_LABELS[c.modulok.b400.statusz],
    kotelezo: true,
  });
  addField(fields, {
    id: "bekuldo",
    csoport: "Ügyirat",
    cimke: "ONYA beküldő",
    ertek: c.modulok.b400.bekuldo ? B400E_BEKULDO_LABELS[c.modulok.b400.bekuldo] : "",
    kotelezo: true,
    megjegyzes: "Ha nem a vagyonszerző küldi be, a meghatalmazást külön ellenőrizni kell.",
  });
  addField(fields, {
    id: "szerzodes-datuma",
    csoport: "Szerződés",
    cimke: "Szerződés dátuma",
    ertek: c.modulok.b400.szerzodesDatuma || c.possession.datum,
    kotelezo: true,
  });

  addField(fields, {
    id: "vevo-nev",
    csoport: "Vagyonszerző / vevő",
    cimke: "Vevő neve / cégneve",
    ertek: partyName(buyer),
    kotelezo: true,
  });
  addField(fields, {
    id: "vevo-adoazonosito",
    csoport: "Vagyonszerző / vevő",
    cimke: "Vevő adóazonosító jele / adószáma",
    ertek: partyTaxId(buyer),
    kotelezo: true,
  });
  addField(fields, {
    id: "vevo-lakcim",
    csoport: "Vagyonszerző / vevő",
    cimke: "Vevő lakcíme / székhelye",
    ertek: partyAddress(buyer),
    kotelezo: true,
  });
  addField(fields, {
    id: "vevo-szuletesi-adatok",
    csoport: "Vagyonszerző / vevő",
    cimke: "Vevő születési helye, ideje",
    ertek: partyBirthData(buyer),
    kotelezo: buyer?.kind === "termeszetes",
  });

  addField(fields, {
    id: "elado-nev",
    csoport: "Eladó",
    cimke: "Eladó neve / cégneve",
    ertek: partyName(seller),
    kotelezo: true,
  });
  addField(fields, {
    id: "elado-azonosito",
    csoport: "Eladó",
    cimke: "Eladó adóazonosító jele / adószáma",
    ertek: partyTaxId(seller),
    kotelezo: false,
  });

  addField(fields, {
    id: "ingatlan-cim",
    csoport: "Ingatlan",
    cimke: "Ingatlan címe",
    ertek: [c.property.iranyitoszam, c.property.telepules, c.property.cim]
      .filter(Boolean)
      .join(" "),
    kotelezo: true,
  });
  addField(fields, {
    id: "hrsz",
    csoport: "Ingatlan",
    cimke: "Helyrajzi szám",
    ertek: c.property.helyrajziSzam,
    kotelezo: true,
  });
  addField(fields, {
    id: "ingatlan-tipus",
    csoport: "Ingatlan",
    cimke: "Ingatlan megnevezése",
    ertek: c.property.ingatlanTipus,
    kotelezo: true,
  });
  addField(fields, {
    id: "szerzett-hanyad",
    csoport: "Ingatlan",
    cimke: "Szerzett hányad",
    ertek: c.modulok.b400.szerzettHanyad,
    kotelezo: true,
  });

  addField(fields, {
    id: "vetelar",
    csoport: "Illetékalap és kedvezmények",
    cimke: "Vételár",
    ertek: c.payment.teljesVetelar,
    kotelezo: true,
  });
  addField(fields, {
    id: "forgalmi-ertek",
    csoport: "Illetékalap és kedvezmények",
    cimke: "Forgalmi érték",
    ertek: c.modulok.b400.forgalmiErtek || c.payment.teljesVetelar,
    kotelezo: true,
  });
  addField(fields, {
    id: "illetek-alap",
    csoport: "Illetékalap és kedvezmények",
    cimke: "Előzetes illetékalap",
    ertek: formatHuf(ill.alap),
    kotelezo: false,
    megjegyzes: "Szladits előzetes kalkuláció; az ONYA/NAV mezőket ügyvéd ellenőrzi.",
  });
  addField(fields, {
    id: "fizetendo-illetek",
    csoport: "Illetékalap és kedvezmények",
    cimke: "Előzetes fizetendő illeték",
    ertek: formatHuf(ill.fizetendo),
    kotelezo: false,
    megjegyzes: "Tájékoztató számítás, nem NAV határozat.",
  });
  addField(fields, {
    id: "kedvezmeny",
    csoport: "Illetékalap és kedvezmények",
    cimke: "Kedvezmény / mentesség kódja",
    ertek: c.modulok.b400.illetekkedvezmenyKod,
    kotelezo: false,
  });

  addField(fields, {
    id: "nyugta",
    csoport: "Beküldés visszaigazolása",
    cimke: "NAV nyugtaazonosító",
    ertek: c.modulok.b400.navNyugtaAzonosito,
    kotelezo: c.modulok.b400.statusz === "bekuldve",
  });

  const hianyzoMezok = fields.filter((field) => field.hianyos);
  return {
    statusz: hianyzoMezok.length ? "hianyos" : "kesz",
    mezok: fields,
    hianyzoMezok,
    osszefoglalo: fields
      .map((field) => `${field.csoport} / ${field.cimke}: ${field.ertek || "[hiányzik]"}`)
      .join("\n"),
  };
}
