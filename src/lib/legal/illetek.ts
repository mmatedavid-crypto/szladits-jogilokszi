// Visszterhes vagyonátruházási illeték kalkulátor
// 1990. évi XCIII. tv. (Itv.) — 2024-2025-ös szabályozási állapot.
// FIGYELEM: A hatály változhat, ügyvédi visszaigazolás szükséges.

import type { CaseFile } from "./types";

export interface IlletekBemenet {
  vetelar: number;
  forgalmiErtek?: number; // ha eltér, a magasabbat kell venni
  lakas: boolean;
  elsoLakas: boolean; // 35 év alatti első lakásszerzés
  elsoLakasKedvezmenyNelkul: boolean; // CSOK alapú további kedvezmény
  cserepotlo: boolean; // 1 éven belüli értékesítés/vétel
  cserepotloKulonbozet: number; // a cserepótló alapja
  csok: boolean;
  csalad5MFt: boolean; // CSOK Plusz alapján mentesség 4M-ig vagy más
  testverKozott: boolean;
  egyenesAgiRokon: boolean;
  vevoKor?: number; // 35 év alatti?
}

export interface IlletekEredmeny {
  alap: number;
  szazalek: number;
  szamitottIlletek: number;
  kedvezmenyek: { cim: string; osszeg: number }[];
  fizetendo: number;
  magyarazat: string[];
}

const PCT_LAKAS = 0.04;

export function bemenetCasebol(c: CaseFile): IlletekBemenet {
  const vetelar = Number(c.payment.teljesVetelar) || 0;
  const vevo = c.parties.find((p) => p.szerep === "vevo" && p.kind === "termeszetes");
  let kor: number | undefined;
  if (vevo && vevo.kind === "termeszetes" && vevo.szuletesiDatum) {
    const d = new Date(vevo.szuletesiDatum);
    if (!Number.isNaN(d.getTime())) {
      const today = new Date();
      kor = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) kor!--;
    }
  }
  const lakas =
    c.transactionTypes.includes("lakas") ||
    c.transactionTypes.includes("tarsashazi_albetet") ||
    c.transactionTypes.includes("csaladi_haz");

  return {
    vetelar,
    lakas,
    elsoLakas: false,
    elsoLakasKedvezmenyNelkul: false,
    cserepotlo: false,
    cserepotloKulonbozet: 0,
    csok: false,
    csalad5MFt: false,
    testverKozott: false,
    egyenesAgiRokon: false,
    vevoKor: kor,
  };
}

export function szamolIlletek(b: IlletekBemenet): IlletekEredmeny {
  const alap = Math.max(b.vetelar, b.forgalmiErtek ?? 0);
  const magyarazat: string[] = [];
  const kedvezmenyek: { cim: string; osszeg: number }[] = [];

  if (!b.lakas) {
    magyarazat.push(
      "Nem-lakás célú ingatlan: az általános 4%-os illeték az 1 milliárd Ft alatti részre, e fölött 2% (Itv. 19. §).",
    );
    const reszEgy = Math.min(alap, 1_000_000_000);
    const reszKetto = Math.max(0, alap - 1_000_000_000);
    const szam = reszEgy * 0.04 + reszKetto * 0.02;
    return {
      alap,
      szazalek: 4,
      szamitottIlletek: szam,
      kedvezmenyek,
      fizetendo: Math.round(szam),
      magyarazat,
    };
  }

  // Lakás: egységes 4%
  let szam = alap * PCT_LAKAS;
  magyarazat.push(`Lakáscélú ingatlan: ${PCT_LAKAS * 100}% illeték (Itv. 21. §).`);

  // Egyenes ági rokon / testvér: 0%
  if (b.egyenesAgiRokon) {
    kedvezmenyek.push({ cim: "Egyenes ági rokon (Itv. 26. § (1) z))", osszeg: szam });
    szam = 0;
    magyarazat.push("Egyenes ági rokonok közötti adásvétel illetékmentes.");
  } else if (b.testverKozott) {
    kedvezmenyek.push({ cim: "Testvérek közötti átruházás (Itv. 26. § (1) zb))", osszeg: szam });
    szam = 0;
    magyarazat.push("Testvérek közötti adásvétel illetékmentes.");
  } else {
    // Cserepótló kedvezmény
    if (b.cserepotlo && b.cserepotloKulonbozet > 0) {
      const csere = b.cserepotloKulonbozet * PCT_LAKAS;
      const kedv = Math.max(0, szam - csere);
      if (kedv > 0) {
        kedvezmenyek.push({ cim: "Cserepótló vétel (Itv. 21. § (5))", osszeg: kedv });
        szam = csere;
        magyarazat.push(
          "Cserepótló: 1 éven belüli másik lakás eladása/vétele esetén az illeték alapja a különbözet.",
        );
      }
    }
    // 35 év alatti első lakás (Itv. 26. § (6))
    if (b.elsoLakas && (b.vevoKor ?? 99) < 35 && alap <= 15_000_000) {
      const kedv = szam * 0.5;
      kedvezmenyek.push({ cim: "35 év alatti első lakásszerzés 50% (Itv. 26. § (6))", osszeg: kedv });
      szam -= kedv;
      magyarazat.push("35 év alatti első lakásszerzők 15 M Ft alatti lakásra 50% illetékkedvezményt kapnak.");
    }
    // CSOK Plusz mentesség (Itv. 26. § (1) f) — első lakás CSOK-kal, általános keret)
    if (b.csok && b.elsoLakasKedvezmenyNelkul) {
      kedvezmenyek.push({ cim: "CSOK Plusz alapú illetékmentesség (Itv. 26. § (1))", osszeg: szam });
      szam = 0;
      magyarazat.push("CSOK Plusz igénybevétele esetén az első lakás vásárlása illetékmentes lehet — feltételek ügyvédi ellenőrzése kötelező.");
    }
  }

  return {
    alap,
    szazalek: 4,
    szamitottIlletek: alap * PCT_LAKAS,
    kedvezmenyek,
    fizetendo: Math.round(Math.max(0, szam)),
    magyarazat,
  };
}

export function formatHuf(n: number) {
  return n.toLocaleString("hu-HU") + " Ft";
}
