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

function formatDraftDate(value?: string): string {
  if (!value) return "[dátum]";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "[dátum]";
  return date.toLocaleDateString("hu-HU", { timeZone: "Europe/Budapest" });
}

const REVIEW = (msg: string) => `[HIÁNYZÓ ADAT / ÜGYVÉDI DÖNTÉS SZÜKSÉGES: ${msg}]`;
const LEGAL_REVIEW = (msg: string) => `[ÜGYVÉDI ELLENŐRZÉS SZÜKSÉGES: ${msg}]`;

function describeParty(p: Party): string {
  if (p.kind === "termeszetes") {
    const age = calculateAge(p.szuletesiDatum);
    const cap = CAPACITY_LABEL[determineCapacityStatus(p)];
    return [
      `${p.nev || "[név]"} (születési név: ${p.szuletesiNev || "[születési név]"}; anyja neve: ${p.anyjaNeve || "[anyja neve]"};`,
      `született: ${p.szuletesiHely || "[hely]"}, ${p.szuletesiDatum || "[dátum]"}${age !== null ? `; ${age} év` : ""};`,
      `lakcím: ${p.lakcim || "[lakcím]"}; személyazonosító okmány: ${p.okmanyAzonosito || "[okmányszám]"};`,
      `adóazonosító jel: ${p.adoazonosito || "[adóazonosító]"}; állampolgárság: ${p.allampolgarsag || "[állampolgárság]"};`,
      `cselekvőképességi státusz: ${cap})`,
    ].join(" ");
  }
  return [
    `${p.cegnev || "[cégnév]"} (cégjegyzékszám: ${p.cegjegyzekszam || "[cgj.]"};`,
    `adószám: ${p.adoszam || "[adószám]"}; székhely: ${p.szekhely || "[székhely]"};`,
    `képviseli: ${p.kepviseloNeve || "[képviselő]"}, képviselet módja: ${p.kepviseletModja || "[mód]"})`,
  ].join(" ");
}

function afaSzoveg(c: CaseFile): string {
  switch (c.payment.afaKezeles) {
    case "afa_korin_kivuli":
      return "A Vételár — tekintettel arra, hogy az adásvétel nem ÁFA-körbe tartozó ügylet (általános forgalmi adóról szóló 2007. évi CXXVII. tv. szerint) — ÁFÁ-t nem tartalmaz.";
    case "afa_mentes":
      return "A Vételár az Áfa tv. 86. § (1) bek. j)–k) pontjai szerinti adómentes ingatlanértékesítésre vonatkozik, így ÁFÁ-t nem tartalmaz.";
    case "tartalmazza_27":
      return "A Vételár a 27%-os mértékű általános forgalmi adót (ÁFA) tartalmazza.";
    case "tartalmazza_5":
      return "A Vételár az új építésű lakóingatlanra irányadó 5%-os mértékű általános forgalmi adót (ÁFA) tartalmazza (Áfa tv. 3. számú melléklet I. rész 50. pont).";
    case "forditott":
      return "Az ügylet az Áfa tv. 142. § szerinti fordított adózás hatálya alá tartozik; az adófizetésre a Vevő kötelezett.";
    default:
      return REVIEW("ÁFA-kezelés (áfa-körön kívüli / áfa-mentes / 27% / 5% új építésű / fordított adózás) — adótanácsadói és ügyvédi döntés szükséges a Vételárkikötés véglegesítése előtt");
  }
}

interface SectionCtx {
  sections: string[];
  num: number;
}

function startSection(ctx: SectionCtx, title: string) {
  ctx.sections.push(`${ctx.num}. ${title}`);
  ctx.sections.push("");
  const counter = { sub: 0, no: ctx.num };
  ctx.num += 1;
  return counter;
}

function sub(counter: { sub: number; no: number }, body: string, indent = false) {
  counter.sub += 1;
  const prefix = indent ? "  " : "";
  return `${prefix}${counter.no}.${counter.sub}. ${body}`;
}

