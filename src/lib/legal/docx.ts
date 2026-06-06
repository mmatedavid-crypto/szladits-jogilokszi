// Word (.docx) export — formailag valódi ingatlan adásvételi szerződés megjelenésével.
// Két nyomtatási változatot támogat:
//   - "sima": szokványos A4, ügyvédi munkapéldány / végleges sima nyomtatott példány
//   - "biztonsagi_okmany": földforgalmi „zöld papír" sablon — szélesebb felső/alsó margó,
//     előlap a biztonsági okmány sorszámával, lapok a preprintelt papírra nyomtathatók.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
  PageNumber,
  Header,
  Footer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  LineRuleType,
  PageBreak,
} from "docx";
import type { CaseFile } from "./types";

export type ContractDocxVariant = "sima" | "biztonsagi_okmany";

const FONT = "Times New Roman";

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function bodyPara(text: string, opts: { indent?: boolean; justify?: boolean } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 24 })], // 12pt
    alignment: opts.justify === false ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
    spacing: { line: 312, lineRule: LineRuleType.AUTO, after: 120 }, // 1.3 sortáv
    indent: opts.indent ? { firstLine: 360 } : undefined,
  });
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 360 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: 32, // 16pt
      }),
    ],
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, font: FONT, size: 26 })], // 13pt
  });
}

function center(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italic,
        font: FONT,
        size: opts.size ?? 22,
        color: opts.color,
      }),
    ],
  });
}

function blank() {
  return new Paragraph({ children: [new TextRun({ text: "", font: FONT, size: 22 })] });
}

function parseBody(contract: string): Paragraph[] {
  const lines = contract.split(/\r?\n/);
  const paras: Paragraph[] = [];
  let inFront = true;
  let foundTitle = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/\s+$/, "");

    if (line.length === 0) {
      paras.push(blank());
      continue;
    }

    // Front matter banner / variant header — TERVEZET, [SIMA ...], [BIZTONSÁGI ...]
    if (inFront && (line.startsWith("TERVEZET") || line.startsWith("["))) {
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: line,
              italics: true,
              bold: line.startsWith("["),
              font: FONT,
              size: 20,
              color: line.startsWith("[BIZTONSÁGI") ? "1F6F2A" : "7A1E1E",
            }),
          ],
        }),
      );
      continue;
    }

    // Főcím
    if (!foundTitle && /^INGATLAN ADÁSVÉTELI SZERZŐDÉS/i.test(line)) {
      paras.push(h1(line));
      foundTitle = true;
      inFront = false;
      continue;
    }
    // Alcím rögtön a főcím alatt
    if (foundTitle && line.startsWith("(tervezet")) {
      paras.push(center(line, { italic: true, size: 20, color: "555555" }));
      continue;
    }

    // Számozott szakaszcím: "1. ...", "10. ..." stb., egész sor nagybetűs
    if (/^\s*\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰ][A-ZÁÉÍÓÖŐÚÜŰ0-9\s,.\-„""()\/]+$/.test(line)) {
      paras.push(h2(line.trim()));
      continue;
    }

    // ALÁÍRÁSOK / ÜGYVÉDI ELLENJEGYZÉS — ezeket NE itt rajzoljuk, kiszedjük és a végén
    // strukturált aláírási blokkal pótoljuk. Itt csak hagyjuk lefutni egyszerű szövegként,
    // hogy a renderelés ne dőljön el; a fő hívó (generateContractDocx) ezeket levágja.

    // Sima paragrafus — indent ha "  1.1." stb.
    const indented = /^\s{2,}/.test(raw);
    paras.push(bodyPara(line.replace(/^\s+/, ""), { indent: indented }));
  }
  return paras;
}

