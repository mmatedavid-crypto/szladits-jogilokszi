export type LegalSourceType =
  | "NJT"
  | "EUR_LEX"
  | "KORMANY"
  | "KORMANYHIVATAL"
  | "MUK"
  | "LOCAL_ORDINANCE"
  | "LAWYER_SAMPLE"
  | "BANK_REQUIREMENT"
  | "OTHER_OFFICIAL_SOURCE";

export type LegalSourceVerificationStatus =
  | "source_added_pending_fetch"
  | "source_fetched"
  | "ai_extracted_pending_lawyer_review"
  | "lawyer_review_required"
  | "lawyer_approved"
  | "needs_update"
  | "superseded"
  | "repealed_or_inactive";

export type LawRefVerificationStatus = "ai_prelinked_pending_lawyer_review";
export type LegalSourceReviewStatus = "pending_lawyer_review" | "lawyer_validated" | "needs_update";

export type LegalSource = {
  id: string;
  title: string;
  actNumber?: string;
  shortName?: string;
  sourceType: LegalSourceType;
  sourceUrl: string;
  retrievedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  versionHash?: string;
  notes?: string;
  verificationStatus: LegalSourceVerificationStatus;

  // Compatibility fields used by the existing lawRef/clause-review layer.
  act: string;
  source: "NJT" | LegalSourceType;
  checkedAt: string;
  effectiveDateBasis: string;
  lawRefVerificationStatus: LawRefVerificationStatus;
  lawyerReviewStatus: LegalSourceReviewStatus;
};

export type LawRef = {
  sourceId: LegalSourceId;
  act: string;
  shortName: string;
  section: string;
  label: string;
  source: "NJT";
  sourceUrl: string;
  checkedAt: string;
  effectiveDateBasis: string;
  verificationStatus: LawRefVerificationStatus;
};

export const LEGAL_SOURCE_CHECKED_AT = "2026-06-09";
export const LAWYER_REVIEW_REQUIRED = "ügyvédi validáció szükséges";
export const AI_PRELINKED_PENDING_REVIEW: LawRefVerificationStatus =
  "ai_prelinked_pending_lawyer_review";

type SourceInput = {
  id: string;
  title: string;
  actNumber?: string;
  shortName?: string;
  sourceType: LegalSourceType;
  sourceUrl: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  verificationStatus?: LegalSourceVerificationStatus;
};

const source = (input: SourceInput): LegalSource => ({
  ...input,
  act: input.actNumber ?? input.title,
  shortName: input.shortName,
  source: input.sourceType,
  checkedAt: LEGAL_SOURCE_CHECKED_AT,
  retrievedAt: LEGAL_SOURCE_CHECKED_AT,
  effectiveDateBasis: LAWYER_REVIEW_REQUIRED,
  lawRefVerificationStatus: AI_PRELINKED_PENDING_REVIEW,
  lawyerReviewStatus: "pending_lawyer_review",
  verificationStatus: input.verificationStatus ?? "lawyer_review_required",
});