export function generateContractDraft(c: CaseFile): string {
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");
  const ccy = c.payment.penznem;

  const out: string[] = [];

  const ff = c.special.foldforgalmi;
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  const biztOkm = agri && ff.nyomtatasiValtozat === "biztonsagi_okmany";

  out.push(DRAFT_BANNER);
  out.push("");
  if (biztOkm) {
    out.push("[BIZTONSÁGI OKMÁNYRA TÖRTÉNŐ NYOMTATÁSHOZ ELŐKÉSZÍTETT VÁLTOZAT]");
    out.push(
      "  A 2013. évi CXXII. tv. (Földforgalmi tv.) és a kapcsolódó jogszabályok szerint mező- és erdőgazdasági föld adásvételi szerződését biztonsági okmányon („zöld papír”) kell kiállítani. A jelen tervezetet az ügyvéd a biztonsági okmány lapjaira nyomtatja, a sorszámot az ügyiratban dokumentálja.",
    );
    out.push(`  Biztonsági okmány sorszáma: ${ff.biztonsagiOkmanySorszam || "____________________"}`);
    out.push(`  Kiállító / forgalmazó: ${ff.biztonsagiOkmanyKiallito || "____________________"}`);
    out.push("");
  } else if (agri) {
    out.push("[SIMA NYOMTATOTT VÁLTOZAT — földforgalmi ügylet]");
    out.push(
      "  Figyelem: a mező- és erdőgazdasági föld adásvételi szerződését a Földforgalmi tv. szerint biztonsági okmányon („zöld papír”) kell véglegesíteni. A jelen sima nyomtatott példány belső munkapéldányként, egyeztetésre szolgál.",
    );
    out.push("");
  }

  out.push("INGATLAN ADÁSVÉTELI SZERZŐDÉS");
  out.push("(tervezet — ügyvédi ellenőrzésre és ellenjegyzésre előkészítve)");
  out.push("");
  out.push(
    `Ügyazonosító: ${c.ugyAzonosito || "[ügyazonosító]"}    Készítés dátuma: ${formatDraftDate(c.letrehozva)}    Hely: ${c.property.telepules || "[hely]"}`,
  );
  out.push("");
  out.push(
    `Ügylet típusa: ${c.transactionTypes.map((t) => TRANSACTION_TYPE_LABELS[t]).join(", ") || "[típus]"}`,
  );
  out.push("");
  out.push(
    "amely létrejött egyrészről az alább megjelölt eladó(k) (a továbbiakban: „Eladó”), másrészről az alább megjelölt vevő(k) (a továbbiakban: „Vevő”; az Eladó és a Vevő együttesen: „Felek”) között a mai napon, az alulírott helyen és időben, az alábbi feltételekkel:",
  );
  out.push("");

  const ctx: SectionCtx = { sections: out, num: 1 };

  // 1. FELEK
  let s = startSection(ctx, "A SZERZŐDŐ FELEK");
  out.push(sub(s, "Eladó(k):"));
  if (eladok.length === 0) out.push("  " + REVIEW("eladó adatai hiányoznak"));
  eladok.forEach((p, i) => out.push(`  ${i + 1}. ${describeParty(p)}`));
  out.push("");
  out.push(sub(s, "Vevő(k):"));
  if (vevok.length === 0) out.push("  " + REVIEW("vevő adatai hiányoznak"));
  vevok.forEach((p, i) => out.push(`  ${i + 1}. ${describeParty(p)}`));
  out.push("");
  out.push(
    sub(s, "Felek kijelentik, hogy szerződéskötési képességük nem korlátozott, a jelen szerződés megkötésére teljes körű felhatalmazással és cselekvőképességgel rendelkeznek."),
  );
  out.push(
    sub(s, "A természetes személy Felek a 2017. évi LIII. törvény (Pmt.) szerinti ügyfél-átvilágításhoz szükséges adataikat az eljáró ügyvédnek a vonatkozó okmányok bemutatásával igazolták; az okmányokról az ügyvéd a Pmt. szerinti másolatot készít."),
  );

  // Cégek képviseleti nyilatkozata — ha van cég-fél
  const cegek = c.parties.filter((p) => p.kind === "ceg");
  if (cegek.length > 0) {
    cegek.forEach((co) => {
      if (co.kind !== "ceg") return;
      out.push(
        sub(
          s,
          `A ${co.cegnev || "[cégnév]"} (cégjegyzékszám: ${co.cegjegyzekszam || "[cgj.]"}) nyilatkozik, hogy a jelen szerződés megkötése a társaság rendes ügymenetébe tartozik, létesítő okiratával és a hatályos cégjegyzékkel összhangban áll; képviselője a cégkivonat és az aláírási címpéldány alapján önállóan/együttesen jogosult a társaság képviseletére. A cégkivonat kelte: ${co.cegkivonatDatuma || "[dátum]"}.`,
        ),
      );
    });
  }

  // Törvényes képviselet
  const minors = c.parties.filter(
    (p): p is NaturalPerson => p.kind === "termeszetes" && isMinor(p),
  );
  if (minors.length > 0) {
    minors.forEach((m) => {
      out.push(
        sub(
          s,
          `Törvényes képviselet: a(z) ${m.nev || "[név]"} nevű, ${calculateAge(m.szuletesiDatum) ?? "[…]"} éves kiskorú fél nevében törvényes képviselője, ${m.kepviselo?.nev || "[képviselő neve]"} (${m.kepviselo?.minoseg || "minőség"}, lakcím: ${m.kepviselo?.lakcim || "[lakcím]"}) jár el. A Ptk. 2:15. § és a gyámhatóságról szóló jogszabályok alapján a kiskorút érintő vagyoni jogügylethez gyámhatósági jóváhagyás szükséges; a szerződés hatálybalépésének feltétele a jogerős gyámhatósági jóváhagyó határozat.`,
        ),
      );
    });
  }
  out.push("");

  // 2. INGATLAN
  s = startSection(ctx, "A SZERZŐDÉS TÁRGYÁT KÉPEZŐ INGATLAN");
  out.push(sub(s, "A szerződés tárgyát képezi az alábbi ingatlan (a továbbiakban: „Ingatlan”):"));
  out.push(
    `  – természetbeni cím: ${c.property.iranyitoszam || "[ir.sz.]"} ${c.property.telepules || "[település]"}, ${c.property.cim || "[utca, hsz.]"};`,
  );
  out.push(`  – helyrajzi szám: ${c.property.helyrajziSzam || "[hrsz.]"};`);
  out.push(
    `  – művelési ág / megnevezés: ${c.property.ingatlanTipus || "[típus]"}${c.property.muvelesiAg ? ` / ${c.property.muvelesiAg}` : ""};`,
  );
  out.push(`  – alapterület: ${c.property.alapterulet || "[m²]"} m²;`);
  out.push(`  – eladói tulajdoni hányad: ${c.property.tulajdoniHanyad || "1/1"}.`);
  if (c.property.tarsashaziAlbetet)
    out.push(
      sub(s, "Az Ingatlan társasházi külön tulajdonú albetét; a közös tulajdoni hányadra a társasházi alapító okirat irányadó."),
    );
  if (c.property.teremgarazsTarolo) {
    out.push(
      sub(
        s,
        "Az adásvételhez kapcsolódóan teremgarázs- és/vagy tárolóhasználat is átszáll a Vevőre. A pontos jogi minősítés (külön albetét, eszmei hányad, vagy kizárólagos használati jog) a tulajdoni lap alapján: " +
          (c.property.helyrajziSzam
            ? `${c.property.helyrajziSzam} hrsz.`
            : LEGAL_REVIEW("teremgarázs/tároló jogi státusza — tulajdoni lapon ellenőrizendő")),
      ),
    );
  }
  if (c.property.energetikaiTanusitvany)
    out.push(
      sub(
        s,
        `Az Ingatlanra a 176/2008. (VI. 30.) Korm. rendelet szerinti energetikai tanúsítvány (HET-szám: ${c.property.energetikaiTanusitvany}) kiállításra került; az Eladó a tanúsítvány egy példányát a jelen szerződés aláírásával egyidejűleg a Vevőnek átadja, melyet a Vevő külön nyilatkozattal igazol.`,
      ),
    );
  else
    out.push(
      sub(
        s,
        "Felek rögzítik, hogy a 176/2008. (VI. 30.) Korm. rendelet szerinti energetikai tanúsítvány kiállítása és Vevő részére történő átadása az Eladó kötelezettsége, mely a birtokbaadásig teljesítendő. " +
          LEGAL_REVIEW("HET-szám pótlólagos rögzítése"),
      ),
    );
  out.push("");

  // 3. TULAJDONI / TEHERVISZONYOK
  s = startSection(ctx, "TULAJDONI ÉS TEHERVISZONYOK");
  out.push(
    sub(
      s,
      "Eladó kijelenti, hogy az Ingatlan a kizárólagos tulajdonát képezi a 2. szakaszban megjelölt tulajdoni hányad szerint, és tulajdonjogát az ingatlan-nyilvántartásba bejegyezték.",
    ),
  );
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
    out.push(
      sub(
        s,
        "Eladó szavatolja, hogy az Ingatlan per-, teher- és igénymentes, harmadik személynek nincs olyan joga vagy követelése, amely a Vevő tulajdonszerzését korlátozná vagy a használatot akadályozná. (A nyilatkozat valóságtartalma a hiteles tulajdoni lap alapján ügyvédileg ellenőrzendő.)",
      ),
    );
  } else {
    out.push(sub(s, `Az Ingatlanon az alábbi jogok/terhek állnak fenn: ${enc.join("; ")}.`));
    if (c.property.tehermentesitesiTerv)
      out.push(sub(s, `Tehermentesítési terv: ${c.property.tehermentesitesiTerv}`));
    else
      out.push(
        sub(
          s,
          REVIEW(
            "tehermentesítési terv (kiváltáshoz szükséges összeg, határidő, hitelező nyilatkozata, letéti feltételek) — szerződéskötés előtt rögzítendő",
          ),
        ),
      );
  }
  out.push(
    sub(
      s,
      "Eladó kijelenti, hogy az Ingatlannal kapcsolatban közüzemi-, közös költség- vagy adótartozása nem áll fenn; a társasházi közös költség tartozásmentességét a közös képviselő igazolásával a birtokbaadás napjáig igazolja.",
    ),
  );
  out.push(
    sub(
      s,
      "Eladó kijelenti továbbá, hogy az Ingatlanra vonatkozóan nincs folyamatban olyan hatósági, peres vagy nemperes eljárás, amely a Vevő tulajdonszerzését érintené.",
    ),
  );
  out.push("");

  // 4. VÉTELÁR ÉS FIZETÉS
  s = startSection(ctx, "VÉTELÁR ÉS FIZETÉSI FELTÉTELEK");
  out.push(
    sub(
      s,
      `Felek az Ingatlan kölcsönösen elfogadott vételárát ${fmt(c.payment.teljesVetelar || "", ccy)} összegben határozzák meg (a továbbiakban: „Vételár”). ${afaSzoveg(c)}`,
    ),
  );
  if (c.payment.foglaloVan) {
    if (!c.payment.foglaloOsszeg) {
      out.push(sub(s, REVIEW("foglaló összege")));
    } else {
      out.push(
        sub(
          s,
          `Foglaló: a Vevő a Vételár részeként a jelen szerződés aláírásával egyidejűleg ${fmt(c.payment.foglaloOsszeg, ccy)} foglalót fizet meg az Eladó részére. A foglalóra a Ptk. 6:185. § irányadó: ha a teljesítés olyan okból hiúsul meg, amelyért egyik fél sem felelős, a foglaló visszajár; ha a foglalót adó Vevő felelős, a foglalót elveszti; ha az Eladó felelős, a kapott foglaló kétszeresét köteles visszafizetni.`,
        ),
      );
    }
  }
  if (c.payment.elolegVan)
    out.push(
      sub(
        s,
        "Előleg: a Vevő a Vételár terhére előleget fizet, amely meghiúsulás esetén — eltérő megállapodás hiányában — visszajár.",
      ),
    );
  if (c.payment.onero)
    out.push(sub(s, `Önerő: ${fmt(c.payment.onero, ccy)}, melyet a Vevő saját forrásból teljesít.`));
  if (c.payment.bankhitelVan) {
    if (!c.payment.bankNeve || !c.payment.hitelOsszeg || !c.payment.hitelFolyositasHatarido) {
      out.push(
        sub(
          s,
          REVIEW(
            "banki hitel: bank megnevezése / hitelösszeg / folyósítási határidő — végleges szerződés előtt szükséges",
          ),
        ),
      );
    } else {
      out.push(
        sub(
          s,
          `Banki hitel: a Vevő a Vételár ${fmt(c.payment.hitelOsszeg, ccy)} összegű részét a ${c.payment.bankNeve} által nyújtott jelzáloghitelből kívánja teljesíteni. A hitel folyósításának várható határideje: ${c.payment.hitelFolyositasHatarido}.`,
        ),
      );
    }
    out.push(
      sub(
        s,
        "A banki hitel folyósításának biztosítása érdekében Felek a Polgári Törvénykönyv 6:216–6:217. §-a szerinti tulajdonjog-fenntartást kötnek ki: az Eladó a Vételár hiánytalan kiegyenlítéséig fenntartja a tulajdonjogát, és a Vevő javára — az új Inytv. (2021. évi C. tv.) szerint — a tulajdonjog-fenntartáshoz kapcsolódó vevői jog kerül az ingatlan-nyilvántartásba bejegyzésre. A vevői jog bejegyzésétől számított 6 hónapon belül a Vevő javára a tulajdonjog bejegyzése a vevői jog ranghelyén történhet. Az Eladó vállalja, hogy a finanszírozó bank javára szóló jelzálogjog, valamint elidegenítési és terhelési tilalom bejegyzéséhez hozzájárul. " +
          LEGAL_REVIEW(
            "az új Inytv. (2021. évi C. tv., hatályos 2026.03.01-től) megszüntette a függőben tartás (régi Inytv. 47/A. §) jogintézményét — a Ptk. szerinti tulajdonjog-fenntartáshoz kapcsolódó vevői jog konkrét bejegyzési rendje és a banki finanszírozóval való összhang ügyvédi ellenőrzése kötelező",
          ),
      ),
    );
  }
  if (c.payment.ugyvediLetet)
    out.push(
      sub(
        s,
        "Ügyvédi letét: Felek a Vételár meghatározott részét az eljáró ügyvédnél kezelt ügyvédi letétbe helyezik az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.) 47–53. §-ai szerint; a letét pontos feltételeit (összeg, kifizetési feltételek, kamatozás, költségek) külön ügyvédi letéti szerződés rögzíti, mely a jelen szerződés elválaszthatatlan részét képezi.",
      ),
    );
  if (c.payment.reszletfizetes) {
    if (c.payment.fizetesiUtemezes) {
      out.push(sub(s, `Részletfizetési ütemezés: ${c.payment.fizetesiUtemezes}`));
    } else {
      out.push(sub(s, REVIEW("részletfizetési ütemezés szövege (esedékességi időpontok, összegek)")));
    }
  }
  if (c.payment.meglevoTeherKivaltas)
    out.push(
      sub(
        s,
        `Meglévő terhek kiváltása: ${
          c.payment.tehermentesitesModja ||
          "az Eladó terhére fennálló jelzáloghitel kiváltása a Vételár meghatározott részéből, közvetlenül a hitelező pénzügyi intézmény részére történő átutalással történik, törlési engedély egyidejű kiadása mellett."
        }`,
      ),
    );
  if (c.payment.utalasiSzamlaszam)
    out.push(
      sub(s, `A Vevő a Vételár átutalással teljesítendő részét az alábbi számlaszámra fizeti meg: ${c.payment.utalasiSzamlaszam}.`),
    );
  else
    out.push(sub(s, REVIEW("Eladó utalási számlaszáma")));
  out.push(
    sub(
      s,
      "A pénzügyi teljesítés akkor minősül megtörténtnek, amikor a Vételár megfelelő része az Eladó (illetve a hitelező / letéteményes) számláján maradéktalanul jóváírásra került.",
    ),
  );
  out.push(sub(s, "Késedelem esetén a Polgári Törvénykönyv szerinti törvényes késedelmi kamat jár."));
  out.push("");

  // 5. BIRTOKBAADÁS
  s = startSection(ctx, "BIRTOKBAADÁS, KÁRVESZÉLY-ÁTSZÁLLÁS");
  out.push(
    sub(
      s,
      `Az Ingatlant az Eladó a teljes Vételár hiánytalan megfizetésével egyidejűleg, ${
        c.possession.datum ? "legkésőbb " + c.possession.datum + " napján" : REVIEW("birtokbaadás napja")
      } adja a Vevő birtokába.`,
    ),
  );
  if (c.possession.feltetel)
    out.push(sub(s, `Birtokbaadás feltétele: ${c.possession.feltetel}.`));
  if (c.possession.kozmuAtiras)
    out.push(
      sub(
        s,
        "A közüzemi mérőórák (víz, gáz, villany, fűtés) állását a Felek a birtokbaadás napján közös jegyzőkönyvben rögzítik; az átírást a Vevő intézi, az átírás napjáig keletkezett közüzemi díjak az Eladót terhelik.",
      ),
    );
  if (c.possession.kulcsAtadas)
    out.push(
      sub(
        s,
        "A kulcsok, a beléptető kódok és a kapcsolódó dokumentumok átadása a birtokbaadás napján, jegyzőkönyvben rögzítetten történik.",
      ),
    );
  if (c.possession.eladoKikoltozes)
    out.push(sub(s, `Az Eladó kiköltözési kötelezettsége: ${c.possession.eladoKikoltozes}.`));
  if (c.possession.ingosagokMaradnak) {
    if (c.possession.ingosagokListaja) {
      out.push(
        sub(
          s,
          `Az Ingatlanban maradó ingóságok a Vételár részét képezik; jegyzéküket az átadás-átvételi jegyzőkönyv tartalmazza: ${c.possession.ingosagokListaja}.`,
        ),
      );
    } else {
      out.push(sub(s, REVIEW("Ingatlanban maradó ingóságok tételes jegyzéke")));
    }
  }
  if (c.possession.kotberKesedelem) {
    if (!c.possession.kotberOsszeg) {
      out.push(sub(s, REVIEW("birtokbaadási késedelem kötbérének összege")));
    } else {
      out.push(
        sub(
          s,
          `A birtokbaadási kötelezettség késedelmes teljesítése esetén az Eladó a Vevő részére ${fmt(c.possession.kotberOsszeg, ccy)} összegű kötbér megfizetésére köteles a Ptk. 6:186–6:189. §-ai szerint.`,
        ),
      );
    }
  }
  out.push(
    sub(
      s,
      "Az Ingatlanra vonatkozó kárveszély a birtokbaadás napján száll át az Eladóról a Vevőre. Ezen időponttól terhelik a Vevőt az Ingatlannal kapcsolatos közterhek, díjak és költségek (Ptk. 6:219. §).",
    ),
  );
  out.push(
    sub(
      s,
      "Az Eladó köteles az Ingatlant a birtokbaadáskor a 4. szakaszban rögzített feltételek szerinti, rendeltetésszerű használatra alkalmas állapotban átadni.",
    ),
  );
  out.push("");

  // 6. TULAJDONJOG-ÁTSZÁLLÁS, INYTV.
  s = startSection(ctx, "TULAJDONJOG-ÁTSZÁLLÁS ÉS INGATLAN-NYILVÁNTARTÁSI BEJEGYZÉS");
  out.push(
    sub(
      s,
      "Felek megállapodnak abban, hogy az Eladó a Vevő tulajdonjog-bejegyzéséhez szükséges, feltétel nélküli és visszavonhatatlan bejegyzési engedélyt a teljes Vételár hiánytalan megfizetésével egyidejűleg, külön okiratban adja ki, melyet az eljáró ügyvéd ügyvédi letétben kezel az Üttv. szerint. Felek tudomásul veszik, hogy az ingatlan-nyilvántartási bejegyzésre az új Inytv. (2021. évi C. tv. — hatályos 2026.03.01-től) és végrehajtási rendelete (179/2023. (V. 15.) Korm. r.) az irányadó. " +
        LEGAL_REVIEW(
          "a bejegyzési engedély pontos formai követelményei az új Inytv. és vhr. alapján — szakaszhivatkozás ügyvédi véglegesítése kötelező",
        ),
    ),
  );
  if (c.payment.bankhitelVan) {
    out.push(
      sub(
        s,
        "A finanszírozó bank javára szóló jelzálogjog, valamint elidegenítési és terhelési tilalom bejegyzéséhez az Eladó hozzájárul; a Vevő tulajdonjogának bejegyzése a 4. szakaszban kikötött tulajdonjog-fenntartáshoz kapcsolódó vevői jog ranghelyén történik.",
      ),
    );
  } else {
    out.push(
      sub(
        s,
        "A Vevő tulajdonszerzésének jogcíme: vétel. A tulajdonjog bejegyzése iránti kérelmet az eljáró ügyvéd nyújtja be az ingatlanügyi hatósághoz az elektronikus ingatlan-nyilvántartási rendszeren (E-ING) keresztül.",
      ),
    );
  }
  out.push(
    sub(
      s,
      "Az ingatlan-nyilvántartási eljárás megindítása (a kérelem benyújtása) az eljáró ügyvéd feladata; ehhez a Felek minden szükséges adatot, okiratot és nyilatkozatot határidőben rendelkezésre bocsátanak.",
    ),
  );
  out.push("");

  // 7. SZAVATOSSÁG
  s = startSection(ctx, "SZAVATOSSÁG, JOG- ÉS KELLÉKSZAVATOSSÁG, FELELŐSSÉG");
  out.push(
    sub(
      s,
      "Az Eladó a Ptk. 6:170–6:177. §-ai szerinti kellék- és jogszavatossággal tartozik. Eladó szavatol különösen azért, hogy az Ingatlan a 3. szakaszban rögzítettek szerinti tulajdoni és teherviszonyokkal rendelkezik, és harmadik személynek nincs olyan joga, amely a tulajdonjog átszállását vagy a Vevő birtoklását, használatát akadályozná.",
    ),
  );
  out.push(
    sub(
      s,
      "Az Eladó az Ingatlan rejtett hibáiért a Ptk. szerint felel; a Vevő az Ingatlant a szerződés aláírása előtt megtekintette, annak adottságait, állapotát és a megtekintéssel felismerhető hibákat ismeri, ezek tekintetében a jogszabály erejénél fogva szavatossági igényt nem érvényesít.",
    ),
  );
  out.push(
    sub(
      s,
      "Felek kölcsönösen kijelentik, hogy a jelen szerződést annak átolvasása és értelmezése után, mint akaratukkal mindenben megegyezőt írják alá.",
    ),
  );
  out.push("");

  // 8. KÖLTSÉGEK / ADÓK
  s = startSection(ctx, "KÖLTSÉGEK, ADÓK, ILLETÉK, BEJELENTÉSI KÖTELEZETTSÉG");
  out.push(
    sub(
      s,
      "A visszterhes vagyonátruházási illeték az illetékekről szóló 1990. évi XCIII. törvény (Itv.) szerint a Vevőt terheli. Az illeték kiszabását a Nemzeti Adó- és Vámhivatal (NAV) végzi a B400 jelű adatlap alapján. A B400 adatlap kitöltése és benyújtása az eljáró ügyvéd közreműködésével az adózás rendjéről szóló 2017. évi CL. törvény (Art.) szerint az ingatlan-nyilvántartási kérelem ingatlanügyi hatósághoz történő benyújtásával egyidejűleg történik (az ingatlanügyi hatóság továbbítja a NAV felé).",
    ),
  );
  out.push(
    sub(
      s,
      "Az Eladót terhelő, a vételárból befolyó jövedelem után fennálló esetleges személyi jövedelemadó (Szja-tv. 62. §) megfizetése az Eladó kötelezettsége; az Eladó a vonatkozó kedvezményeket és számított adót a saját éves bevallásában érvényesíti.",
    ),
  );
  out.push(
    sub(
      s,
      "Az ügyvédi munkadíj a Felek külön megállapodása szerint kerül megfizetésre; eltérő megállapodás hiányában az ügyvédi munkadíj és a kapcsolódó eljárási költségek (igazgatási szolgáltatási díj, tulajdoni lap, térképmásolat) a Vevőt terhelik.",
    ),
  );
  out.push("");

  // 9. PMT/GDPR
  s = startSection(ctx, "ÜGYFÉL-ÁTVILÁGÍTÁS (PMT.) ÉS ADATKEZELÉS (GDPR)");
  out.push(
    sub(
      s,
      "Az eljáró ügyvéd a 2017. évi LIII. törvény (Pmt.) alapján a Feleket átvilágította; a Felek a Pmt. szerinti azonosító adataikat hiánytalanul megadták, a tényleges tulajdonosi nyilatkozatot megtették, és nyilatkoztak arról, hogy kiemelt közszereplőnek minősülnek-e (Pmt. 9. §).",
    ),
  );
  out.push(
    sub(
      s,
      "Felek tudomásul veszik, hogy az eljáró ügyvéd a Pmt., az Üttv. és az ingatlan-nyilvántartási jogszabályok szerint köteles a személyes adataikat és a vonatkozó okiratokat kezelni és — a jogszabályban meghatározott ideig — megőrizni. Az adatkezelés jogalapja a GDPR (EU) 2016/679 rendelet 6. cikk (1) bek. c) (jogi kötelezettség) és b) pontja (szerződés teljesítése).",
    ),
  );
  out.push(
    sub(s, "Felek nyilatkoznak, hogy az ügyvéd adatkezelési tájékoztatóját megismerték és elfogadták."),
  );
  out.push("");

  // 10. Speciális — kiskorú
  if (minors.length > 0) {
    s = startSection(ctx, "KISKORÚ / KORLÁTOZOTT CSELEKVŐKÉPESSÉG SPECIÁLIS RENDELKEZÉSEI");
    out.push(
      sub(
        s,
        "A kiskorú fél(ek) érintettsége miatt a szerződés hatálybalépésének feltétele az illetékes gyámhatóság jóváhagyó határozatának jogerőre emelkedése. A jóváhagyás megadásáig a Felek jogai és kötelezettségei felfüggesztett hatállyal állnak fenn. Amennyiben a gyámhatóság a jóváhagyást megtagadja, a szerződés érvénytelennek minősül és a Felek az addig teljesített szolgáltatásokat egymásnak visszaszolgáltatják.",
      ),
    );
    out.push("");
  }

  // 11. Földforgalmi
  if (agri) {
    s = startSection(ctx, "FÖLDFORGALMI RENDELKEZÉSEK (TERMŐFÖLD / MEZŐGAZDASÁGI INGATLAN)");
    out.push(
      sub(
        s,
        "Felek tudomásul veszik, hogy a 2013. évi CXXII. törvényt (Földforgalmi tv.) alkalmazni kell: a szerződést a települési önkormányzat jegyzőjénél kifüggesztésre kell benyújtani az elővásárlási jogosultak nyilatkoztatása céljából; a szerződés hatálybalépésének feltétele a mezőgazdasági igazgatási szerv jóváhagyó határozatának jogerőre emelkedése. A Vevő szerzőképességét és a tulajdonszerzéshez szükséges nyilatkozatait külön, a Földforgalmi tv. szerinti formában teszi meg.",
      ),
    );
    out.push(
      sub(
        s,
        `A jelen szerződést a Felek a Földforgalmi tv. és a 47/2014. (II. 26.) Korm. rendelet szerinti biztonsági okmányon („zöld papír”) állítják ki. A biztonsági okmány sorszáma: ${ff.biztonsagiOkmanySorszam || REVIEW("biztonsági okmány sorszáma")}; kiállító/forgalmazó: ${ff.biztonsagiOkmanyKiallito || REVIEW("kiállító/forgalmazó megnevezése")}.`,
      ),
    );
    out.push(
      sub(
        s,
        "Kifüggesztési záradék helye (a jegyző tölti ki): a szerződést a települési önkormányzat jegyzője ____________ napján kifüggesztette, a kifüggesztés ____________ napján járt le. Az elővásárlási jognyilatkozatok átvételét és a mezőgazdasági igazgatási szervhez történő továbbítást a jegyző külön igazolja.",
      ),
    );
    out.push("");
  }

  // 12. Társasházi
  if (c.property.tarsashaziAlbetet) {
    s = startSection(ctx, "TÁRSASHÁZI SPECIÁLIS RENDELKEZÉSEK");
    out.push(
      sub(
        s,
        "Az Eladó kötelezettséget vállal arra, hogy a társasházi alapító okiratot, a szervezeti és működési szabályzatot (SZMSZ), valamint az utolsó éves közgyűlési határozatok jegyzékét a Vevő részére átadja, továbbá a társasház közös képviselőjétől beszerzi és átadja a közös költség tartozásmentességéről szóló igazolást. A társasházi közös tulajdonra vonatkozó elővásárlási jogot a 2003. évi CXXXIII. tv. (Társasházi tv.) szerint az Eladó nyilatkozattal kezeli.",
      ),
    );
    out.push("");
  }

  // 13. Külföldi vevő
  const kulfoldiVevo = vevok.some(
    (v) => v.kind === "termeszetes" && v.allampolgarsag && !/magyar/i.test(v.allampolgarsag),
  );
  if (kulfoldiVevo) {
    s = startSection(ctx, "KÜLFÖLDI SZERZŐ INGATLANSZERZÉSI ENGEDÉLYE");
    out.push(
      sub(
        s,
        "Tekintettel arra, hogy a Vevő külföldi (nem magyar állampolgárságú) természetes személy, a termőföldnek nem minősülő ingatlan szerzéséhez — a 251/2014. (X. 2.) Korm. rendelet alapján — az illetékes fővárosi/megyei kormányhivatal engedélye szükséges. A szerződés hatálybalépésének feltétele az engedély jogerőre emelkedése. " +
          LEGAL_REVIEW("EGT-állampolgárra vonatkozó mentesség külön vizsgálandó"),
      ),
    );
    out.push("");
  }

  // 14. Elállás
  s = startSection(ctx, "ELÁLLÁS, A SZERZŐDÉS MEGHIÚSULÁSA");
  out.push(
    sub(
      s,
      "A Felek bármelyikének súlyos szerződésszegése esetén a sérelmet szenvedett Fél a másik Félhez intézett egyoldalú írásbeli nyilatkozattal a szerződéstől elállhat. Súlyos szerződésszegésnek minősül különösen a Vételár fizetési határidőtől számított 30 napot meghaladó késedelme, vagy az Eladó birtokbaadási kötelezettségének hasonló késedelme. Elállás esetén a Felek az addig teljesített szolgáltatásokat egymásnak visszaszolgáltatják, és a foglalóra a Ptk. szerinti szabályok irányadók.",
    ),
  );
  out.push("");

  // 15. Alkalmazandó jog, vitarendezés
  s = startSection(ctx, "ALKALMAZANDÓ JOG ÉS VITARENDEZÉS");
  out.push(
    sub(
      s,
      "A jelen szerződésre a magyar jog az irányadó. A jelen szerződésből eredő jogvitákat a Felek elsősorban békés úton kísérlik meg rendezni; ennek eredménytelensége esetén kikötik a Polgári perrendtartásról szóló 2016. évi CXXX. törvény szerint hatáskörrel és illetékességgel rendelkező bíróság illetékességét.",
    ),
  );
  out.push("");

  // 16. Ügyvédi ellenjegyzés
  s = startSection(ctx, "ÜGYVÉDI KÖZREMŰKÖDÉS ÉS ELLENJEGYZÉS");
  out.push(
    sub(
      s,
      `A jelen szerződést ${c.eljaroUgyved.nev || "[eljáró ügyvéd neve]"} (${c.eljaroUgyved.iroda || "[ügyvédi iroda]"}, ${c.eljaroUgyved.irodaCim || "[iroda címe]"}; KASZ: ${c.eljaroUgyved.kaszSzam || "[KASZ szám]"}) eljáró ügyvéd készítette és ellenjegyzi az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.) 43. §-a, valamint az ingatlan-nyilvántartásról szóló 2021. évi C. törvény (új Inytv. — hatályos 2026.03.01-től) okiratszerkesztésre vonatkozó rendelkezései alapján.`,
    ),
  );
  out.push(
    sub(
      s,
      "A jelen szerződés — az ügyvédi ellenjegyzés folytán — ügyvéd által ellenjegyzett magánokiratnak minősül, amely a Pp. 325. § (1) bek. g) pontja szerint teljes bizonyító erővel rendelkezik. Erre tekintettel a szerződés érvényességéhez tanúk közreműködése nem szükséges.",
    ),
  );
  out.push(
    sub(
      s,
      "Az eljáró ügyvéd a Felek személyazonosságát az okmányaik alapján ellenőrizte, a JÜB-rendszerben lekérdezte (az eredményt az ügyiratban dokumentálta), és a jognyilatkozatok tartalmáról a Feleket tájékoztatta. A Felek elismerik, hogy az ügyvéd jelen jogügyletben kizárólag okiratszerkesztőként és ellenjegyzőként jár el, közreműködését bármelyik Fél részéről történő képviseletként nem értelmezik.",
    ),
  );
  out.push("");

  // 17. Záró
  s = startSection(ctx, "ZÁRÓ RENDELKEZÉSEK");
  out.push(
    sub(
      s,
      "A jelen szerződésben nem szabályozott kérdésekben a 2013. évi V. törvény (Ptk.), az ingatlan-nyilvántartásról szóló 2021. évi C. törvény (új Inytv.) és végrehajtási rendelete, az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.), az illetékekről szóló 1990. évi XCIII. törvény (Itv.), valamint a vonatkozó egyéb magyar jogszabályok rendelkezései az irányadók.",
    ),
  );
  out.push(
    sub(
      s,
      "A szerződés bármely rendelkezésének esetleges érvénytelensége a többi rendelkezés érvényességét nem érinti, feltéve, hogy a felek a szerződést az érvénytelen rész nélkül is megkötötték volna.",
    ),
  );
  out.push(
    sub(s, "A jelen szerződés módosítása kizárólag írásban, valamennyi Fél egyező akaratnyilatkozatával, ügyvédi ellenjegyzéssel érvényes."),
  );
  const peldany = eladok.length + vevok.length + 3;
  out.push(
    sub(
      s,
      `A jelen szerződés ${peldany} (azaz ${peldany}) egymással mindenben megegyező eredeti példányban készült, amelyből minden Fél egy-egy példányt kap, kettő példány az ingatlan-nyilvántartási eljárás céljára szolgál, egy példány az eljáró ügyvédnél marad.`,
    ),
  );
  out.push("");

  // 18. Mellékletek
  s = startSection(ctx, "MELLÉKLETEK");
  generateAttachmentList(c).forEach((a, i) =>
    out.push(`  ${i + 1}. ${a.cim}${a.kotelezo ? " (kötelező)" : " (ajánlott)"} — ${a.indok}`),
  );
  out.push("");

  // Aláírások
  out.push("ALÁÍRÁSOK");
  out.push("");
  out.push(`Kelt: ${c.property.telepules || "[hely]"}, ${formatDraftDate(c.letrehozva)}`);
  out.push("");
  out.push("  Eladó(k):");
  eladok.forEach((p) =>
    out.push(
      `    ____________________________________   (${p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]"})`,
    ),
  );
  out.push("");
  out.push("  Vevő(k):");
  vevok.forEach((p) =>
    out.push(
      `    ____________________________________   (${p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]"})`,
    ),
  );
  out.push("");
  out.push("ÜGYVÉDI ELLENJEGYZÉS");
  out.push(
    "(2017. évi LXXVIII. tv. — Üttv. 43. § alapján — teljes bizonyító erejű magánokirat, tanúk nem szükségesek)",
  );
  out.push("");
  out.push("  Készítettem és ellenjegyzem:");
  out.push(`    Eljáró ügyvéd: ${c.eljaroUgyved.nev || "____________________________"}`);
  out.push(`    KASZ szám: ${c.eljaroUgyved.kaszSzam || "________________________"}`);
  out.push(`    Iroda: ${c.eljaroUgyved.iroda || "____________________________________"}`);
  out.push(`    Iroda címe: ${c.eljaroUgyved.irodaCim || "____________________________________"}`);
  out.push(`    Kelt: ____________   Hely: ${c.property.telepules || "____________"}`);
  out.push("    P.H. és aláírás: __________________________");
  out.push("");
  out.push(
    "— TERVEZET vége. Ügyvédi felülvizsgálat és ellenjegyzés nélkül nem használható. —",
  );

  // Sanitize any accidental triple-dot or stray patterns
  return out.join("\n").replace(/\.{4,}/g, "…").replace(/ {2,}\n/g, "\n");
}