function signatureBlock(c: CaseFile, variant: ContractDocxVariant): Paragraph[] {
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");
  const place = c.property.telepules || "____________";

  const items: Paragraph[] = [];
  items.push(blank());
  items.push(
    center(`Kelt: ${place}, ${new Date().toLocaleDateString("hu-HU")}`, { italic: true }),
  );
  items.push(blank());

  // Két oszlopos aláírási táblázat: Eladó | Vevő
  const sigCell = (heading: string, names: string[]) =>
    new TableCell({
      borders: noBorder,
      width: { size: 4680, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [new TextRun({ text: heading, bold: true, font: FONT, size: 22 })],
        }),
        ...(names.length === 0 ? ["[név]"] : names).map(
          (n) =>
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 },
              children: [
                new TextRun({ text: "______________________________", font: FONT, size: 22 }),
              ],
            }),
        ),
        ...(names.length === 0 ? ["[név]"] : names).map(
          (n) =>
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: n, font: FONT, size: 22 })],
            }),
        ),
      ],
    });

  const eladoNames = eladok.map((p) =>
    p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]",
  );
  const vevoNames = vevok.map((p) =>
    p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]",
  );

  // Az sigCell duplán renderelte a neveket — egyszerűsítsük:
  const buildCell = (heading: string, names: string[]) =>
    new TableCell({
      borders: noBorder,
      width: { size: 4680, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [new TextRun({ text: heading, bold: true, font: FONT, size: 22 })],
        }),
        ...(names.length === 0 ? ["[név hiányzik]"] : names).flatMap((n) => [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({ text: "______________________________", font: FONT, size: 22 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: [new TextRun({ text: n, font: FONT, size: 20 })],
          }),
        ]),
      ],
    });

  items.push(
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "" })] }),
  );
  // Use a dummy reference to satisfy TS unused (sigCell wasn't picked up)
  void sigCell;

  const sigTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: noBorder,
    rows: [
      new TableRow({
        children: [buildCell("Eladó(k)", eladoNames), buildCell("Vevő(k)", vevoNames)],
      }),
    ],
  });
  // A Table-t úgy adjuk vissza, hogy a children listához tudjunk fűzni — a docx tipusoknál a section.children Paragraph | Table.
  // Ezért a hívó kapja vissza Paragraph[]-ot + külön Table-t.
  // Itt a tisztaság kedvéért dobjunk vissza Paragraph-okat és a Table-t paraszerinten egy „placeholder"-rel:
  (items as unknown as Array<Paragraph | Table>).push(sigTable);

  items.push(blank());
  items.push(blank());

  // Ellenjegyzés
  items.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: "ÜGYVÉDI ELLENJEGYZÉS",
          bold: true,
          font: FONT,
          size: 24,
        }),
      ],
    }),
  );
  items.push(
    center(
      "(2017. évi LXXVIII. tv. — Üttv. 43. § alapján — teljes bizonyító erejű magánokirat, tanúk nem szükségesek)",
      { italic: true, size: 18, color: "555555" },
    ),
  );

  const u = c.eljaroUgyved;
  items.push(blank());
  items.push(bodyPara(`Készítettem és ellenjegyzem: ${u.nev || "____________________________"}`));
  items.push(bodyPara(`Eljáró ügyvéd KASZ száma: ${u.kaszSzam || "________________________"}`));
  items.push(bodyPara(`Iroda: ${u.iroda || "____________________________________"}`));
  items.push(bodyPara(`Iroda címe: ${u.irodaCim || "____________________________________"}`));
  items.push(bodyPara(`Kelt: ${place}, ${new Date().toLocaleDateString("hu-HU")}`));
  items.push(blank());
  items.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: "P.H. és aláírás: ____________________________________",
          font: FONT,
          size: 22,
        }),
      ],
    }),
  );

  if (variant === "biztonsagi_okmany") {
    items.push(blank());
    items.push(
      center(
        "— Biztonsági okmányra történő nyomtatáshoz: a fenti aláírási blokk a biztonsági okmány záróoldalán szerepeljen. —",
        { italic: true, size: 18, color: "1F6F2A" },
      ),
    );
  }

  return items as unknown as Paragraph[];
}

