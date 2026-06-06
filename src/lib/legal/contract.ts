import type { CaseFile, NaturalPerson, Party } from "./types";
import { DRAFT_BANNER, TRANSACTION_TYPE_LABELS } from "./types";
import {
  calculateAge,
  determineCapacityStatus,
  CAPACITY_LABEL,
  isMinor,
  generateAttachmentList,
} from "./logic";

function fmt(n: string, ccy: string) {
  if (!n) return "[…]";
  const num = Number(n);
  if (Number.isNaN(num)) return `${n} ${ccy}`;
  return `${num.toLocaleString("hu-HU")} ${ccy}`;
}

function describeParty(p: Party): string {
  if (p.kind === "termeszetes") {
    const age = calculateAge(p.szuletesiDatum);
    const cap = CAPACITY_LABEL[determineCapacityStatus(p)];
    return [
      `${p.nev || "[név]"} (sz.: ${p.szuletesiNev || "[születési név]"}; an.: ${p.anyjaNeve || "[anyja neve]"};`,
      `szül.: ${p.szuletesiHely || "[hely]"}, ${p.szuletesiDatum || "[dátum]"}${age !== null ? `; ${age} év` : ""};`,
      `lakcím: ${p.lakcim || "[lakcím]"}; adóazonosító: ${p.adoazonosito || "[adóazonosító]"};`,
      `állampolgárság: ${p.allampolgarsag || "[állampolgárság]"}; státusz: ${cap})`,
    ].join(" ");
  }
  return [
    `${p.cegnev || "[cégnév]"} (cégjegyzékszám: ${p.cegjegyzekszam || "[cgj]"};`,
    `adószám: ${p.adoszam || "[adószám]"}; székhely: ${p.szekhely || "[székhely]"};`,
    `képviseli: ${p.kepviseloNeve || "[képviselő]"}, képviselet módja: ${p.kepviseletModja || "[mód]"})`,
  ].join(" ");
}

