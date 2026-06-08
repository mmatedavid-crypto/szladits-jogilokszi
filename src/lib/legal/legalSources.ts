export type LawRefVerificationStatus = "ai_prelinked_pending_lawyer_review";

export type LegalSourceReviewStatus = "pending_lawyer_review" | "lawyer_validated" | "needs_update";

export type LegalSourceId =
  | "ptk"
  | "inytv_1997"
  | "inytv_2021"
  | "uttv"
  | "pmt"
  | "itv"
  | "foldforgalmi"
  | "biztonsagi_okmany"
  | "kulfoldi_ingatlan"
  | "pp"
  | "energetikai"
  | "tarsashaz";

export interface LegalSource {
  id: LegalSourceId;
  act: string;
  shortName: string;
  source: "NJT";
  sourceUrl: string;
  checkedAt: string;
  effectiveDateBasis: string;
  verificationStatus: LawRefVerificationStatus;
  lawyerReviewStatus: LegalSourceReviewStatus;
}

export interface LawRef {
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
}

export const LEGAL_SOURCE_CHECKED_AT = "2026-06-08";
export const LAWYER_REVIEW_REQUIRED = "ügyvédi validáció szükséges";
export const AI_PRELINKED_PENDING_REVIEW: LawRefVerificationStatus =
  "ai_prelinked_pending_lawyer_review";

const source = (
  id: LegalSourceId,
  act: string,
  shortName: string,
  sourceUrl: string,
): LegalSource => ({
  id,
  act,
  shortName,
  source: "NJT",
  sourceUrl,
  checkedAt: LEGAL_SOURCE_CHECKED_AT,
  effectiveDateBasis: LAWYER_REVIEW_REQUIRED,
  verificationStatus: AI_PRELINKED_PENDING_REVIEW,
  lawyerReviewStatus: "pending_lawyer_review",
});

export const LEGAL_SOURCES = {
  ptk: source("ptk", "2013. évi V. törvény", "Ptk.", "https://njt.hu/jogszabaly/2013-5-00-00.33"),
  inytv_1997: source(
    "inytv_1997",
    "1997. évi CXLI. törvény",
    "Inytv.",
    "https://njt.hu/jogszabaly/1997-141-00-00.34",
  ),
  inytv_2021: source(
    "inytv_2021",
    "2021. évi C. törvény",
    "új Inytv.",
    "https://njt.hu/jogszabaly/2021-100-00-00.1",
  ),
  uttv: source(
    "uttv",
    "2017. évi LXXVIII. törvény",
    "Üttv.",
    "https://njt.hu/jogszabaly/2017-78-00-00.28",
  ),
  pmt: source(
    "pmt",
    "2017. évi LIII. törvény",
    "Pmt.",
    "https://njt.hu/jogszabaly/2017-53-00-00.1",
  ),
  itv: source("itv", "1990. évi XCIII. törvény", "Itv.", "https://njt.hu/jogszabaly/1990-93-00-00"),
  foldforgalmi: source(
    "foldforgalmi",
    "2013. évi CXXII. törvény",
    "Földforgalmi tv.",
    "https://njt.hu/jogszabaly/2013-212-00-00.39",
  ),
  biztonsagi_okmany: source(
    "biztonsagi_okmany",
    "47/2014. (II. 26.) Korm. rendelet",
    "47/2014. Korm. r.",
    "https://njt.hu/jogszabaly/2014-47-20-22",
  ),
  kulfoldi_ingatlan: source(
    "kulfoldi_ingatlan",
    "251/2014. (X. 2.) Korm. rendelet",
    "251/2014. Korm. r.",
    "https://njt.hu/jogszabaly/2014-251-20-22",
  ),
  pp: source("pp", "2016. évi CXXX. törvény", "Pp.", "https://njt.hu/jogszabaly/2016-130-00-00.17"),
  energetikai: source(
    "energetikai",
    "176/2008. (VI. 30.) Korm. rendelet",
    "176/2008. Korm. r.",
    "https://njt.hu/jogszabaly/2008-176-20-22",
  ),
  tarsashaz: source(
    "tarsashaz",
    "2003. évi CXXXIII. törvény",
    "Társasházi tv.",
    "https://njt.hu/jogszabaly/2003-133-00-00",
  ),
} as const satisfies Record<LegalSourceId, LegalSource>;

export function isKnownLegalSourceId(id: string): id is LegalSourceId {
  return id in LEGAL_SOURCES;
}

export function getLegalSource(id: LegalSourceId): LegalSource {
  return LEGAL_SOURCES[id];
}

export function createLawRef(sourceId: LegalSourceId, section: string, label: string): LawRef {
  const legalSource = getLegalSource(sourceId);
  return {
    sourceId,
    act: legalSource.act,
    shortName: legalSource.shortName,
    section,
    label,
    source: legalSource.source,
    sourceUrl: legalSource.sourceUrl,
    checkedAt: legalSource.checkedAt,
    effectiveDateBasis: legalSource.effectiveDateBasis,
    verificationStatus: legalSource.verificationStatus,
  };
}