function frontPageBiztonsagi(c: CaseFile): Paragraph[] {
  const ff = c.special.foldforgalmi;
  return [
    blank(),
    center("BIZTONSÁGI OKMÁNYRA NYOMTATANDÓ VÁLTOZAT", {
      bold: true,
      size: 28,
      color: "1F6F2A",
    }),
    center("(„zöld papír" + '"' + " — 2013. évi CXXII. tv. Földforgalmi tv. szerinti adásvételi szerződés)", {
      italic: true,
      size: 20,
      color: "555555",
    }),
    blank(),
    bodyPara(
      `Ügyazonosító: ${c.ugyAzonosito || "[ügyazonosító]"}`,
      { justify: false },
    ),
    bodyPara(
      `Biztonsági okmány sorszáma: ${ff.biztonsagiOkmanySorszam || "________________________"}`,
      { justify: false },
    ),
    bodyPara(
      `Kiállító / forgalmazó: ${ff.biztonsagiOkmanyKiallito || "________________________"}`,
      { justify: false },
    ),
    bodyPara(
      `Eljáró ügyvéd: ${c.eljaroUgyved.nev || "________________________"} (KASZ: ${c.eljaroUgyved.kaszSzam || "______"})`,
      { justify: false },
    ),
    blank(),
    bodyPara(
      "Nyomtatási útmutató: a jelen okiratot az ügyvéd a 47/2014. (II. 26.) Korm. rendelet szerinti biztonsági okmány lapjaira nyomtatja. A felső és alsó margó úgy van beállítva, hogy a biztonsági okmány előnyomott fejléce és lábléce ne kerüljön szöveggel takarásba. A sorszámot az ügyiratban dokumentálni kell; a kifüggesztést a települési önkormányzat jegyzőjénél kell kezdeményezni.",
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

export async function generateContractDocx(
  contract: string,
  ugyAzonosito: string,
  variant: ContractDocxVariant = "sima",
  c?: CaseFile,
): Promise<Blob> {
  // A contract szövegéből vágjuk le a végén lévő egyszerű aláírási / ellenjegyzés szekciót,
  // hogy a strukturált blokkot tegyük helyette.
  const cutMarkers = ["ALÁÍRÁSOK", "ÜGYVÉDI ELLENJEGYZÉS"];
  let cut = contract.length;
  for (const m of cutMarkers) {
    const idx = contract.indexOf("\n" + m);
    if (idx >= 0 && idx < cut) cut = idx;
  }
  const bodyText = contract.slice(0, cut).trimEnd();

  const bodyParas = parseBody(bodyText);
  const sigParas: Paragraph[] = c ? signatureBlock(c, variant) : [];
  const front: Paragraph[] =
    variant === "biztonsagi_okmany" && c ? frontPageBiztonsagi(c) : [];

  // Margók — biztonsági okmányhoz nagyobb felső/alsó, hogy a preprintelt sáv kimaradjon.
  const margin =
    variant === "biztonsagi_okmany"
      ? { top: 2880, right: 1440, bottom: 2880, left: 1440 } // 2" felső/alsó
      : { top: 1440, right: 1440, bottom: 1440, left: 1440 };

  const headerText =
    variant === "biztonsagi_okmany"
      ? `BIZTONSÁGI OKMÁNY — Ügyirat: ${ugyAzonosito || "(nincs)"}    |    Sorszám: ${c?.special.foldforgalmi.biztonsagiOkmanySorszam || "__________"}`
      : `Ingatlan adásvételi szerződés — Ügyirat: ${ugyAzonosito || "(nincs)"}`;

  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: headerText,
            italics: true,
            font: FONT,
            size: 18,
            color: variant === "biztonsagi_okmany" ? "1F6F2A" : "666666",
          }),
        ],
      }),
    ],
  });

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "— ", font: FONT, size: 18, color: "666666" }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "666666" }),
          new TextRun({ text: " / ", font: FONT, size: 18, color: "666666" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "666666" }),
          new TextRun({ text: " oldal —", font: FONT, size: 18, color: "666666" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Tervezet — ügyvédi ellenőrzésre vár",
            italics: true,
            font: FONT,
            size: 16,
            color: "888888",
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "Szladits Magánjogi Asszisztens",
    title: ugyAzonosito || "Szerződéstervezet",
    description: "Ügyvédi okiratszerkesztési tervezet — adásvételi szerződés",
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.PORTRAIT,
            },
            margin,
          },
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: [...front, ...bodyParas, ...sigParas],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
