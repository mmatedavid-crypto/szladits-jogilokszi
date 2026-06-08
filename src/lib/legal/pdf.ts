// jsPDF alapú előkitöltött dokumentumok: B400E/ONYA előkészítő és Pmt. átvilágítási adatlap.
// FIGYELEM: ezek NEM hivatalos NAV-nyomtatványok és nem elektronikus beadványok, hanem az ügyvédi
// előkészítést támogató adatösszefoglalók. A valódi beadás ONYA felületen,
// KAÜ/Ügyfélkapu/DÁP azonosítást igényel.

import jsPDF from "jspdf";
import type { CaseFile } from "./types";
import { szamolIlletek, bemenetCasebol, formatHuf } from "./illetek";
import { B400E_BEKULDO_LABELS, B400E_STATUSZ_LABELS } from "./modulok";

function header(doc: jsPDF, title: string, sub: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sub, 20, 26);
  doc.setLineWidth(0.3);
  doc.line(20, 29, 190, 29);
}

function footer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    // Professzionális oldalszám — projekt/preview hivatkozás, időbélyeg és külső URL nélkül.
    doc.text(`${i} / ${pageCount}. oldal`, 105, 287, { align: "center" });
    doc.setTextColor(0);
  }
}

// Magyar ékezetek nélküli, biztonságos szövegmegjelenítés (jsPDF default font helvetica latin-1)
function ascii(s: string): string {
  if (!s) return "";
  return s
    .replace(/[őŐ]/g, (c) => (c === "ő" ? "o" : "O"))
    .replace(/[űŰ]/g, (c) => (c === "ű" ? "u" : "U"))
    .replace(/[áÁéÉíÍóÓöÖúÚüÜ]/g, (c) => {
      const map: Record<string, string> = {
        á: "a", Á: "A", é: "e", É: "E", í: "i", Í: "I",
        ó: "o", Ó: "O", ö: "o", Ö: "O",
        ú: "u", Ú: "U", ü: "u", Ü: "U",
      };
      return map[c] ?? c;
    });
}

