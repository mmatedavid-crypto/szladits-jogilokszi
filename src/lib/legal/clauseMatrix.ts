import { determineCapacityStatus, isMinor } from "./logic";
import type { CaseFile, NaturalPerson } from "./types";

export type LawRefVerificationStatus = "ai_prelinked_pending_lawyer_review";

export interface LawRef {
  act: string;
  shortName: string;
  section: string;
  label: string;
  source: "NJT";
  sourceUrl: string;
  checkedAt: string;
  effectiveDateBasis: string;
  verificationStatus: LawRefVerificationStatus;
}

export type ClauseReviewStatus =
  | "ai_prelinked"
  | "lawyer_approved"
  | "lawyer_needs_modification"
  | "lawyer_rejected"
  | "blocked_missing_data";
export type ClauseRiskLevel = "alap" | "kozepes" | "magas" | "kritikus";

export interface ClausePairing {
  id: string;
  cim: string;
  leiras: string;
  triggerLeiras: string;
  reviewStatus: ClauseReviewStatus;
  riskLevel: ClauseRiskLevel;
  lawRef: LawRef;
  relatedLawRefs?: LawRef[];
  activeWhen: (c: CaseFile) => boolean;
  auditTerms: string[];
  ugyvediKerdesek: string[];
}

const CHECKED_AT = "2026-06-06";
const LAWYER_REVIEW_REQUIRED = "ügyvédi validáció szükséges";
const AI_PRELINKED_PENDING_REVIEW: LawRefVerificationStatus = "ai_prelinked_pending_lawyer_review";

const NJT = {
  ptk: "https://njt.hu/jogszabaly/2013-5-00-00.33",
  inytv: "https://njt.hu/jogszabaly/1997-141-00-00.34",
  uttv43: "https://njt.hu/jogszabaly/2017-78-00-00.19",
  uttv: "https://njt.hu/jogszabaly/2017-78-00-00.28",
  pmt: "https://njt.hu/jogszabaly/2017-53-00-00.1",
  itv: "https://njt.hu/jogszabaly/1990-93-00-00",
  foldforgalmi: "https://njt.hu/jogszabaly/2013-212-00-00.39",
  biztonsagiOkmany: "https://njt.hu/jogszabaly/2014-47-20-22",
  kulfoldiIngatlan: "https://njt.hu/jogszabaly/2014-251-20-22",
  pp: "https://njt.hu/jogszabaly/2016-130-00-00.17",
  energetikai: "https://njt.hu/jogszabaly/2008-176-20-22",
  tarsashaz: "https://njt.hu/jogszabaly/2003-133-00-00",
} as const;

const lawRef = (
  act: string,
  shortName: string,
  section: string,
  label: string,
  sourceUrl: string,
): LawRef => ({
  act,
  shortName,
  section,
  label,
  source: "NJT",
  sourceUrl,
  checkedAt: CHECKED_AT,
  effectiveDateBasis: LAWYER_REVIEW_REQUIRED,
  verificationStatus: AI_PRELINKED_PENDING_REVIEW,
});

const hasCapacityIssue = (c: CaseFile) =>
  c.parties.some((p): p is NaturalPerson => {
    if (p.kind !== "termeszetes") return false;
    const status = determineCapacityStatus(p);
    return (
      isMinor(p) ||
      status === "nagykoru_korlatozott" ||
      status === "cselekvokeptelen_nagykoru" ||
      status === "gondnokkal" ||
      status === "ellenorzes_szukseges"
    );
  });

const isResidentialProperty = (c: CaseFile) => {
  if (
    c.transactionTypes.some((type) =>
      ["lakas", "csaladi_haz", "tarsashazi_albetet"].includes(type),
    )
  ) {
    return true;
  }
  const propertyText = `${c.property.ingatlanTipus} ${c.property.cim}`.toLowerCase();
  return (
    c.property.tarsashaziAlbetet ||
    propertyText.includes("lakás") ||
    propertyText.includes("ház") ||
    propertyText.includes("családi")
  );
};

const hasForeignBuyer = (c: CaseFile) =>
  c.parties.some(
    (p) =>
      p.szerep === "vevo" &&
      ((p.kind === "termeszetes" &&
        p.allampolgarsag.trim() &&
        p.allampolgarsag.trim().toLowerCase() !== "magyar") ||
        (p.kind === "ceg" && p.kulfoldiSzekhely)),
  );

const hasCompanyParty = (c: CaseFile) => c.parties.some((p) => p.kind === "ceg");