const sources = [
  source({
    id: "ptk-2013-v",
    title: "Polgári Törvénykönyv",
    actNumber: "2013. évi V. törvény",
    shortName: "Ptk.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2013-5-00-00",
  }),
  source({
    id: "ptk-transition-2013-clxxvii",
    title:
      "A Polgári Törvénykönyv hatálybalépésével összefüggő átmeneti és felhatalmazó rendelkezések",
    actNumber: "2013. évi CLXXVII. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2013-177-00-00",
  }),
  source({
    id: "inytv-2021-c",
    title: "Az ingatlan-nyilvántartásról",
    actNumber: "2021. évi C. törvény",
    shortName: "Inytv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2021-100-00-00",
  }),
  source({
    id: "inyvhr-179-2023",
    title: "Az ingatlan-nyilvántartásról szóló 2021. évi C. törvény végrehajtásáról",
    actNumber: "179/2023. (V. 15.) Korm. rendelet",
    shortName: "Inyvhr.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2023-179-20-22",
  }),
  source({
    id: "inytv-transition-2021-cxlvi",
    title:
      "Az ingatlan-nyilvántartásról szóló 2021. évi C. törvény hatálybalépésével összefüggő átmeneti rendelkezések",
    actNumber: "2021. évi CXLVI. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2021-146-00-00",
  }),
  source({
    id: "old-inytv-1997-cxli",
    title: "Az ingatlan-nyilvántartásról",
    actNumber: "1997. évi CXLI. törvény",
    shortName: "régi Inytv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1997-141-00-00",
    notes: "Use only where transition / legacy procedures require it.",
  }),
  source({
    id: "pp-2016-cxxx",
    title: "A polgári perrendtartásról",
    actNumber: "2016. évi CXXX. törvény",
    shortName: "Pp.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2016-130-00-00",
  }),
  source({
    id: "uttv-2017-lxxviii",
    title: "Az ügyvédi tevékenységről",
    actNumber: "2017. évi LXXVIII. törvény",
    shortName: "Üttv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-78-00-00",
  }),
  source({
    id: "pmt-2017-liii",
    title: "A pénzmosás és a terrorizmus finanszírozása megelőzéséről és megakadályozásáról",
    actNumber: "2017. évi LIII. törvény",
    shortName: "Pmt.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-53-00-00",
  }),
  source({
    id: "pvkit-2017-lii",
    title:
      "Az Európai Unió és az ENSZ Biztonsági Tanácsa által elrendelt pénzügyi és vagyoni korlátozó intézkedések végrehajtásáról",
    actNumber: "2017. évi LII. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-52-00-00",
  }),
  source({
    id: "pmt-ngm-21-2017",
    title: "Pénzmosás-megelőzési belső szabályzatokhoz kapcsolódó rendelet",
    actNumber: "21/2017. (VIII. 3.) NGM rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-21-20-2X",
  }),
  source({
    id: "eugyintezes-2015-ccxxii",
    title: "Az elektronikus ügyintézés és a bizalmi szolgáltatások általános szabályairól",
    actNumber: "2015. évi CCXXII. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2015-222-00-00",
  }),
  source({
    id: "remote-identification-541-2020",
    title: "Egyes közbizalmi szolgáltatóknál alkalmazott ügyfél-azonosítási szabályokról",
    actNumber: "541/2020. (XII. 2.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2020-541-20-22",
  }),
  source({
    id: "akr-2016-cl",
    title: "Az általános közigazgatási rendtartásról",
    actNumber: "2016. évi CL. törvény",
    shortName: "Ákr.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2016-150-00-00",
  }),
  source({
    id: "gdpr-2016-679",
    title: "General Data Protection Regulation",
    actNumber: "Regulation (EU) 2016/679",
    shortName: "GDPR",
    sourceType: "EUR_LEX",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  }),
  source({
    id: "infotv-2011-cxii",
    title: "Az információs önrendelkezési jogról és az információszabadságról",
    actNumber: "2011. évi CXII. törvény",
    shortName: "Infotv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2011-112-00-00",
  }),
  source({
    id: "tarsashazi-tv-2003-cxxxiii",
    title: "A társasházakról",
    actNumber: "2003. évi CXXXIII. törvény",
    shortName: "Társasházi tv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2003-133-00-00",
  }),
  source({
    id: "lakasszovetkezet-2004-cxv",
    title: "A lakásszövetkezetekről",
    actNumber: "2004. évi CXV. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2004-115-00-00",
  }),
  source({
    id: "energy-cert-176-2008",
    title: "Az épületek energetikai jellemzőinek tanúsításáról",
    actNumber: "176/2008. (VI. 30.) Korm. rendelet",
    shortName: "176/2008. Korm. r.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2008-176-20-22",
  }),
  source({
    id: "energy-ekm-9-2023",
    title: "Az épületek energetikai jellemzőinek meghatározásáról",
    actNumber: "9/2023. (V. 25.) ÉKM rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2023-9-20-8P",
  }),
  source({
    id: "electrical-safety-40-2017",
    title:
      "Az összekötő és felhasználói berendezésekről, valamint villamos berendezésekről és védelmi rendszerekről",
    actNumber: "40/2017. (XII. 4.) NGM rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-40-20-2X",
  }),
  source({
    id: "lakastv-1993-lxxviii",
    title:
      "A lakások és helyiségek bérletére, valamint az elidegenítésükre vonatkozó egyes szabályokról",
    actNumber: "1993. évi LXXVIII. törvény",
    shortName: "Lakástv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1993-78-00-00",
  }),
  source({
    id: "foreign-acquisition-251-2014",
    title: "Külföldiek magyarországi ingatlanszerzésének engedélyezéséről",
    actNumber: "251/2014. (X. 2.) Korm. rendelet",
    shortName: "251/2014. Korm. r.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2014-251-20-22",
  }),
  source({
    id: "foldforgalmi-2013-cxxii",
    title: "A mező- és erdőgazdasági földek forgalmáról",
    actNumber: "2013. évi CXXII. törvény",
    shortName: "Földforgalmi tv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2013-122-00-00",
  }),
  source({
    id: "fetv-2013-ccxii",
    title:
      "A mező- és erdőgazdasági földek forgalmával összefüggő egyes rendelkezésekről és átmeneti szabályokról",
    actNumber: "2013. évi CCXII. törvény",
    shortName: "Fétv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2013-212-00-00",
  }),
  source({
    id: "fold-hirdetmeny-474-2013",
    title:
      "A mező- és erdőgazdasági földekre vonatkozó adásvételi és haszonbérleti szerződések hirdetményi közlésére vonatkozó eljárási szabályokról",
    actNumber: "474/2013. (XII. 12.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2013-474-20-22",
  }),
  source({
    id: "termofold-vedelem-2007-cxxix",
    title: "A termőföld védelméről",
    actNumber: "2007. évi CXXIX. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2007-129-00-00",
  }),
  source({
    id: "erdo-2009-xxxvii",
    title: "Az erdőről, az erdő védelméről és az erdőgazdálkodásról",
    actNumber: "2009. évi XXXVII. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2009-37-00-00",
  }),
  source({
    id: "erdo-fm-61-2017",
    title: "Erdészeti végrehajtási szabályok",
    actNumber: "61/2017. (XII. 21.) FM rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-61-20-82",
  }),
  source({
    id: "termeszetvedelem-1996-liii",
    title: "A természet védelméről",
    actNumber: "1996. évi LIII. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1996-53-00-00",
  }),
  source({
    id: "natura-275-2004",
    title: "Az európai közösségi jelentőségű természetvédelmi rendeltetésű területekről",
    actNumber: "275/2004. (X. 8.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2004-275-20-22",
  }),
  source({
    id: "heritage-2001-lxiv",
    title: "A kulturális örökség védelméről",
    actNumber: "2001. évi LXIV. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2001-64-00-00",
  }),
  source({
    id: "heritage-68-2018",
    title: "A kulturális örökség védelmével kapcsolatos szabályokról",
    actNumber: "68/2018. (IV. 9.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2018-68-20-22",
  }),
  source({
    id: "architecture-2023-c",
    title: "A magyar építészetről",
    actNumber: "2023. évi C. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2023-100-00-00",
  }),
  source({
    id: "teka-280-2024",
    title: "Településrendezési és építési követelmények alapszabályzata",
    actNumber: "280/2024. (IX. 30.) Korm. rendelet",
    shortName: "TÉKA",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2024-280-20-22",
  }),
  source({
    id: "construction-authority-281-2024",
    title: "Építésügyi hatósági eljárások",
    actNumber: "281/2024. (IX. 30.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2024-281-20-22",
  }),
  source({
    id: "land-office-procedure-384-2016",
    title: "Földhivatali eljárások részletes szabályai",
    actNumber: "384/2016. (XII. 2.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2016-384-20-22",
  }),
  source({
    id: "ctv-2006-v",
    title: "A cégnyilvánosságról, a bírósági cégeljárásról és a végelszámolásról",
    actNumber: "2006. évi V. törvény",
    shortName: "Ctv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2006-5-00-00",
  }),
  source({
    id: "vht-1994-liii",
    title: "A bírósági végrehajtásról",
    actNumber: "1994. évi LIII. törvény",
    shortName: "Vht.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1994-53-00-00",
  }),
  source({
    id: "cstv-1991-xlix",
    title: "A csődeljárásról és a felszámolási eljárásról",
    actNumber: "1991. évi XLIX. törvény",
    shortName: "Cstv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1991-49-00-00",
  }),
  source({
    id: "guardianship-149-1997",
    title: "A gyámhatóságokról, valamint a gyermekvédelmi és gyámügyi eljárásról",
    actNumber: "149/1997. (IX. 10.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1997-149-20-22",
  }),
  source({
    id: "national-assets-2011-cxcvi",
    title: "A nemzeti vagyonról",
    actNumber: "2011. évi CXCVI. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2011-196-00-00",
  }),
  source({
    id: "motv-2011-clxxxix",
    title: "Magyarország helyi önkormányzatairól",
    actNumber: "2011. évi CLXXXIX. törvény",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2011-189-00-00",
  }),
  source({
    id: "local-identity-2025-xlviii",
    title: "A helyi önazonosság védelméről",
    actNumber: "2025. évi XLVIII. törvény",
    shortName: "Hövtv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2025-48-00-00",
    notes: "Must trigger municipality website / local ordinance check.",
  }),
  source({
    id: "itv-1990-xciii",
    title: "Az illetékekről",
    actNumber: "1990. évi XCIII. törvény",
    shortName: "Itv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1990-93-00-00",
  }),
  source({
    id: "szja-1995-cxvii",
    title: "A személyi jövedelemadóról",
    actNumber: "1995. évi CXVII. törvény",
    shortName: "Szja tv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/1995-117-00-00",
  }),
  source({
    id: "afa-2007-cxxvii",
    title: "Az általános forgalmi adóról",
    actNumber: "2007. évi CXXVII. törvény",
    shortName: "Áfa tv.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2007-127-00-00",
  }),
  source({
    id: "art-2017-cl",
    title: "Az adózás rendjéről",
    actNumber: "2017. évi CL. törvény",
    shortName: "Art.",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2017-150-00-00",
  }),
  source({
    id: "csok-new-16-2016",
    title: "Az új lakások építéséhez, vásárlásához kapcsolódó lakáscélú támogatásról",
    actNumber: "16/2016. (II. 10.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2016-16-20-22",
  }),
  source({
    id: "csok-used-17-2016",
    title:
      "A használt lakás vásárlásához, bővítéséhez igényelhető családi otthonteremtési kedvezményről",
    actNumber: "17/2016. (II. 10.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2016-17-20-22",
  }),
  source({
    id: "falusi-csok-302-2023",
    title: "A kistelepüléseken nyújtható otthonteremtési támogatásokról",
    actNumber: "302/2023. (VII. 11.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2023-302-20-22",
  }),
  source({
    id: "csok-plusz-518-2023",
    title: "A családok otthonteremtését támogató kedvezményes CSOK Plusz hitelprogramról",
    actNumber: "518/2023. (XI. 30.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2023-518-20-22",
  }),
  source({
    id: "otthon-start-227-2025",
    title: "Az Otthon Start program keretében biztosított FIX 3%-os lakáshitelről",
    actNumber: "227/2025. (VII. 31.) Korm. rendelet",
    sourceType: "NJT",
    sourceUrl: "https://njt.hu/jogszabaly/2025-227-20-22",
  }),
  source({
    id: "kormany-inytv-official-material-2026",
    title: "Kormány.hu ingatlan-nyilvántartási hivatalos háttéranyag",
    sourceType: "KORMANY",
    sourceUrl:
      "https://kormany.hu/application/documents/af567181-4f24-45ec-acbe-851bf1666713/download",
    notes:
      "Kiegészítő hivatalos forráslink az új Inytv./E-ING workflow ügyvédi feldolgozásához; nem helyettesíti az NJT jogszabályszöveget.",
    verificationStatus: "source_added_pending_fetch",
  }),
  source({
    id: "lawyer-sample-sale-agreement-2026",
    title: "Anonymized lawyer-drafted real-estate sale agreement uploaded to project",
    sourceType: "LAWYER_SAMPLE",
    sourceUrl: "uploaded-docx",
    notes: "Use only as clause sample / drafting style source, never as legal authority.",
    verificationStatus: "lawyer_review_required",
  }),
] as const;