function row(doc: jsPDF, y: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(ascii(label) + ":", 20, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const v = ascii(value || "-");
  const wrapped = doc.splitTextToSize(v, 110);
  doc.text(wrapped, 80, y);
  return y + Math.max(6, wrapped.length * 5);
}

function section(doc: jsPDF, y: number, title: string) {
  doc.setFillColor(230, 230, 240);
  doc.rect(20, y - 4, 170, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(ascii(title), 22, y);
  return y + 8;
}

export function generateB400Pdf(c: CaseFile): Blob {
  const doc = new jsPDF();
  header(
    doc,
    "B400E / ONYA - elokeszito adatlap (NEM hivatalos beadvany)",
    "NAV vagyonszerzesi illetekbejelentes elokeszitese - ONYA / B400E - 1990. evi XCIII. tv. (Itv.)",
  );
  let y = 38;
  y = section(doc, y, "Ugyirat azonosito");
  y = row(doc, y, "Ugyazonosito", c.ugyAzonosito);
  y = row(doc, y, "Generalas datuma", new Date().toLocaleDateString("hu-HU"));
  y = row(doc, y, "B400E statusz", B400E_STATUSZ_LABELS[c.modulok.b400.statusz]);
  y = row(doc, y, "ONYA bekuldo", B400E_BEKULDO_LABELS[c.modulok.b400.bekuldo]);
  y = row(
    doc,
    y,
    "Meghatalmazas",
    c.modulok.b400.meghatalmazasRendelkezesreAll
      ? "Rendelkezesre all"
      : "Nincs rogzitve / ugyvedi ellenorzes szukseges",
  );
  y = row(doc, y, "Bekuldes datuma", c.modulok.b400.bekuldesDatuma);
  y = row(doc, y, "NAV nyugtaazonosito", c.modulok.b400.navNyugtaAzonosito);

  y = section(doc, y + 2, "Szerzo (vevo) adatai");
  const vevo = c.parties.find((p) => p.szerep === "vevo");
  if (vevo) {
    if (vevo.kind === "termeszetes") {
      y = row(doc, y, "Nev", vevo.nev);
      y = row(doc, y, "Szuletesi nev", vevo.szuletesiNev);
      y = row(doc, y, "Anyja neve", vevo.anyjaNeve);
      y = row(doc, y, "Szul. hely, ido", `${vevo.szuletesiHely}, ${vevo.szuletesiDatum}`);
      y = row(doc, y, "Lakcim", vevo.lakcim);
      y = row(doc, y, "Adoazonosito jel", vevo.adoazonosito);
      y = row(doc, y, "Allampolgarsag", vevo.allampolgarsag);
    } else {
      y = row(doc, y, "Cegnev", vevo.cegnev);
      y = row(doc, y, "Cegjegyzekszam", vevo.cegjegyzekszam);
      y = row(doc, y, "Adoszam", vevo.adoszam);
      y = row(doc, y, "Szekhely", vevo.szekhely);
    }
  } else {
    y = row(doc, y, "Vevo", "[nincs rogzitve]");
  }

  y = section(doc, y + 2, "Ingatlan adatai");
  y = row(doc, y, "Cim", `${c.property.iranyitoszam} ${c.property.telepules}, ${c.property.cim}`);
  y = row(doc, y, "Helyrajzi szam", c.property.helyrajziSzam);
  y = row(doc, y, "Megnevezes", c.property.ingatlanTipus);
  y = row(doc, y, "Alapterulet (m2)", c.property.alapterulet);
  y = row(doc, y, "Szerzett hanyad", c.modulok.b400.szerzettHanyad);

  y = section(doc, y + 2, "Szerzodes es ellenertek");
  y = row(doc, y, "Szerzodes datuma", c.modulok.b400.szerzodesDatuma || c.possession.datum);
  y = row(doc, y, "Vetelar (HUF)", c.payment.teljesVetelar);
  y = row(doc, y, "Forgalmi ertek (HUF)", c.modulok.b400.forgalmiErtek);

  const ill = szamolIlletek(bemenetCasebol(c));
  y = section(doc, y + 2, "Illetekszamitas (elozetes)");
  y = row(doc, y, "Illetek alap", formatHuf(ill.alap));
  y = row(doc, y, "Szamitott illetek", formatHuf(ill.szamitottIlletek));
  ill.kedvezmenyek.forEach((k) => {
    y = row(doc, y, "Kedvezmeny", `${k.cim}: -${formatHuf(k.osszeg)}`);
  });
  y = row(doc, y, "Fizetendo illetek", formatHuf(ill.fizetendo));
  y = row(doc, y, "Kedvezmeny kod", c.modulok.b400.illetekkedvezmenyKod);
  if (c.modulok.b400.megjegyzes) {
    y = row(doc, y, "Megjegyzes", c.modulok.b400.megjegyzes);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 0, 0);
  doc.text(
    ascii(
      "FIGYELEM: ez NEM a NAV B400E adatlap hivatalos peldanya es nem elektronikus bekuldes. A B400E adatlapot az ONYA feluleten kell kitolteni es KAÜ/Ugyfelkapu/DAP azonositassal bekuldeni.",
    ),
    20,
    275,
    { maxWidth: 170 },
  );
  doc.setTextColor(0);
  footer(doc);
  return doc.output("blob");
}

export function generatePmtPdf(c: CaseFile): Blob {
  const doc = new jsPDF();
  header(
    doc,
    "Pmt. ugyfel-atvilagitasi adatlap",
    "2017. evi LIII. tv. (Pmt.) szerinti elokeszito - ugyvedi rogzites kotelezo",
  );
  let y = 38;
  const p = c.modulok.pmt;
  y = section(doc, y, "Ugyirat");
  y = row(doc, y, "Ugyazonosito", c.ugyAzonosito);
  y = row(doc, y, "Datum", new Date().toLocaleDateString("hu-HU"));
  y = row(doc, y, "Ugyfel tipus", p.ugyfelTipus);
  y = row(doc, y, "Azonositas modja", p.azonositasModja);

  y = section(doc, y + 2, "Atvilagitando felek (az ugyiratbol)");
  c.parties.forEach((q) => {
    const nev = q.kind === "termeszetes" ? q.nev : q.cegnev;
    const azon =
      q.kind === "termeszetes"
        ? `${q.okmanyAzonosito} / ${q.adoazonosito}`
        : `${q.cegjegyzekszam} / ${q.adoszam}`;
    y = row(doc, y, `${q.szerep === "elado" ? "Elado" : "Vevo"} (${q.kind})`, `${nev} - ${azon}`);
  });

  y = section(doc, y + 2, "Tenyleges tulajdonos");
  y = row(doc, y, "Nev", p.tenylegesTulajdonosNeve);
  y = row(doc, y, "Lakcim", p.tenylegesTulajdonosCim);
  y = row(doc, y, "Szul. hely, ido", `${p.tenylegesTulajdonosSzulHely}, ${p.tenylegesTulajdonosSzulIdo}`);
  y = row(doc, y, "Tulajdoni reszesedes", p.tulajdoniReszesedes);

  y = section(doc, y + 2, "Kiemelt kozszereploi (PEP) nyilatkozat");
  y = row(doc, y, "PEP?", p.pep ? "IGEN" : "Nem");
  if (p.pep) y = row(doc, y, "Reszlet", p.pepReszlet);

  y = section(doc, y + 2, "Kockazati besorolas");
  y = row(doc, y, "Besorolas", p.kockazatiBesorolas);
  y = row(doc, y, "Indoklas", p.kockazatiIndok);

  y = section(doc, y + 2, "Vagyon eredete");
  y = row(doc, y, "Igazolt", p.forrasIgazolt ? "IGEN" : "Nem");
  y = row(doc, y, "Megjegyzes", p.forrasMegjegyzes);

  y = section(doc, y + 4, "Ugyvedi nyilatkozat");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const txt = ascii(
    "Alulirott ugyvedi kijelentem, hogy az ugyfelet a Pmt. 7-9. §§-ai szerint atvilagitottam, a tenyleges tulajdonosi nyilatkozatot beszereztem, es a kockazati besorolasrol a Pmt. szerint dontottem. A JUB lekerdezest kulon vegzem.",
  );
  const w = doc.splitTextToSize(txt, 170);
  doc.text(w, 20, y);
  y += w.length * 5 + 10;
  doc.text("Ugyved alairasa: ____________________________   Datum: ____________", 20, y);
  footer(doc);
  return doc.output("blob");
}

export function generateIlletekPdf(c: CaseFile): Blob {
  const doc = new jsPDF();
  header(
    doc,
    "Illetekszamitas - elozetes",
    "1990. evi XCIII. tv. (Itv.) alapjan - ugyvedi visszaigazolas szukseges",
  );
  let y = 38;
  const ill = szamolIlletek(bemenetCasebol(c));
  y = row(doc, y, "Ugyazonosito", c.ugyAzonosito);
  y = row(doc, y, "Datum", new Date().toLocaleDateString("hu-HU"));
  y = row(doc, y, "Illetek alap", formatHuf(ill.alap));
  y = row(doc, y, "Szamitott illetek (4%)", formatHuf(ill.szamitottIlletek));
  ill.kedvezmenyek.forEach((k) => {
    y = row(doc, y, "Kedvezmeny", `${k.cim}: -${formatHuf(k.osszeg)}`);
  });
  y = row(doc, y, "Fizetendo illetek", formatHuf(ill.fizetendo));
  y = section(doc, y + 4, "Magyarazat");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  ill.magyarazat.forEach((m) => {
    const w = doc.splitTextToSize("- " + ascii(m), 170);
    doc.text(w, 20, y);
    y += w.length * 5 + 1;
  });
  footer(doc);
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