const isAgri = (c: CaseFile) =>
  c.transactionTypes.includes("termofold") ||
  c.transactionTypes.includes("tanya") ||
  (c.transactionTypes.includes("zartkert") && c.special.zartkertStatus === "mezogazdasagi");

export const CLAUSE_PAIRINGS: ClausePairing[] = [
  {
    id: "draft-safeguard",
    cim: "Tervezet jelleg és ügyvédi felelősségi keret",
    leiras:
      "A dokumentum nem végleges szerződésként, hanem ügyvédi ellenőrzésre és ellenjegyzésre váró tervezetként jelenik meg.",
    triggerLeiras: "Minden generált okiratnál kötelező.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "2017. évi LXXVIII. törvény",
      "Üttv.",
      "43. §",
      "Ügyvédi ellenjegyzés",
      NJT.uttv43,
    ),
    relatedLawRefs: [
      lawRef(
        "2016. évi CXXX. törvény",
        "Pp.",
        "325. §",
        "Teljes bizonyító erejű magánokirat",
        NJT.pp,
      ),
    ],
    activeWhen: () => true,
    auditTerms: ["TERVEZET", "ügyvédi ellenőrzés", "ÜGYVÉDI ELLENJEGYZÉS"],
    ugyvediKerdesek: [
      "Elég egyértelmű-e, hogy a dokumentum ügyvédi jóváhagyás nélkül nem használható?",
      "Az ellenjegyzési blokk megfelel-e az iroda saját okirati gyakorlatának?",
    ],
  },
  {
    id: "parties-identification",
    cim: "Felek azonosítása és Pmt. átvilágítás",
    leiras:
      "A felek személyes vagy céges azonosító adatai, Pmt. átvilágítása és tényleges tulajdonosi nyilatkozatai.",
    triggerLeiras: "Minden ügyben aktív; céges félnél fokozottan ellenőrzendő.",
    reviewStatus: "ai_prelinked",
    riskLevel: "magas",
    lawRef: lawRef(
      "2017. évi LIII. törvény",
      "Pmt.",
      "ügyfél-átvilágítási szabályok",
      "Ügyfél-átvilágítás",
      NJT.pmt,
    ),
    relatedLawRefs: [
      lawRef(
        "2017. évi LXXVIII. törvény",
        "Üttv.",
        "okiratszerkesztési és ellenjegyzési kapcsolódás",
        "Ügyvédi közreműködés",
        NJT.uttv,
      ),
    ],
    activeWhen: () => true,
    auditTerms: ["Pmt.", "ügyfél-átvilágítás", "tényleges tulajdonosi nyilatkozat"],
    ugyvediKerdesek: [
      "Mely Pmt. nyilatkozatok legyenek külön dokumentumban és melyek maradjanak a szerződésben?",
      "Céges fél esetén elég részletes-e a tényleges tulajdonosi és képviseleti adatbekérés?",
    ],
  },
  {
    id: "property-subject",
    cim: "Ingatlan azonosítása",
    leiras:
      "Az ingatlan természetbeni címe, helyrajzi száma, tulajdoni hányada, művelési ága és társasházi státusza.",
    triggerLeiras: "Minden ingatlan-adásvételi ügyben aktív.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "1997. évi CXLI. törvény",
      "Inytv.",
      "okirati kellékek és bejegyzési alap",
      "Ingatlan azonosítása",
      NJT.inytv,
    ),
    activeWhen: () => true,
    auditTerms: ["helyrajzi szám", "tulajdoni hányad", "Ingatlan"],
    ugyvediKerdesek: [
      "A tulajdoni lap I-II-III. része alapján minden lényeges adat átjött-e?",
      "Társasházi albetétnél kell-e külön közös tulajdoni hányad / garázs / tároló klauzula?",
    ],
  },
  {
    id: "encumbrances",
    cim: "Terhek és tehermentesítés",
    leiras:
      "Jelzálog, végrehajtás, haszonélvezet, elidegenítési tilalom, elővásárlási jog vagy egyéb teher kezelése.",
    triggerLeiras: "Akkor aktív, ha bármely teher mező jelölt vagy szövegesen kitöltött.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "1997. évi CXLI. törvény",
      "Inytv.",
      "jogok és tények bejegyzése/törlése",
      "Terhek és tehermentesítés",
      NJT.inytv,
    ),
    relatedLawRefs: [
      lawRef(
        "2013. évi V. törvény",
        "Ptk.",
        "jogszavatosság és szerződésszegési szabályok",
        "Jogszavatosság",
        NJT.ptk,
      ),
    ],
    activeWhen: (c) => {
      const e = c.property.encumbrances;
      return (
        e.jelzalog ||
        e.vegrehajtas ||
        e.haszonelvezet ||
        e.elidegenitesiTilalom ||
        e.elovasarlasiJog ||
        e.szolgalmiJog ||
        Boolean(e.egyeb.trim())
      );
    },
    auditTerms: ["tehermentesítés", "jogszavatosság"],
    ugyvediKerdesek: [
      "A teher törlésének feltételei elég konkrétak-e összeg, határidő és jogosulti nyilatkozat szerint?",
      "Haszonélvezet vagy elővásárlás esetén kell-e külön jogosulti nyilatkozat-minta?",
    ],
  },
  {
    id: "deposit",
    cim: "Foglaló",
    leiras: "Foglaló összege, beszámítása és meghiúsulási jogkövetkezményei.",
    triggerLeiras: "payment.foglaloVan === true",
    reviewStatus: "ai_prelinked",
    riskLevel: "magas",
    lawRef: lawRef("2013. évi V. törvény", "Ptk.", "6:185. §", "Foglaló", NJT.ptk),
    activeWhen: (c) => c.payment.foglaloVan,
    auditTerms: ["foglaló", "6:185. §"],
    ugyvediKerdesek: [
      "Foglaló vagy előleg legyen-e az adott összeg?",
      "Megfelelően kezeli-e a klauzula a bankhitel elutasításából eredő meghiúsulást?",
    ],
  },
  {
    id: "bank-loan-suspension",
    cim: "Bankhitel és tulajdonjog-fenntartás (vevői jog)",
    leiras:
      "Banki finanszírozás, bejegyzési engedély ügyvédi letétbe helyezése, Ptk. 6:216–6:217. § szerinti tulajdonjog-fenntartás és vevői jog bejegyzése az új Inytv. (2021. évi C. tv.) alapján.",
    triggerLeiras: "payment.bankhitelVan === true vagy hitellel érintett ügytípus.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef("2021. évi C. törvény", "új Inytv.", "vevői jog", "Tulajdonjog-fenntartáshoz kapcsolódó vevői jog", NJT.inytv),
    relatedLawRefs: [
      lawRef("2017. évi LXXVIII. törvény", "Üttv.", "ügyvédi letét", "Ügyvédi letét", NJT.uttv),
    ],
    activeWhen: (c) => c.payment.bankhitelVan || c.transactionTypes.includes("hitellel_erintett"),
    auditTerms: ["banki hitel", "tulajdonjog-fenntartás", "vevői jog"],
    ugyvediKerdesek: [
      "A banki folyósítási feltételek és a bejegyzési engedély kiadása összhangban vannak-e?",
      "Kell-e bank-specifikus klauzula az adott finanszírozó feltételeihez?",
    ],
  },
  {
    id: "possession",
    cim: "Birtokbaadás és kárveszély",
    leiras:
      "Birtokbaadás időpontja, közműóra átírás, kulcsátadás, kárveszély átszállása és késedelmi következmények.",
    triggerLeiras: "Minden ügyben aktív; kötbérnél külön Ptk. ellenőrzés.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kozepes",
    lawRef: lawRef("2013. évi V. törvény", "Ptk.", "6:219. §", "Kárveszély átszállása", NJT.ptk),
    relatedLawRefs: [lawRef("2013. évi V. törvény", "Ptk.", "6:186-6:189. §", "Kötbér", NJT.ptk)],
    activeWhen: () => true,
    auditTerms: ["birtokába", "kárveszély", "közüzemi"],
    ugyvediKerdesek: [
      "Birtokbaadás csak teljes vételár után történjen-e?",
      "Lakott vagy bérbeadott ingatlannál kell-e külön kiürítési/bérleti jogviszony klauzula?",
    ],
  },
  {
    id: "tax-b400",
    cim: "Illeték és B400",
    leiras: "Visszterhes vagyonátruházási illeték, B400 adatlap és NAV felé továbbítási folyamat.",
    triggerLeiras: "Minden visszterhes ingatlan-adásvételnél aktív.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kozepes",
    lawRef: lawRef(
      "1990. évi XCIII. törvény",
      "Itv.",
      "18-21. § és kedvezmények",
      "Visszterhes vagyonátruházási illeték",
      NJT.itv,
    ),
    activeWhen: () => true,
    auditTerms: ["Itv.", "B400", "visszterhes vagyonátruházási illeték"],
    ugyvediKerdesek: [
      "A vevő személyes helyzete alapján van-e illetékkedvezmény vagy mentesség?",
      "A B400 tervezetben a kedvezmény jogcíme és összege helyesen jelenik-e meg?",
    ],
  },
  {
    id: "minor-party",
    cim: "Kiskorú / korlátozott cselekvőképesség",
    leiras: "Törvényes képviselet, gyámhatósági jóváhagyás és felfüggesztett hatály kezelése.",
    triggerLeiras:
      "Ha bármely természetes személy fél 18 év alatti vagy cselekvőképességi státusza korlátozott.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "2013. évi V. törvény",
      "Ptk.",
      "2:15. § és kapcsolódó képviseleti szabályok",
      "Kiskorú fél képviselete",
      NJT.ptk,
    ),
    activeWhen: hasCapacityIssue,
    auditTerms: ["Törvényes képviselet", "gyámhatósági jóváhagyás", "felfüggesztett hatállyal"],
    ugyvediKerdesek: [
      "A konkrét ügylethez ténylegesen szükséges-e gyámhatósági jóváhagyás?",
      "A törvényes képviselő és az esetleges érdekellentét kezelése elég részletes-e?",
    ],
  },
  {
    id: "agricultural-land",
    cim: "Földforgalmi ügylet",
    leiras:
      "Termőföld, tanya vagy mezőgazdasági zártkert esetén elővásárlás, kifüggesztés, hatósági jóváhagyás és biztonsági okmány.",
    triggerLeiras: "termofold, tanya vagy mezőgazdasági zártkert ügytípus.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "2013. évi CXXII. törvény",
      "Földforgalmi tv.",
      "elővásárlás, jóváhagyás, korlátok",
      "Földforgalmi ügylet",
      NJT.foldforgalmi,
    ),
    relatedLawRefs: [
      lawRef(
        "47/2014. (II. 26.) Korm. rendelet",
        "47/2014. Korm. r.",
        "biztonsági okmány",
        "Biztonsági okmány",
        NJT.biztonsagiOkmany,
      ),
    ],
    activeWhen: isAgri,
    auditTerms: ["FÖLDFORGALMI", "kifüggesztés", "jóváhagy"],
    ugyvediKerdesek: [
      "A vevő szerzőképessége, földműves státusza és tulajdonszerzési korlátja igazolt-e?",
      "A sima és a biztonsági okmányos változat szerepe elég egyértelmű-e a munkafolyamatban?",
    ],
  },
  {
    id: "security-paper",
    cim: "Biztonsági okmány / zöld papír",
    leiras:
      "Földforgalmi okirat biztonsági elemekkel ellátott papír alapú okmányra előkészített változata.",
    triggerLeiras: "Földforgalmi ügy és nyomtatási változat: biztonsági_okmany.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kritikus",
    lawRef: lawRef(
      "47/2014. (II. 26.) Korm. rendelet",
      "47/2014. Korm. r.",
      "biztonsági okmány",
      "Biztonsági okmány / zöld papír",
      NJT.biztonsagiOkmany,
    ),
    activeWhen: (c) =>
      isAgri(c) && c.special.foldforgalmi.nyomtatasiValtozat === "biztonsagi_okmany",
    auditTerms: ["BIZTONSÁGI OKMÁNY", "zöld papír"],
    ugyvediKerdesek: [
      "Export előtt kötelező legyen-e a biztonsági okmány sorszáma és kiállítója?",
      "A 2 colos margó megfelel-e a tényleges irodai nyomtatási gyakorlatnak?",
    ],
  },
  {
    id: "foreign-buyer",
    cim: "Külföldi szerző ingatlanszerzési engedélye",
    leiras:
      "Nem magyar vevő vagy külföldi székhelyű szerző fél esetén engedélyezési és kivételi szabályok előzetes jelzése.",
    triggerLeiras: "Nem magyar állampolgárságú vevő vagy külföldi székhelyű céges vevő.",
    reviewStatus: "ai_prelinked",
    riskLevel: "magas",
    lawRef: lawRef(
      "251/2014. (X. 2.) Korm. rendelet",
      "251/2014. Korm. r.",
      "külföldiek ingatlanszerzése",
      "Külföldi vevő ingatlanszerzése",
      NJT.kulfoldiIngatlan,
    ),
    activeWhen: hasForeignBuyer,
    auditTerms: ["KÜLFÖLDI SZERZŐ", "251/2014"],
    ugyvediKerdesek: [
      "EGT-állampolgár, viszonosság vagy más mentesség miatt kell-e módosítani a klauzulát?",
      "A hatálybalépési feltétel megfelelően kezeli-e az engedélyezési döntést?",
    ],
  },
  {
    id: "company-party",
    cim: "Céges fél képviselete",
    leiras:
      "Cégkivonat, képviseleti jogosultság, aláírásminta és tényleges tulajdonosi nyilatkozat.",
    triggerLeiras: "Ha bármely fél céges fél.",
    reviewStatus: "ai_prelinked",
    riskLevel: "magas",
    lawRef: lawRef(
      "2017. évi LIII. törvény",
      "Pmt.",
      "tényleges tulajdonos és ügyfél-átvilágítás",
      "Céges fél Pmt. átvilágítása",
      NJT.pmt,
    ),
    relatedLawRefs: [
      lawRef(
        "2013. évi V. törvény",
        "Ptk.",
        "jogi személy képviselete",
        "Céges képviselet",
        NJT.ptk,
      ),
    ],
    activeWhen: hasCompanyParty,
    auditTerms: ["cégjegyzékszám", "képviselet módja", "tényleges tulajdonosi nyilatkozat"],
    ugyvediKerdesek: [
      "Elég-e a cégkivonat dátumának bekérése vagy kell automatikus frissességi figyelmeztetés?",
      "Együttes képviseletnél hogyan jelenjen meg az aláírási blokk?",
    ],
  },
  {
    id: "energy-certificate",
    cim: "Energetikai tanúsítvány",
    leiras: "Energetikai tanúsítvány átadása, HET szám és ügyvédi ellenőrzési megjegyzés.",
    triggerLeiras: "Lakóingatlan jellegű ügyleteknél aktív; hiánynál placeholder/figyelmeztetés.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kozepes",
    lawRef: lawRef(
      "176/2008. (VI. 30.) Korm. rendelet",
      "176/2008. Korm. r.",
      "energetikai tanúsítvány",
      "Energetikai tanúsítvány",
      NJT.energetikai,
    ),
    activeWhen: isResidentialProperty,
    auditTerms: ["energetikai tanúsítvány"],
    ugyvediKerdesek: [
      "Mely ügytípusoknál kell kivételt képezni az energetikai tanúsítvány alól?",
      "A HET szám hiánya blokkoló legyen-e exportnál?",
    ],
  },
  {
    id: "condominium",
    cim: "Társasházi albetét",
    leiras:
      "Alapító okirat, SZMSZ, közös képviselői igazolás és társasházi elővásárlási/hozzájárulási kérdések.",
    triggerLeiras: "Társasházi albetét vagy property.tarsashaziAlbetet.",
    reviewStatus: "ai_prelinked",
    riskLevel: "kozepes",
    lawRef: lawRef(
      "2003. évi CXXXIII. törvény",
      "Társasházi tv.",
      "alapító okirat, SZMSZ, társasházi működés",
      "Társasházi albetét",
      NJT.tarsashaz,
    ),
    activeWhen: (c) =>
      c.property.tarsashaziAlbetet || c.transactionTypes.includes("tarsashazi_albetet"),
    auditTerms: ["TÁRSASHÁZI", "alapító okirat", "SZMSZ"],
    ugyvediKerdesek: [
      "Az adott társasházi alapító okirat tartalmaz-e elővásárlási jogot vagy hozzájárulási feltételt?",
      "Kell-e külön garázs/tároló használati vagy tulajdoni jogi klauzula?",
    ],
  },
];

export function getActiveClausePairings(c: CaseFile): ClausePairing[] {
  return CLAUSE_PAIRINGS.filter((pairing) => pairing.activeWhen(c));
}

export function getAllLawRefs(pairing: ClausePairing): LawRef[] {
  return [pairing.lawRef, ...(pairing.relatedLawRefs ?? [])];
}

export function formatReviewStatus(status: ClauseReviewStatus): string {
  switch (status) {
    case "ai_prelinked":
      return "AI előpárosítás – ügyvédi ellenőrzés szükséges";
    case "lawyer_approved":
      return "Ügyvéd által jóváhagyva";
    case "lawyer_needs_modification":
      return "Ügyvédi módosítást igényel";
    case "lawyer_rejected":
      return "Ügyvéd által elutasítva";
    case "blocked_missing_data":
      return "Hiányzó adat miatt blokkolt";
  }
}