export const LEGAL_SOURCES = Object.fromEntries(
  sources.map((legalSource) => [legalSource.id, legalSource]),
) as Record<(typeof sources)[number]["id"], LegalSource>;

const LEGACY_SOURCE_ALIASES = {
  ptk: "ptk-2013-v",
  inytv_1997: "old-inytv-1997-cxli",
  inytv_2021: "inytv-2021-c",
  inytv_vhr_2023: "inyvhr-179-2023",
  uttv: "uttv-2017-lxxviii",
  pmt: "pmt-2017-liii",
  itv: "itv-1990-xciii",
  foldforgalmi: "foldforgalmi-2013-cxxii",
  biztonsagi_okmany: "foldforgalmi-2013-cxxii",
  kulfoldi_ingatlan: "foreign-acquisition-251-2014",
  pp: "pp-2016-cxxx",
  energetikai: "energy-cert-176-2008",
  tarsashaz: "tarsashazi-tv-2003-cxxxiii",
} as const;

export type LegalSourceId = keyof typeof LEGAL_SOURCES | keyof typeof LEGACY_SOURCE_ALIASES;

function canonicalSourceId(id: LegalSourceId | string): keyof typeof LEGAL_SOURCES | null {
  if (id in LEGAL_SOURCES) return id as keyof typeof LEGAL_SOURCES;
  if (id in LEGACY_SOURCE_ALIASES)
    return LEGACY_SOURCE_ALIASES[id as keyof typeof LEGACY_SOURCE_ALIASES];
  return null;
}

export function isKnownLegalSourceId(id: string): id is LegalSourceId {
  return canonicalSourceId(id) !== null;
}

export function getLegalSource(id: LegalSourceId): LegalSource {
  const canonical = canonicalSourceId(id);
  if (!canonical) throw new Error(`Unknown legal source: ${id}`);
  return LEGAL_SOURCES[canonical];
}

export function listLegalSources(): LegalSource[] {
  return Object.values(LEGAL_SOURCES);
}

export function createLawRef(sourceId: LegalSourceId, section: string, label: string): LawRef {
  const legalSource = getLegalSource(sourceId);
  return {
    sourceId,
    act: legalSource.act,
    shortName: legalSource.shortName ?? legalSource.act,
    section,
    label,
    source: "NJT",
    sourceUrl: legalSource.sourceUrl,
    checkedAt: legalSource.checkedAt,
    effectiveDateBasis: legalSource.effectiveDateBasis,
    verificationStatus: legalSource.lawRefVerificationStatus,
  };
}