export function generateContractDraft(c: CaseFile): string {
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");

  const sections: string[] = [];

  sections.push(DRAFT_BANNER);
  sections.push("");
  sections.push("INGATLAN ADÁSVÉTELI SZERZŐDÉS — TERVEZET");
  sections.push("(ügyvédi ellenőrzésre előkészített tervezet)");
  sections.push("");
  sections.push(
    `Ügyazonosító: ${c.ugyAzonosito || "[ügyazonosító]"}    Készítés dátuma: ${new Date().toLocaleDateString("hu-HU")}`,
  );
  sections.push("");
  sections.push(
    `Ügylet típusa: ${c.transactionTypes.map((t) => TRANSACTION_TYPE_LABELS[t]).join(", ") || "[típus]"}`,
  );
  sections.push("");

  // 1. Felek
  sections.push("1. A SZERZŐDŐ FELEK");
  sections.push("");
  sections.push("Eladó(k):");
  eladok.forEach((p, i) => sections.push(`  ${i + 1}. ${describeParty(p)}`));
  if (eladok.length === 0) sections.push("  [eladó adatai hiányoznak]");
  sections.push("");
  sections.push("Vevő(k):");
  vevok.forEach((p, i) => sections.push(`  ${i + 1}. ${describeParty(p)}`));
  if (vevok.length === 0) sections.push("  [vevő adatai hiányoznak]");
  sections.push("");

  // Képviselők
  const minors = c.parties.filter(
    (p): p is NaturalPerson => p.kind === "termeszetes" && isMinor(p),
  );
  if (minors.length > 0) {
    sections.push("1.1. Törvényes képviselet");
    minors.forEach((m) => {
      sections.push(
        `  A(z) ${m.nev || "[név]"} nevű kiskorú fél nevében törvényes képviselője, ${m.kepviselo?.nev || "[képviselő neve]"} (${m.kepviselo?.minoseg || "minőség"}) jár el. A kiskorú érintettsége miatt gyámhatósági jóváhagyás szükségessége ügyvédi ellenőrzést igényel.`,
      );
    });
    sections.push("");
  }

  // 2. Az ingatlan
  sections.push("2. AZ INGATLAN");
  sections.push("");
  sections.push(
    `  Cím: ${c.property.iranyitoszam || "[ir.sz.]"} ${c.property.telepules || "[település]"}, ${c.property.cim || "[cím]"}`,
  );
  sections.push(`  Helyrajzi szám: ${c.property.helyrajziSzam || "[hrsz.]"}`);
  sections.push(`  Megnevezés: ${c.property.ingatlanTipus || "[típus]"}`);
  if (c.property.muvelesiAg)
    sections.push(`  Művelési ág: ${c.property.muvelesiAg}`);
  sections.push(`  Alapterület: ${c.property.alapterulet || "[m²]"} m²`);
  sections.push(`  Eladói tulajdoni hányad: ${c.property.tulajdoniHanyad || "1/1"}`);
  if (c.property.tarsashaziAlbetet)
    sections.push("  Társasházi albetét.");
  if (c.property.teremgarazsTarolo)
    sections.push("  Teremgarázs-/tárolóhasználat kapcsolódik.");
  if (c.property.energetikaiTanusitvany)
    sections.push(`  Energetikai tanúsítvány száma: ${c.property.energetikaiTanusitvany}`);
  sections.push("");

  // 3. Tulajdoni és teherviszonyok
  sections.push("3. TULAJDONI ÉS TEHERVISZONYOK");
  sections.push("");
  const e = c.property.encumbrances;
  const enc: string[] = [];
  if (e.jelzalog) enc.push("jelzálogjog");
  if (e.vegrehajtas) enc.push("végrehajtási jog");
  if (e.haszonelvezet) enc.push("haszonélvezeti jog");
  if (e.elidegenitesiTilalom) enc.push("elidegenítési és terhelési tilalom");
  if (e.elovasarlasiJog) enc.push("elővásárlási jog");
  if (e.szolgalmiJog) enc.push("szolgalmi jog");
  if (e.egyeb.trim()) enc.push(`egyéb: ${e.egyeb.trim()}`);
  if (enc.length === 0) {
    sections.push(
      "  Az eladó kijelenti, hogy az ingatlan per-, teher- és igénymentes. (Az állítás a tulajdoni lap alapján ügyvédileg ellenőrzendő.)",
    );
  } else {
    sections.push(`  Az ingatlanon a következő terhek/jogok állnak fenn: ${enc.join("; ")}.`);
    if (c.property.tehermentesitesiTerv)
      sections.push(`  Tehermentesítési terv: ${c.property.tehermentesitesiTerv}`);
    else
      sections.push("  Tehermentesítési terv: [ügyvédi kidolgozás szükséges]");
  }
  sections.push("");

  // 4. Vételár és fizetés
  sections.push("4. VÉTELÁR ÉS FIZETÉSI FELTÉTELEK");
  sections.push("");
  sections.push(
    `  4.1. A teljes vételár: ${fmt(c.payment.teljesVetelar, c.payment.penznem)}.`,
  );
  if (c.payment.foglaloVan)
    sections.push(
      `  4.2. Foglaló: ${fmt(c.payment.foglaloOsszeg, c.payment.penznem)} (a Ptk. szerinti foglaló szabályai szerint).`,
    );
  if (c.payment.elolegVan)
    sections.push(`  4.3. Előleg fizetése történik a vételár terhére.`);
  if (c.payment.onero)
    sections.push(`  4.4. Önerő: ${fmt(c.payment.onero, c.payment.penznem)}.`);
  if (c.payment.bankhitelVan) {
    sections.push(
      `  4.5. Banki hitel: ${c.payment.bankNeve || "[bank]"}, összege ${fmt(c.payment.hitelOsszeg, c.payment.penznem)}, folyósítás várható határideje: ${c.payment.hitelFolyositasHatarido || "[határidő]"}.`,
    );
    sections.push(
      "  4.6. A bejegyzési engedély letétben kezelendő; a tulajdonjog bejegyzése függőben tartással biztosítható a banki folyósításig. A banki jelzálog és elidegenítési tilalom bejegyzésének kezelése a banki feltételek szerint történik. (Ügyvédi ellenőrzés szükséges.)",
    );
  }
  if (c.payment.ugyvediLetet)
    sections.push(
      "  4.7. A vételár meghatározott része ügyvédi letétbe kerül; a letét feltételeit külön letéti szerződés rögzíti.",
    );
  if (c.payment.reszletfizetes && c.payment.fizetesiUtemezes)
    sections.push(`  4.8. Részletfizetési ütemezés: ${c.payment.fizetesiUtemezes}`);
  if (c.payment.meglevoTeherKivaltas)
    sections.push(
      `  4.9. A meglévő terhek kiváltása: ${c.payment.tehermentesitesModja || "[ügyvédi kidolgozás]"}.`,
    );
  if (c.payment.utalasiSzamlaszam)
    sections.push(`  4.10. Utalási célszámlaszám: ${c.payment.utalasiSzamlaszam}`);
  sections.push("");

  // 5. Birtokbaadás
  sections.push("5. BIRTOKBAADÁS");
  sections.push("");
  sections.push(
    `  5.1. Birtokbaadás tervezett dátuma: ${c.possession.datum || "[dátum]"}.`,
  );
  if (c.possession.feltetel)
    sections.push(`  5.2. Birtokbaadás feltétele: ${c.possession.feltetel}`);
  if (c.possession.kozmuAtiras)
    sections.push("  5.3. A közműórák átírása a birtokbaadás napján közösen történik.");
  if (c.possession.kulcsAtadas)
    sections.push("  5.4. A kulcsok átadása a birtokbaadás napján történik.");
  if (c.possession.eladoKikoltozes)
    sections.push(`  5.5. Eladó kiköltözési kötelezettsége: ${c.possession.eladoKikoltozes}`);
  if (c.possession.ingosagokMaradnak)
    sections.push(`  5.6. Az ingatlanban maradó ingóságok: ${c.possession.ingosagokListaja || "[lista]"}`);
  if (c.possession.kotberKesedelem)
    sections.push(
      `  5.7. Késedelem esetén kötbér: ${fmt(c.possession.kotberOsszeg, c.payment.penznem)}.`,
    );
  sections.push("");

  // 6. Szavatosság és nyilatkozatok
  sections.push("6. SZAVATOSSÁG, NYILATKOZATOK");
  sections.push("");
  sections.push(
    "  6.1. Eladó szavatol az ingatlan per-, teher- és igénymentességéért a 3. pontban rögzített kivételekkel. (Ügyvédi ellenőrzés szükséges.)",
  );
  sections.push(
    "  6.2. Felek kijelentik, hogy a jelen szerződést átolvasás és értelmezés után, mint akaratukkal mindenben megegyezőt írják alá.",
  );

  // 7. Speciális — kiskorú
  if (minors.length > 0) {
    sections.push("");
    sections.push("7. KISKORÚ / KORLÁTOZOTT CSELEKVŐKÉPESSÉG SPECIÁLIS RENDELKEZÉSEI");
    sections.push("");
    sections.push(
      "  A kiskorú fél(ek) érintettsége miatt a szerződés hatálybalépéséhez — az érintett ügyleti körben — gyámhatósági jóváhagyás szükségessége vizsgálandó. A jóváhagyás megadásáig a felek jogai és kötelezettségei felfüggesztett hatállyal állnak fenn. Jogi review szükséges.",
    );
  }

  // 8. Termőföld
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  if (agri) {
    sections.push("");
    sections.push("8. FÖLDFORGALMI RENDELKEZÉSEK (TERMŐFÖLD / MEZŐGAZDASÁGI INGATLAN)");
    sections.push("");
    sections.push(
      "  Termőföld / mezőgazdasági föld esetén a földforgalmi szabályok, elővásárlási jogok, kifüggesztési és hatósági jóváhagyási kötelezettségek ügyvédi ellenőrzése kötelező. A szerződés hatályba lépésének feltétele a jogszabály szerinti hatósági jóváhagyás megléte.",
    );
  }

  // 9. Mellékletek
  sections.push("");
  sections.push("9. MELLÉKLETEK");
  sections.push("");
  generateAttachmentList(c).forEach((a, i) =>
    sections.push(`  ${i + 1}. ${a.cim}${a.kotelezo ? " (kötelező)" : " (ajánlott)"}`),
  );

  // 10. Záró
  sections.push("");
  sections.push("10. ZÁRÓ RENDELKEZÉSEK");
  sections.push("");
  sections.push(
    "  A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyv és a vonatkozó magyar jogszabályok rendelkezései az irányadók.",
  );

  // Signatures
  sections.push("");
  sections.push("ALÁÍRÁSOK");
  sections.push("");
  sections.push("  Eladó(k):");
  eladok.forEach((p) =>
    sections.push(`    ____________________   (${p.kind === "termeszetes" ? p.nev : p.cegnev})`),
  );
  sections.push("");
  sections.push("  Vevő(k):");
  vevok.forEach((p) =>
    sections.push(`    ____________________   (${p.kind === "termeszetes" ? p.nev : p.cegnev})`),
  );
  sections.push("");
  sections.push("ÜGYVÉDI ELLENJEGYZÉS");
  sections.push("");
  sections.push("  Készítettem és ellenjegyzem: ____________________");
  sections.push("  Dátum: ____________   Hely: ____________");
  sections.push("");
  sections.push(
    "— TERVEZET vége. Ügyvédi ellenőrzés és ellenjegyzés nélkül nem használható. —",
  );

  return sections.join("\n");
}
