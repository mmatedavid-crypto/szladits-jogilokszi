// Kontrollált PDF export ügyvédi szerződéshez.
//
// Cél: a generált PDF úgy nézzen ki, mint egy ügyvédi irodában készült okirat.
// SOHA nem használunk window.print()-et, hogy a böngésző fejléc/lábléc
// (URL, preview-..., .app, időbélyeg) NE jelenjen meg a kimeneten.
//
// Renderer: jsPDF + beágyazott Noto Serif font (magyar ékezetek támogatása).
//
// Konfigurálható ügyvédi (law-firm) letterhead támogatása: a CaseFile.eljaroUgyved
// alapján kerül a fejléc kirakásra. Ha nincs konfigurálva ügyvédi adat,
// neutrális ügyvédi okirat-fejlécet kap, Szladits-brand NÉLKÜL.

import jsPDF from "jspdf";
import type { CaseFile } from "./types";
import notoSerifRegularUrl from "@expo-google-fonts/noto-serif/400Regular/NotoSerif_400Regular.ttf?url";
import notoSerifBoldUrl from "@expo-google-fonts/noto-serif/700Bold/NotoSerif_700Bold.ttf?url";

let _fontCache: { regular: string; bold: string } | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font letöltés sikertelen: ${url}`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(bin);
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (_fontCache) return _fontCache;
  const [regular, bold] = await Promise.all([
    fetchAsBase64(notoSerifRegularUrl),
    fetchAsBase64(notoSerifBoldUrl),
  ]);
  _fontCache = { regular, bold };
  return _fontCache;
}

function registerFonts(doc: jsPDF, fonts: { regular: string; bold: string }) {
  doc.addFileToVFS("NotoSerif-Regular.ttf", fonts.regular);
  doc.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
  doc.addFileToVFS("NotoSerif-Bold.ttf", fonts.bold);
  doc.addFont("NotoSerif-Bold.ttf", "NotoSerif", "bold");
  doc.setFont("NotoSerif", "normal");
}

// ── layout konstansok (mm) ─────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 22;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 22;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

interface RenderCtx {
  doc: jsPDF;
  y: number;
  page: number;
  c: CaseFile;
}

function newPage(ctx: RenderCtx) {
  ctx.doc.addPage();
  ctx.page += 1;
  ctx.y = MARGIN_TOP;
}

function ensureSpace(ctx: RenderCtx, h: number) {
  if (ctx.y + h > PAGE_H - MARGIN_BOTTOM) newPage(ctx);
}

function setBody(doc: jsPDF) {
  doc.setFont("NotoSerif", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
}
function setBold(doc: jsPDF, size = 11) {
  doc.setFont("NotoSerif", "bold");
  doc.setFontSize(size);
  doc.setTextColor(20, 20, 20);
}

function drawText(
  ctx: RenderCtx,
  text: string,
  opts: { bold?: boolean; size?: number; align?: "left" | "center"; lineGap?: number; color?: [number, number, number] } = {},
) {
  const doc = ctx.doc;
  if (opts.bold) setBold(doc, opts.size ?? 11);
  else {
    setBody(doc);
    if (opts.size) doc.setFontSize(opts.size);
  }
  if (opts.color) doc.setTextColor(...opts.color);
  const size = opts.size ?? 11;
  const lineHeight = (size * 1.35) / 2.83; // pt→mm ~ size/2.83
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
  for (const line of lines) {
    ensureSpace(ctx, lineHeight + (opts.lineGap ?? 0));
    if (opts.align === "center") {
      doc.text(line, PAGE_W / 2, ctx.y, { align: "center", baseline: "top" });
    } else {
      doc.text(line, MARGIN_X, ctx.y, { baseline: "top" });
    }
    ctx.y += lineHeight + (opts.lineGap ?? 0);
  }
  setBody(doc);
  doc.setTextColor(20, 20, 20);
}

function vspace(ctx: RenderCtx, mm: number) {
  ensureSpace(ctx, mm);
  ctx.y += mm;
}

function hrule(ctx: RenderCtx, color: [number, number, number] = [120, 120, 120]) {
  ensureSpace(ctx, 4);
  const d = ctx.doc;
  d.setDrawColor(...color);
  d.setLineWidth(0.2);
  d.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 3;
}

// ── letterhead ─────────────────────────────────────────────────────────────
function drawLetterhead(ctx: RenderCtx) {
  const u = ctx.c.eljaroUgyved;
  const hasFirm = !!(u.iroda || u.nev);
  if (hasFirm) {
    drawText(ctx, u.iroda || u.nev, { bold: true, size: 13, align: "center" });
    if (u.rovidHeader) drawText(ctx, u.rovidHeader, { size: 10, align: "center" });
    const idLine = [u.nev, u.kaszSzam ? `KASZ: ${u.kaszSzam}` : ""].filter(Boolean).join("  •  ");
    if (idLine) drawText(ctx, idLine, { size: 10, align: "center" });
    const contact = [u.irodaCim, u.telefon, u.email, u.website].filter(Boolean).join("  •  ");
    if (contact) drawText(ctx, contact, { size: 9, align: "center", color: [90, 90, 90] });
  } else {
    drawText(ctx, "ÜGYVÉDI OKIRAT", { bold: true, size: 12, align: "center", color: [90, 90, 90] });
  }
  vspace(ctx, 1);
  hrule(ctx);
  vspace(ctx, 2);
}

// ── footer (oldalszám, NINCS URL/timestamp) ────────────────────────────────
function drawFooters(doc: jsPDF, c: CaseFile) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("NotoSerif", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    const left = c.ugyAzonosito ? `Ügyazonosító: ${c.ugyAzonosito}` : "";
    if (left) doc.text(left, MARGIN_X, PAGE_H - 10, { baseline: "top" });
    doc.text(`${i} / ${total}. oldal`, PAGE_W / 2, PAGE_H - 10, {
      align: "center",
      baseline: "top",
    });
    doc.setTextColor(20, 20, 20);
  }
}

// ── tartalom renderelés (a contract szövegéből) ────────────────────────────
function isMainTitle(line: string) {
  return /^INGATLAN ADÁSVÉTELI SZERZŐDÉS/i.test(line);
}
function isSubtitle(line: string) {
  return /^\(tervezet/i.test(line);
}
function isSectionTitle(line: string) {
  return /^\s*\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰ][A-ZÁÉÍÓÖŐÚÜŰ0-9\s,.\-„""()/]+$/.test(line);
}
function isMarker(line: string) {
  return /^\[(TERVEZET|SIMA|BIZTONSÁGI|HIÁNYZÓ|ÜGYVÉDI)/i.test(line.trim()) || line.startsWith("TERVEZET");
}

function renderContractBody(ctx: RenderCtx, contract: string) {
  // Levágjuk a "ALÁÍRÁSOK" / "ÜGYVÉDI ELLENJEGYZÉS" után jövő egyszerű szöveget,
  // mert struktúrált aláírási blokkot teszünk a helyére.
  const cutMarkers = ["ALÁÍRÁSOK", "ÜGYVÉDI ELLENJEGYZÉS"];
  let cut = contract.length;
  for (const m of cutMarkers) {
    const idx = contract.indexOf("\n" + m);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  const body = contract.slice(0, cut).trimEnd();
  const lines = body.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.length === 0) {
      vspace(ctx, 2);
      continue;
    }
    if (isMainTitle(line)) {
      vspace(ctx, 4);
      drawText(ctx, line.toUpperCase(), { bold: true, size: 15, align: "center" });
      vspace(ctx, 1);
      continue;
    }
    if (isSubtitle(line)) {
      drawText(ctx, line, { size: 10, align: "center", color: [110, 110, 110] });
      vspace(ctx, 2);
      continue;
    }
    if (isMarker(line)) {
      drawText(ctx, line, { size: 9, align: "center", color: [140, 40, 40] });
      continue;
    }
    if (isSectionTitle(line)) {
      vspace(ctx, 3);
      drawText(ctx, line.trim(), { bold: true, size: 12 });
      vspace(ctx, 1);
      continue;
    }
    // sub-paragraph: behúzás, ha "  X.Y." stb.
    const indented = /^\s{2,}/.test(raw);
    if (indented) {
      const txt = raw.replace(/^\s+/, "");
      drawText(ctx, "    " + txt, { size: 11 });
    } else {
      drawText(ctx, line, { size: 11 });
    }
  }
}

// ── aláírási blokk ─────────────────────────────────────────────────────────
function partyLabel(p: { kind: "termeszetes"; nev: string } | { kind: "ceg"; cegnev: string; kepviseloNeve?: string } | unknown): string {
  const x = p as { kind: string; nev?: string; cegnev?: string; kepviseloNeve?: string };
  if (x.kind === "termeszetes") return x.nev || "[név]";
  return `${x.cegnev || "[cégnév]"}\nképv.: ${x.kepviseloNeve || "[képviselő]"}`;
}

function drawSignatureGrid(
  ctx: RenderCtx,
  title: string,
  labels: string[],
) {
  drawText(ctx, title, { bold: true, size: 11 });
  vspace(ctx, 12);
  const colW = (CONTENT_W - 10) / 2;
  const doc = ctx.doc;
  const items = labels.length === 0 ? ["[név hiányzik]"] : labels;
  for (let i = 0; i < items.length; i += 2) {
    ensureSpace(ctx, 22);
    const y0 = ctx.y;
    for (let k = 0; k < 2; k++) {
      const idx = i + k;
      if (idx >= items.length) continue;
      const x0 = MARGIN_X + k * (colW + 10);
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(0.3);
      doc.line(x0, y0, x0 + colW, y0);
      doc.setFont("NotoSerif", "normal");
      doc.setFontSize(10);
      const lines = items[idx].split("\n");
      let yy = y0 + 2;
      for (const ln of lines) {
        doc.text(ln, x0 + colW / 2, yy, { align: "center", baseline: "top" });
        yy += 4.5;
      }
    }
    ctx.y = y0 + 20;
  }
}

function formatHuDate(value?: string): string {
  if (!value) return "____________________";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("hu-HU", { timeZone: "Europe/Budapest" });
}

function drawSignatures(ctx: RenderCtx) {
  const c = ctx.c;
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");

  vspace(ctx, 6);
  // Szerződéskötés (aláírás) napja — NEM a birtokbaadás dátuma.
  const signingDate = c.letrehozva;
  drawText(
    ctx,
    `Kelt: ${c.property.telepules || "____________"}, ${formatHuDate(signingDate)}`,
    { size: 11, align: "center" },
  );
  vspace(ctx, 6);
  drawSignatureGrid(
    ctx,
    "Eladó(k):",
    eladok.map((p) => partyLabel(p as never)),
  );
  vspace(ctx, 4);
  drawSignatureGrid(
    ctx,
    "Vevő(k):",
    vevok.map((p) => partyLabel(p as never)),
  );

  // Ügyvédi ellenjegyzés — keep-together: ne törjön szét csúnyán két oldal közt.
  // ~70 mm szükséges (cím + alcím + adatok + aláírás vonal + P.H.).
  const REQUIRED_MM = 70;
  if (ctx.y + REQUIRED_MM > PAGE_H - MARGIN_BOTTOM) {
    newPage(ctx);
  } else {
    vspace(ctx, 8);
  }
  hrule(ctx, [60, 60, 60]);
  vspace(ctx, 3);
  drawText(ctx, "ÜGYVÉDI ELLENJEGYZÉS", { bold: true, size: 12, align: "center" });
  drawText(
    ctx,
    "(2017. évi LXXVIII. tv. — Üttv. 43. § alapján — teljes bizonyító erejű magánokirat, tanúk nem szükségesek)",
    { size: 9, align: "center", color: [110, 110, 110] },
  );
  vspace(ctx, 6);
  const u = c.eljaroUgyved;
  drawText(ctx, `Készítettem és ellenjegyzem: ${u.nev || "____________________________"}`);
  drawText(ctx, `KASZ szám: ${u.kaszSzam || "________________________"}`);
  if (u.iroda) drawText(ctx, `Iroda: ${u.iroda}`);
  if (u.irodaCim) drawText(ctx, `Iroda címe: ${u.irodaCim}`);
  const kontakt = [u.telefon, u.email, u.website].filter(Boolean).join("  •  ");
  if (kontakt) drawText(ctx, kontakt, { size: 10, color: [90, 90, 90] });
  vspace(ctx, 14);
  const doc = ctx.doc;
  ensureSpace(ctx, 28);
  const y0 = ctx.y;
  // aláírás vonal + P.H.
  doc.setDrawColor(60, 60, 60);
  doc.line(MARGIN_X, y0, MARGIN_X + 80, y0);
  doc.setFont("NotoSerif", "normal");
  doc.setFontSize(10);
  doc.text("ügyvéd aláírása", MARGIN_X + 40, y0 + 2, { align: "center", baseline: "top" });
  doc.setFontSize(11);
  doc.text("P.H.", PAGE_W - MARGIN_X - 25, y0 - 4, { baseline: "top" });
  doc.setDrawColor(150, 150, 150);
  // szaggatott körvonal P.H. helynek
  (doc as unknown as { setLineDashPattern?: (p: number[], o: number) => void }).setLineDashPattern?.([1.5, 1.5], 0);
  doc.circle(PAGE_W - MARGIN_X - 20, y0 + 4, 12, "S");
  (doc as unknown as { setLineDashPattern?: (p: number[], o: number) => void }).setLineDashPattern?.([], 0);
  ctx.y = y0 + 26;
}

// ── főhívás ────────────────────────────────────────────────────────────────
export async function generateContractPdf(
  c: CaseFile,
  contract: string,
): Promise<Blob> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  registerFonts(doc, fonts);
  const ctx: RenderCtx = { doc, y: MARGIN_TOP, page: 1, c };

  drawLetterhead(ctx);
  renderContractBody(ctx, contract);
  drawSignatures(ctx);
  drawFooters(doc, c);

  return doc.output("blob");
}
