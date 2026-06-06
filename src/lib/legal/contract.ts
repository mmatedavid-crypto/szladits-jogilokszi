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

export function generateContractDraft(c: CaseFile): string {
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");
  const ccy = c.payment.penznem;

  const sections: string[] = [];

  // Földforgalmi „zöld papír” (biztonsági okmány) változat fejléce
  const ff = c.special.foldforgalmi;
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  const biztOkm = agri && ff.nyomtatasiValtozat === "biztonsagi_okmany";

  sections.push(DRAFT_BANNER);
  sections.push("");
  if (biztOkm) {
    sections.push("[BIZTONSÁGI OKMÁNYRA TÖRTÉNŐ NYOMTATÁSHOZ ELŐKÉSZÍTETT VÁLTOZAT]");
    sections.push(
      "  A 2013. évi CXXII. tv. (Földforgalmi tv.) és a kapcsolódó jogszabályok szerint mező- és erdőgazdasági föld adásvételi szerződését biztonsági okmányon („zöld papír”) kell kiállítani. A jelen tervezetet az ügyvéd a biztonsági okmány lapjaira nyomtatja, a sorszámot az ügyiratban dokumentálja.",
    );
    sections.push(
      `  Biztonsági okmány sorszáma: ${ff.biztonsagiOkmanySorszam || "____________________"}`,
    );
    sections.push(
      `  Kiállító / forgalmazó: ${ff.biztonsagiOkmanyKiallito || "____________________"}`,
    );
    sections.push("");
  } else if (agri) {
    sections.push("[SIMA NYOMTATOTT VÁLTOZAT — földforgalmi ügylet]");
    sections.push(
      "  Figyelem: a mező- és erdőgazdasági föld adásvételi szerződését a Földforgalmi tv. szerint biztonsági okmányon („zöld papír”) kell véglegesíteni. A jelen sima nyomtatott példány belső munkapéldányként, egyeztetésre szolgál.",
    );
    sections.push("");
  }

  sections.push("INGATLAN ADÁSVÉTELI SZERZŐDÉS");
  sections.push("(tervezet — ügyvédi ellenőrzésre és ellenjegyzésre előkészítve)");
  sections.push("");
  sections.push(
    `Ügyazonosító: ${c.ugyAzonosito || "[ügyazonosító]"}    Készítés dátuma: ${new Date().toLocaleDateString("hu-HU")}    Hely: ${c.property.telepules || "[hely]"}`,
  );
  sections.push("");
  sections.push(
    `Ügylet típusa: ${c.transactionTypes.map((t) => TRANSACTION_TYPE_LABELS[t]).join(", ") || "[típus]"}`,
  );
  sections.push("");
  sections.push(
    "amely létrejött egyrészről az alább megjelölt eladó(k) (a továbbiakban: „Eladó”), másrészről az alább megjelölt vevő(k) (a továbbiakban: „Vevő”; az Eladó és a Vevő együttesen: „Felek”) között a mai napon, az alulírott helyen és időben, az alábbi feltételekkel:",
  );
  sections.push("");

  // 1. Felek
  sections.push("1. A SZERZŐDŐ FELEK");
  sections.push("");
  sections.push("1.1. Eladó(k):");
  if (eladok.length === 0) sections.push("  [eladó adatai hiányoznak]");
  eladok.forEach((p, i) => sections.push(`  ${i + 1}. ${describeParty(p)}`));
  sections.push("");
  sections.push("1.2. Vevő(k):");
  if (vevok.length === 0) sections.push("  [vevő adatai hiányoznak]");
  vevok.forEach((p, i) => sections.push(`  ${i + 1}. ${describeParty(p)}`));
  sections.push("");
  sections.push(
    "1.3. Felek kijelentik, hogy szerződéskötési képességük nem korlátozott, a jelen szerződés megkötésére teljes körű felhatalmazással és cselekvőképességgel rendelkeznek.",
  );
  sections.push(
    "1.4. A természetes személy Felek a 2017. évi LIII. törvény (Pmt.) szerinti ügyfél-átvilágításhoz szükséges adataikat az eljáró ügyvédnek a vonatkozó okmányok bemutatásával igazolták; az okmányokról az ügyvéd a Pmt. szerinti másolatot készít.",
  );
  sections.push("");

  // Képviselők
  const minors = c.parties.filter(
    (p): p is NaturalPerson => p.kind === "termeszetes" && isMinor(p),
  );
  if (minors.length > 0) {
    sections.push("1.5. Törvényes képviselet (kiskorú / korlátozottan cselekvőképes fél)");
    minors.forEach((m) => {
      sections.push(
        `  A(z) ${m.nev || "[név]"} nevű, ${calculateAge(m.szuletesiDatum) ?? "[…]"} éves kiskorú fél nevében törvényes képviselője, ${m.kepviselo?.nev || "[képviselő neve]"} (${m.kepviselo?.minoseg || "minőség"}, lakcím: ${m.kepviselo?.lakcim || "[lakcím]"}) jár el. A Ptk. 2:15. § és a gyámhatóságról szóló jogszabályok alapján a kiskorút érintő vagyoni jogügylethez gyámhatósági jóváhagyás szükséges; a szerződés hatálybalépésének feltétele a jogerős gyámhatósági jóváhagyó határozat.`,
      );
    });
    sections.push("");
  }

  // 2. Az ingatlan
  sections.push("2. A SZERZŐDÉS TÁRGYÁT KÉPEZŐ INGATLAN");
  sections.push("");
  sections.push(
    `2.1. A szerződés tárgyát képezi az alábbi ingatlan (a továbbiakban: „Ingatlan”):`,
  );
  sections.push(
    `  – természetbeni cím: ${c.property.iranyitoszam || "[ir.sz.]"} ${c.property.telepules || "[település]"}, ${c.property.cim || "[utca, hsz.]"};`,
  );
  sections.push(`  – helyrajzi szám: ${c.property.helyrajziSzam || "[hrsz.]"};`);
  sections.push(`  – művelési ág / megnevezés: ${c.property.ingatlanTipus || "[típus]"}${c.property.muvelesiAg ? ` / ${c.property.muvelesiAg}` : ""};`);
  sections.push(`  – alapterület: ${c.property.alapterulet || "[m²]"} m²;`);
  sections.push(`  – eladói tulajdoni hányad: ${c.property.tulajdoniHanyad || "1/1"}.`);
  if (c.property.tarsashaziAlbetet)
    sections.push("2.2. Az Ingatlan társasházi külön tulajdonú albetét; a közös tulajdoni hányadra a társasházi alapító okirat irányadó.");
  if (c.property.teremgarazsTarolo)
    sections.push("2.3. Az adásvételhez kapcsolódóan teremgarázs- és/vagy tárolóhasználat is átszáll a Vevőre, melynek pontos megnevezését a tulajdoni lap tartalmazza.");
  if (c.property.energetikaiTanusitvany)
    sections.push(
      `2.4. Az Ingatlanra a 176/2008. (VI. 30.) Korm. rendelet szerinti energetikai tanúsítvány (HET-szám: ${c.property.energetikaiTanusitvany}) kiállításra került; az Eladó a tanúsítvány egy példányát a jelen szerződés aláírásával egyidejűleg a Vevőnek átadja, melyet a Vevő külön nyilatkozattal igazol.`,
    );
  else
    sections.push(
      "2.4. Felek rögzítik, hogy a 176/2008. (VI. 30.) Korm. rendelet szerinti energetikai tanúsítvány kiállítása és Vevő részére történő átadása az Eladó kötelezettsége, mely a birtokbaadásig teljesítendő. (Ügyvédi ellenőrzés szükséges.)",
    );
  sections.push("");

  // 3. Tulajdoni és teherviszonyok
  sections.push("3. TULAJDONI ÉS TEHERVISZONYOK");
  sections.push("");
  sections.push(
    "3.1. Eladó kijelenti, hogy az Ingatlan a kizárólagos tulajdonát képezi a 2.1. pontban megjelölt tulajdoni hányad szerint, és tulajdonjogát az ingatlan-nyilvántartásba bejegyezték.",
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
    sections.push(
      "3.2. Eladó szavatolja, hogy az Ingatlan per-, teher- és igénymentes, harmadik személynek nincs olyan joga vagy követelése, amely a Vevő tulajdonszerzését korlátozná vagy a használatot akadályozná. (A nyilatkozat valóságtartalma a hiteles tulajdoni lap alapján ügyvédileg ellenőrzendő.)",
    );
  } else {
    sections.push(`3.2. Az Ingatlanon az alábbi jogok/terhek állnak fenn: ${enc.join("; ")}.`);
    if (c.property.tehermentesitesiTerv)
      sections.push(`3.3. Tehermentesítési terv: ${c.property.tehermentesitesiTerv}`);
    else
      sections.push("3.3. Felek megállapodnak abban, hogy a fenti terhek tehermentesítésének részletes rendjét — ideértve a kiváltáshoz szükséges összeg, határidő és letéti feltételek meghatározását — külön pontban rögzítik. (Ügyvédi kidolgozás szükséges.)");
  }
  sections.push(
    "3.4. Eladó kijelenti, hogy az Ingatlannal kapcsolatban közüzemi-, közös költség- vagy adótartozása nem áll fenn; a társasházi közös költség tartozásmentességet az Eladó a társasház közös képviselőjének tartozásmentességi igazolásával köteles a birtokbaadás napjáig igazolni.",
  );
  sections.push(
    "3.5. Eladó kijelenti továbbá, hogy az Ingatlanra vonatkozóan nincs folyamatban olyan hatósági, peres vagy nemperes eljárás, amely a Vevő tulajdonszerzését érintené.",
  );
  sections.push("");

  // 4. Vételár és fizetés
  sections.push("4. VÉTELÁR ÉS FIZETÉSI FELTÉTELEK");
  sections.push("");
  sections.push(
    `4.1. Felek az Ingatlan kölcsönösen elfogadott vételárát ${fmt(c.payment.teljesVetelar, ccy)} összegben határozzák meg (a továbbiakban: „Vételár”). A Vételár az ÁFA-t — a hatályos szabályok szerinti besorolás alapján — tartalmazza / nem tartalmazza; az áfa-kezelés tárgyában ügyvédi és — szükség szerint — adótanácsadói egyeztetés szükséges.`,
  );
  if (c.payment.foglaloVan)
    sections.push(
      `4.2. Foglaló: a Vevő a Vételár részeként a jelen szerződés aláírásával egyidejűleg ${fmt(c.payment.foglaloOsszeg, ccy)} foglalót fizet meg az Eladó részére. Felek rögzítik, hogy a foglalóra a Polgári Törvénykönyvről szóló 2013. évi V. törvény (Ptk.) 6:185. §-ában foglalt rendelkezések irányadók: ha a szerződés teljesítése olyan okból hiúsul meg, amelyért egyik fél sem felelős, a foglaló visszajár; ha a teljesítés meghiúsulásáért a foglalót adó Vevő felelős, az adott foglalót elveszti, ha az Eladó felelős, a kapott foglalót kétszeresen köteles visszafizetni.`,
    );
  if (c.payment.elolegVan)
    sections.push(
      "4.3. Előleg: a Vevő a Vételár terhére előleget fizet, amely meghiúsulás esetén — eltérő megállapodás hiányában — visszajár.",
    );
  if (c.payment.onero)
    sections.push(`4.4. Önerő: ${fmt(c.payment.onero, ccy)}, melyet a Vevő saját forrásból teljesít.`);
  if (c.payment.bankhitelVan) {
    sections.push(
      `4.5. Banki hitel: a Vevő a Vételár ${fmt(c.payment.hitelOsszeg, ccy)} összegű részét a ${c.payment.bankNeve || "[bank megnevezése]"} által nyújtott jelzáloghitelből kívánja teljesíteni. A hitel folyósításának várható határideje: ${c.payment.hitelFolyositasHatarido || "[határidő]"}.`,
    );
    sections.push(
      "4.6. A banki hitel folyósításához szükséges, hogy az Eladó tulajdonjogának fennállása mellett a Vevő javára szóló tulajdonjog-bejegyzési kérelem az ingatlan-nyilvántartásba — függőben tartással — benyújtásra kerüljön (Inytv. 47/A. §). Az Eladó vállalja, hogy a banki finanszírozás folyósításához szükséges nyilatkozatokat haladéktalanul megteszi és a finanszírozó bank javára szóló jelzálogjog, valamint elidegenítési és terhelési tilalom bejegyzéséhez hozzájárul; a vonatkozó terheket a hitel kiváltását követően a Vevő bejegyzési engedélyt szerez és intézkedik törlésük iránt.",
    );
  }
  if (c.payment.ugyvediLetet)
    sections.push(
      "4.7. Ügyvédi letét: Felek a Vételár meghatározott részét az eljáró ügyvédnél kezelt ügyvédi letétbe helyezik az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.) 47–53. §-ai szerint; a letét pontos feltételeit (összeg, kifizetési feltételek, kamatozás, költségek) külön ügyvédi letéti szerződés rögzíti, mely a jelen szerződés elválaszthatatlan részét képezi.",
    );
  if (c.payment.reszletfizetes && c.payment.fizetesiUtemezes)
    sections.push(`4.8. Részletfizetési ütemezés: ${c.payment.fizetesiUtemezes}`);
  if (c.payment.meglevoTeherKivaltas)
    sections.push(
      `4.9. Meglévő terhek kiváltása: ${c.payment.tehermentesitesModja || "Az Eladó terhére fennálló jelzáloghitel kiváltása a Vételár meghatározott részéből, közvetlenül a hitelező pénzügyi intézmény részére történő átutalással történik, törlési engedély egyidejű kiadása mellett."}.`,
    );
  if (c.payment.utalasiSzamlaszam)
    sections.push(`4.10. A Vevő a Vételár átutalással teljesítendő részét az alábbi számlaszámra fizeti meg: ${c.payment.utalasiSzamlaszam}.`);
  sections.push(
    "4.11. A pénzügyi teljesítés akkor minősül megtörténtnek, amikor a Vételár megfelelő része az Eladó (illetve a hitelező / letéteményes) számláján maradéktalanul jóváírásra került.",
  );
  sections.push(
    "4.12. Késedelem esetén a Polgári Törvénykönyv szerinti törvényes késedelmi kamat jár.",
  );
  sections.push("");

  // 5. Birtokbaadás és kárveszély
  sections.push("5. BIRTOKBAADÁS, KÁRVESZÉLY-ÁTSZÁLLÁS");
  sections.push("");
  sections.push(
    `5.1. Az Ingatlant az Eladó a teljes Vételár hiánytalan megfizetésével egyidejűleg, ${c.possession.datum ? "legkésőbb " + c.possession.datum + " napján" : "[birtokbaadás napja]"} adja a Vevő birtokába.`,
  );
  if (c.possession.feltetel)
    sections.push(`5.2. Birtokbaadás feltétele: ${c.possession.feltetel}.`);
  if (c.possession.kozmuAtiras)
    sections.push("5.3. A közüzemi mérőórák (víz, gáz, villany, fűtés) állását a Felek a birtokbaadás napján közös jegyzőkönyvben rögzítik; az átírást a Vevő intézi, az átírás napjáig keletkezett közüzemi díjak az Eladót terhelik.");
  if (c.possession.kulcsAtadas)
    sections.push("5.4. A kulcsok, a beléptető kódok és a kapcsolódó dokumentumok átadása a birtokbaadás napján, jegyzőkönyvben rögzítetten történik.");
  if (c.possession.eladoKikoltozes)
    sections.push(`5.5. Az Eladó kiköltözési kötelezettsége: ${c.possession.eladoKikoltozes}.`);
  if (c.possession.ingosagokMaradnak)
    sections.push(`5.6. Az Ingatlanban maradó ingóságok a Vételár részét képezik; jegyzéküket az átadás-átvételi jegyzőkönyv tartalmazza: ${c.possession.ingosagokListaja || "[ingóságok jegyzéke]"}.`);
  if (c.possession.kotberKesedelem)
    sections.push(
      `5.7. A birtokbaadási kötelezettség késedelmes teljesítése esetén az Eladó a Vevő részére ${fmt(c.possession.kotberOsszeg, ccy)} összegű kötbér megfizetésére köteles a Ptk. 6:186–6:189. §-ai szerint.`,
    );
  sections.push(
    "5.8. Az Ingatlanra vonatkozó kárveszély a birtokbaadás napján száll át az Eladóról a Vevőre. Ezen időponttól terhelik a Vevőt az Ingatlannal kapcsolatos közterhek, díjak és költségek (Ptk. 6:219. §).",
  );
  sections.push(
    "5.9. Az Eladó köteles az Ingatlant a birtokbaadáskor üres, kiürített, rendeltetésszerű használatra alkalmas állapotban átadni.",
  );
  sections.push("");

  // 6. Tulajdonjog átszállás, bejegyzési engedély
  sections.push("6. TULAJDONJOG-ÁTSZÁLLÁS ÉS INGATLAN-NYILVÁNTARTÁSI BEJEGYZÉS");
  sections.push("");
  sections.push(
    "6.1. Felek megállapodnak abban, hogy az Eladó a Vevő tulajdonjog-bejegyzéséhez szükséges, feltétel nélküli és visszavonhatatlan bejegyzési engedélyt (Inytv. 29. § és 32. §) a teljes Vételár hiánytalan megfizetésével egyidejűleg, külön okiratban adja ki, melyet az eljáró ügyvéd ügyvédi letétben kezel az Üttv. szerint.",
  );
  sections.push(
    "6.2. A bejegyzési engedély letétben tartása alatt a Felek kérik a tulajdonjog Vevő javára történő bejegyzésének függőben tartását az ingatlan-nyilvántartási kérelem benyújtásától számítva legfeljebb 6 hónapig (Inytv. 47/A. §). A Vevő tulajdonszerzésének jogcíme: vétel.",
  );
  sections.push(
    "6.3. Az ingatlan-nyilvántartási eljárás megindítása (földhivatali kérelem benyújtása) az eljáró ügyvéd feladata; ehhez a Felek minden szükséges adatot, okiratot és nyilatkozatot határidőben rendelkezésre bocsátanak.",
  );
  sections.push("");

  // 7. Szavatosság, nyilatkozatok
  sections.push("7. SZAVATOSSÁG, JOG- ÉS KELLÉKSZAVATOSSÁG, FELELŐSSÉG");
  sections.push("");
  sections.push(
    "7.1. Az Eladó a Ptk. 6:170–6:177. §-ai szerinti kellék- és jogszavatossággal tartozik. Eladó szavatol különösen azért, hogy az Ingatlan a 3. pontban rögzítettek szerinti tulajdoni és teherviszonyokkal rendelkezik, és harmadik személynek nincs olyan joga, amely a tulajdonjog átszállását vagy a Vevő birtoklását, használatát akadályozná.",
  );
  sections.push(
    "7.2. Az Eladó az Ingatlan rejtett hibáiért a Ptk. szerint felel; a Vevő az Ingatlant a szerződés aláírása előtt megtekintette, annak adottságait, állapotát és a megtekintéssel felismerhető hibákat ismeri, ezek tekintetében a jogszabály erejénél fogva szavatossági igényt nem érvényesít.",
  );
  sections.push(
    "7.3. Felek kölcsönösen kijelentik, hogy a jelen szerződést annak átolvasása és értelmezése után, mint akaratukkal mindenben megegyezőt írják alá.",
  );
  sections.push("");

  // 8. Költségek és adózás
  sections.push("8. KÖLTSÉGEK, ADÓK, ILLETÉK, BEJELENTÉSI KÖTELEZETTSÉG");
  sections.push("");
  sections.push(
    "8.1. A visszterhes vagyonátruházási illeték az illetékekről szóló 1990. évi XCIII. törvény (Itv.) szerint a Vevőt terheli. Az illeték kiszabását a Nemzeti Adó- és Vámhivatal (NAV) végzi a B400 jelű adatlap alapján. A B400 adatlap kitöltése és benyújtása az eljáró ügyvéd közreműködésével az adózás rendjéről szóló 2017. évi CL. törvény (Art.) szerint az ingatlan-nyilvántartási kérelem földhivatalhoz történő benyújtásával egyidejűleg történik (a földhivatal továbbítja a NAV felé).",
  );
  sections.push(
    "8.2. Az Eladót terhelő, a vételárból befolyó jövedelem után fennálló esetleges személyi jövedelemadó (Szja-tv. 62. §) megfizetése az Eladó kötelezettsége; az Eladó a vonatkozó kedvezményeket és számított adót a saját éves bevallásában érvényesíti.",
  );
  sections.push(
    "8.3. Az ügyvédi munkadíj a Felek külön megállapodása szerint kerül megfizetésre; eltérő megállapodás hiányában az ügyvédi munkadíj és a kapcsolódó eljárási költségek (földhivatali igazgatási szolgáltatási díj, tulajdoni lap, térképmásolat) a Vevőt terhelik.",
  );
  sections.push("");

  // 9. Pmt., GDPR, ügyvédi nyilatkozat
  sections.push("9. ÜGYFÉL-ÁTVILÁGÍTÁS (PMT.) ÉS ADATKEZELÉS (GDPR)");
  sections.push("");
  sections.push(
    "9.1. Az eljáró ügyvéd a pénzmosás és a terrorizmus finanszírozása megelőzéséről és megakadályozásáról szóló 2017. évi LIII. törvény (Pmt.) alapján a Feleket átvilágította; a Felek a Pmt. szerinti azonosító adataikat hiánytalanul megadták, a tényleges tulajdonosi nyilatkozatot megtették, és nyilatkoztak arról, hogy kiemelt közszereplőnek minősülnek-e (Pmt. 9. §).",
  );
  sections.push(
    "9.2. Felek tudomásul veszik, hogy az eljáró ügyvéd a Pmt., az Üttv. és az ingatlan-nyilvántartási jogszabályok szerint köteles a személyes adataikat és a vonatkozó okiratokat kezelni és — a jogszabályban meghatározott ideig — megőrizni. Az adatkezelés jogalapja a GDPR (EU) 2016/679 rendelet 6. cikk (1) bekezdés c) pontja (jogi kötelezettség teljesítése) és b) pontja (szerződés teljesítése).",
  );
  sections.push(
    "9.3. Felek nyilatkoznak, hogy az ügyvéd adatkezelési tájékoztatóját megismerték és elfogadták.",
  );
  sections.push("");

  // 10. Speciális — kiskorú
  let nextNo = 10;
  if (minors.length > 0) {
    sections.push(`${nextNo}. KISKORÚ / KORLÁTOZOTT CSELEKVŐKÉPESSÉG SPECIÁLIS RENDELKEZÉSEI`);
    sections.push("");
    sections.push(
      "  A kiskorú fél(ek) érintettsége miatt a szerződés hatálybalépésének feltétele az illetékes gyámhatóság jóváhagyó határozatának jogerőre emelkedése. A jóváhagyás megadásáig a Felek jogai és kötelezettségei felfüggesztett hatállyal állnak fenn. Amennyiben a gyámhatóság a jóváhagyást megtagadja, a szerződés érvénytelennek minősül és a Felek az addig teljesített szolgáltatásokat egymásnak visszaszolgáltatják.",
    );
    sections.push("");
    nextNo++;
  }

  // 11. Termőföld
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  if (agri) {
    sections.push(`${nextNo}. FÖLDFORGALMI RENDELKEZÉSEK (TERMŐFÖLD / MEZŐGAZDASÁGI INGATLAN)`);
    sections.push("");
    sections.push(
      "  Felek tudomásul veszik, hogy a mező- és erdőgazdasági földek forgalmáról szóló 2013. évi CXXII. törvény (Földforgalmi tv.) rendelkezéseit alkalmazni kell: a szerződést a települési önkormányzat jegyzőjénél kifüggesztésre kell benyújtani az elővásárlási jogosultak nyilatkoztatása céljából; a szerződés hatálybalépésének feltétele a mezőgazdasági igazgatási szerv jóváhagyó határozatának jogerőre emelkedése. A Vevő szerzőképességét nyilatkozat útján igazolja.",
    );
    sections.push("");
    nextNo++;
  }

  // 12. Társasházi
  if (c.property.tarsashaziAlbetet) {
    sections.push(`${nextNo}. TÁRSASHÁZI SPECIÁLIS RENDELKEZÉSEK`);
    sections.push("");
    sections.push(
      "  Az Eladó kötelezettséget vállal arra, hogy a társasházi alapító okiratot, a szervezeti és működési szabályzatot (SZMSZ), valamint az utolsó éves közgyűlési határozatok jegyzékét a Vevő részére átadja, továbbá a társasház közös képviselőjétől beszerzi és átadja a közös költség tartozásmentességéről szóló igazolást. A társasházi közös tulajdonra vonatkozó elővásárlási jogot a társasházakról szóló 2003. évi CXXXIII. törvény szerint az Eladó nyilatkozattal kezeli.",
    );
    sections.push("");
    nextNo++;
  }

  // 13. Külföldi vevő
  const kulfoldiVevo = vevok.some(
    (v) => v.kind === "termeszetes" && v.allampolgarsag && !/magyar/i.test(v.allampolgarsag),
  );
  if (kulfoldiVevo) {
    sections.push(`${nextNo}. KÜLFÖLDI SZERZŐ INGATLANSZERZÉSI ENGEDÉLYE`);
    sections.push("");
    sections.push(
      "  Tekintettel arra, hogy a Vevő külföldi (nem magyar állampolgárságú) természetes személy, a termőföldnek nem minősülő ingatlan szerzéséhez — a 251/2014. (X. 2.) Korm. rendelet alapján — a Budapest Főváros Kormányhivatala (illetve az illetékes fővárosi/megyei kormányhivatal) engedélye szükséges. A szerződés hatálybalépésének feltétele az engedély jogerőre emelkedése. (EGT-állampolgárra a mentesség külön vizsgálandó.)",
    );
    sections.push("");
    nextNo++;
  }

  // 14. Elállás, meghiúsulás
  sections.push(`${nextNo}. ELÁLLÁS, A SZERZŐDÉS MEGHIÚSULÁSA`);
  sections.push("");
  sections.push(
    "  A Felek bármelyikének súlyos szerződésszegése esetén a sérelmet szenvedett Fél a másik Félhez intézett egyoldalú írásbeli nyilatkozattal a szerződéstől elállhat. Súlyos szerződésszegésnek minősül különösen a Vételár fizetési határidőtől számított 30 napot meghaladó késedelme, vagy az Eladó birtokbaadási kötelezettségének hasonló késedelme. Elállás esetén a Felek az addig teljesített szolgáltatásokat egymásnak visszaszolgáltatják, és a foglalóra a Ptk. szerinti szabályok irányadók.",
  );
  sections.push("");
  nextNo++;

  // 15. Vitarendezés, alkalmazandó jog
  sections.push(`${nextNo}. ALKALMAZANDÓ JOG ÉS VITARENDEZÉS`);
  sections.push("");
  sections.push(
    "  A jelen szerződésre a magyar jog az irányadó. A jelen szerződésből eredő jogvitákat a Felek elsősorban békés úton kísérlik meg rendezni; ennek eredménytelensége esetén kikötik a Polgári perrendtartásról szóló 2016. évi CXXX. törvény szerint hatáskörrel és illetékességgel rendelkező bíróság kizárólagos illetékességét.",
  );
  sections.push("");
  nextNo++;

  // 16. Ügyvédi ellenjegyzés tájékoztató
  sections.push(`${nextNo}. ÜGYVÉDI KÖZREMŰKÖDÉS ÉS ELLENJEGYZÉS`);
  sections.push("");
  sections.push(
    `  ${nextNo}.1. A jelen szerződést ${c.eljaroUgyved.nev || "[eljáró ügyvéd neve]"} (${c.eljaroUgyved.iroda || "[ügyvédi iroda]"}, ${c.eljaroUgyved.irodaCim || "[iroda címe]"}; KASZ: ${c.eljaroUgyved.kaszSzam || "[KASZ szám]"}) eljáró ügyvéd készítette és ellenjegyzi az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.) 43. §-a és az ingatlan-nyilvántartásról szóló 1997. évi CXLI. törvény (Inytv.) 32. § (3) bekezdése alapján.`,
  );
  sections.push(
    `  ${nextNo}.2. A jelen szerződés — az ügyvédi ellenjegyzés folytán — ügyvéd által ellenjegyzett magánokiratnak minősül, amely a Pp. 325. § (1) bek. g) pontja szerint teljes bizonyító erővel rendelkezik. Erre tekintettel a szerződés érvényességéhez tanúk közreműködése nem szükséges.`,
  );
  sections.push(
    `  ${nextNo}.3. Az eljáró ügyvéd a Felek személyazonosságát az okmányaik alapján ellenőrizte, a JÜB-rendszerben lekérdezte (az eredményt az ügyiratban dokumentálta), és a jognyilatkozatok tartalmáról a Feleket tájékoztatta. A Felek elismerik, hogy az ügyvéd jelen jogügyletben kizárólag okiratszerkesztőként és ellenjegyzőként jár el, közreműködését bármelyik Fél részéről történő képviseletként nem értelmezik.`,
  );
  sections.push("");
  nextNo++;

  // 17. Záró
  sections.push(`${nextNo}. ZÁRÓ RENDELKEZÉSEK`);
  sections.push("");
  sections.push(
    `  ${nextNo}.1. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény (Ptk.), az ingatlan-nyilvántartásról szóló 1997. évi CXLI. törvény (Inytv.), az ügyvédi tevékenységről szóló 2017. évi LXXVIII. törvény (Üttv.), az illetékekről szóló 1990. évi XCIII. törvény (Itv.), valamint a vonatkozó egyéb magyar jogszabályok rendelkezései az irányadók.`,
  );
  sections.push(
    `  ${nextNo}.2. A szerződés bármely rendelkezésének esetleges érvénytelensége a többi rendelkezés érvényességét nem érinti, feltéve, hogy a felek a szerződést az érvénytelen rész nélkül is megkötötték volna.`,
  );
  sections.push(
    `  ${nextNo}.3. A jelen szerződés módosítása kizárólag írásban, valamennyi Fél egyező akaratnyilatkozatával, ügyvédi ellenjegyzéssel érvényes.`,
  );
  sections.push(
    `  ${nextNo}.4. A jelen szerződés ${(eladok.length + vevok.length + 3)} (azaz ${(eladok.length + vevok.length + 3)}) egymással mindenben megegyező eredeti példányban készült, amelyből minden Fél egy-egy példányt kap, kettő példány a földhivatali eljárás céljára szolgál, egy példány az eljáró ügyvédnél marad.`,
  );
  sections.push("");

  // 18. Mellékletek
  sections.push(`${nextNo + 1}. MELLÉKLETEK`);
  sections.push("");
  generateAttachmentList(c).forEach((a, i) =>
    sections.push(`  ${i + 1}. ${a.cim}${a.kotelezo ? " (kötelező)" : " (ajánlott)"} — ${a.indok}`),
  );
  sections.push("");

  // Signatures
  sections.push("ALÁÍRÁSOK");
  sections.push("");
  sections.push(`Kelt: ${c.property.telepules || "[hely]"}, ${new Date().toLocaleDateString("hu-HU")}`);
  sections.push("");
  sections.push("  Eladó(k):");
  eladok.forEach((p) =>
    sections.push(`    ____________________________________   (${p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]"})`),
  );
  sections.push("");
  sections.push("  Vevő(k):");
  vevok.forEach((p) =>
    sections.push(`    ____________________________________   (${p.kind === "termeszetes" ? p.nev || "[név]" : p.cegnev || "[cégnév]"})`),
  );
  sections.push("");
  sections.push("ÜGYVÉDI ELLENJEGYZÉS");
  sections.push("(2017. évi LXXVIII. tv. — Üttv. 43. § alapján — teljes bizonyító erejű magánokirat, tanúk nem szükségesek)");
  sections.push("");
  sections.push(`  Készítettem és ellenjegyzem:`);
  sections.push(`    Eljáró ügyvéd: ${c.eljaroUgyved.nev || "____________________________"}`);
  sections.push(`    KASZ szám: ${c.eljaroUgyved.kaszSzam || "________________________"}`);
  sections.push(`    Iroda: ${c.eljaroUgyved.iroda || "____________________________________"}`);
  sections.push(`    Iroda címe: ${c.eljaroUgyved.irodaCim || "____________________________________"}`);
  sections.push(`    Kelt: ____________   Hely: ${c.property.telepules || "____________"}`);
  sections.push("    P.H. és aláírás: __________________________");
  sections.push("");
  sections.push(
    "— TERVEZET vége. Ügyvédi felülvizsgálat és ellenjegyzés nélkül nem használható. —",
  );

  return sections.join("\n");
}
