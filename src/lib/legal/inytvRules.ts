import type { CaseFile } from "./types";

export const MANDATORY_INYTV_AUDIT_TERMS = [
  "2021. évi C. törvény",
  "179/2023. (V. 15.) Korm. r.",
  "E-ING",
  "bejegyzési engedély",
  "helyrajzi szám",
  "tulajdoni hányad",
  "mellékletek",
] as const;

function propertySummary(c: CaseFile): string {
  return [
    c.property.telepules || "[település]",
    c.property.helyrajziSzam ? `hrsz.: ${c.property.helyrajziSzam}` : "hrsz.: [helyrajzi szám]",
    c.property.tulajdoniHanyad
      ? `tulajdoni hányad: ${c.property.tulajdoniHanyad}`
      : "tulajdoni hányad: [tulajdoni hányad]",
  ].join("; ");
}

export function generateMandatoryInytvClauses(c: CaseFile, legalReviewMarker: string): string[] {
  const delayedOwnership =
    c.payment.bankhitelVan ||
    c.payment.reszletfizetes ||
    c.payment.ugyvediLetet ||
    c.transactionTypes.includes("hitellel_erintett");

  return [
    `Az új Inytv. és vhr. kötelező alkalmazási kontrollja alapján Felek rögzítik, hogy a bejegyzési eljárás alapjául szolgáló ingatlanadatoknak — különösen a helyrajzi számnak, a természetbeni címnek, a jogcímnek és a tulajdoni hányadnak — egyezniük kell az aktuális tulajdoni lap és az E-ING eljárásban rögzített adatok tartalmával. Ellenőrzött ingatlanadatok jelen tervezetben: ${propertySummary(c)}. ${legalReviewMarker}`,
    "Az eljáró ügyvéd az E-ING felületen történő benyújtás előtt külön ellenőrzi az új Inytv. (2021. évi C. törvény) és a 179/2023. (V. 15.) Korm. r. szerinti kötelező mellékleteket, a bejegyzési engedély rendelkezésre állását, az okirati példányok és elektronikus űrlapadatok összhangját, valamint az esetleges hiánypótlási kockázatokat.",
    delayedOwnership
      ? "Tekintettel arra, hogy a tulajdonjog bejegyzése a Vételár teljes megfizetéséhez, banki finanszírozáshoz vagy más teljesítési feltételhez kapcsolódik, az eljáró ügyvéd külön vizsgálja, hogy a tulajdonjog-fenntartáshoz kapcsolódó vevői jog, a bejegyzési engedély kezelése és a ranghelyi sorrend az új Inytv. és vhr. alapján megfelelően került-e előkészítésre."
      : "Amennyiben a Felek a tulajdonjog bejegyzését bármely teljesítési feltételhez kötik, az eljáró ügyvéd külön vizsgálja, hogy szükséges-e tulajdonjog-fenntartáshoz kapcsolódó vevői jog, külön bejegyzési engedély-kezelés vagy ranghelyi rendelkezés az új Inytv. és vhr. alapján.",
  ];
}
