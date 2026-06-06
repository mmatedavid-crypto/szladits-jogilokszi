// Word (.docx) export a szerződéstervezet alapján — az ügyvéd Wordben tovább szerkesztheti.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
} from "docx";

function paragraphsFromText(text: string): Paragraph[] {
  const lines = text.split(/\r?\n/);
  const paras: Paragraph[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.length === 0) {
      paras.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    // Főcím: első nem üres SZERZŐDÉS-szerű cím (csupa nagybetűs sor)
    const isHeading1 = /^[A-ZÁÉÍÓÖŐÚÜŰ0-9\s,.\-„""()]+$/.test(line) && line.length < 80 && /[A-ZÁÉÍÓÖŐÚÜŰ]/.test(line) && paras.length < 3;
    // Szakasz cím: "1.", "2.1." stb. + nagybetűvel kezdődő
    const isHeading2 = /^\s*\d+\.\s+[A-ZÁÉÍÓÖŐÚÜŰ]/.test(line);
    if (isHeading1) {
      paras.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line, bold: true, size: 28 })],
        }),
      );
    } else if (isHeading2) {
      paras.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line, bold: true, size: 24 })],
        }),
      );
    } else {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 80 },
        }),
      );
    }
  }
  return paras;
}

export async function generateContractDocx(contract: string, ugyAzonosito: string): Promise<Blob> {
  const header = `Ügyirat: ${ugyAzonosito || "(nincs azonosító)"}    |    Generálva: ${new Date().toLocaleString("hu-HU")}`;
  const intro = new Paragraph({
    children: [new TextRun({ text: header, italics: true, size: 18, color: "666666" })],
    spacing: { after: 240 },
  });
  const disclaimer = new Paragraph({
    children: [
      new TextRun({
        text:
          "FIGYELEM: Ez egy ügyvédi előkészítést támogató okiratszerkesztési tervezet. Aláírás előtt ügyvédi felülvizsgálat és véglegesítés kötelező.",
        italics: true,
        size: 18,
        color: "990000",
      }),
    ],
    spacing: { after: 240 },
  });

  const doc = new Document({
    creator: "Szladits Magánjogi Asszisztens",
    title: ugyAzonosito || "Szerződéstervezet",
    description: "Ügyvédi okiratszerkesztési tervezet",
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 22 } },
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
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [intro, disclaimer, ...paragraphsFromText(contract)],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
