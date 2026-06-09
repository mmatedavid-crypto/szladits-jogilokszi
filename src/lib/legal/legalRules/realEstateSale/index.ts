import type { LegalRule } from "../types";

const always = () => true;

function hasCapacityOrGuardianshipSignal(party: {
  kind: string;
  szuletesiDatum?: string;
  capacityOverride?: string;
  kepviselo?: { minoseg?: string };
}): boolean {
  if (party.kind !== "termeszetes") return false;
  if (party.capacityOverride && party.capacityOverride !== "teljes") return true;
  if (party.kepviselo?.minoseg?.match(/gyám|gondnok|szülő|törvényes/i)) return true;
  if (!party.szuletesiDatum) return false;
  const birthDate = new Date(party.szuletesiDatum);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  const age =
    today.getFullYear() -
    birthDate.getFullYear() -
    (today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
      ? 1
      : 0);
  return age < 18;
}

export const realEstateSaleRules: LegalRule[] = [
  {
    id: "baseSale",
    title: "Alap ingatlan-adásvételi keret",
    sourceRefs: [
      "ptk-2013-v",
      "inytv-2021-c",
      "inyvhr-179-2023",
      "uttv-2017-lxxviii",
      "pmt-2017-liii",
    ],
    appliesWhen: (facts) => facts.transactionType === "real_estate_sale",
    requiredFacts: [
      "parties",
      "property.helyrajziSzam",
      "purchasePrice",
      "titleDeed.checkedAt",
      "escrow.kasz",
    ],
    requiredClauses: [
      {
        clauseId: "party_natural_person",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
      {
        clauseId: "title_deed_encumbrances",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.property.helyrajziSzam || !facts.purchasePrice,
    auditQuestions: [
      "Minden fél, ingatlanadat, vételár és ügyvédi ellenjegyzési adat rögzítve van-e?",
      "Az okirat csak tervezetként jelenik-e meg ügyvédi review előtt?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "inytvEingBase",
    title: "Új Inytv. / E-ING alapszabály",
    sourceRefs: ["inytv-2021-c", "inyvhr-179-2023", "inytv-transition-2021-cxlvi"],
    appliesWhen: (facts) => facts.transactionType === "real_estate_sale",
    requiredFacts: [
      "property.helyrajziSzam",
      "titleDeed.checkedAt",
      "property.tulajdoniHanyad",
      "registrationConsent.exists",
      "registrationConsent.releaseConditions",
    ],
    requiredClauses: [
      {
        clauseId: "title_retention_buyer_right",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
      {
        clauseId: "registration_consent_escrow",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.property.helyrajziSzam ||
      !facts.titleDeed.checkedAt ||
      !facts.property.tulajdoniHanyad ||
      !facts.registrationConsent.exists,
    auditQuestions: [
      "Az E-ING beadási stratégia, jogcím és bejegyzési engedély kezelése rögzített-e?",
      "A tulajdoni lap és az okirat ingatlanadatai egyeznek-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "pmtClientDueDiligence",
    title: "Pmt. ügyfél-átvilágítás",
    sourceRefs: ["pmt-2017-liii", "pvkit-2017-lii", "pmt-ngm-21-2017"],
    appliesWhen: always,
    requiredFacts: ["pmt.statusKnown", "pmt.identityVerificationDone", "pmt.beneficialOwnerDone"],
    requiredClauses: [
      {
        clauseId: "pmt_identification",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.pmt.statusKnown || !facts.pmt.identityVerificationDone,
    auditQuestions: ["Pmt. azonosítás, tényleges tulajdonos és okmányellenőrzés dokumentált-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "sanctionsCheck",
    title: "Szankciós ellenőrzés",
    sourceRefs: ["pvkit-2017-lii", "pmt-2017-liii"],
    appliesWhen: always,
    requiredFacts: ["sanctions.statusKnown"],
    requiredClauses: [
      {
        clauseId: "pmt_identification",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.sanctions.statusKnown || facts.sanctions.hit,
    auditQuestions: ["Szankciós státusz ellenőrizve és dokumentálva van-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "uttvCountersignature",
    title: "Üttv. ellenjegyzés",
    sourceRefs: ["uttv-2017-lxxviii"],
    appliesWhen: always,
    requiredFacts: ["escrow.kasz"],
    requiredClauses: [
      {
        clauseId: "uttv_countersignature",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.escrow.kasz,
    auditQuestions: ["Ügyvéd neve, irodája és KASZ-száma hiánytalan-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "proxyRepresentation",
    title: "Meghatalmazotti képviselet",
    sourceRefs: ["ptk-2013-v", "uttv-2017-lxxviii"],
    appliesWhen: (facts) => facts.representatives.some((rep) => rep.exists),
    requiredFacts: ["documents.powerOfAttorney", "representatives"],
    requiredClauses: [
      {
        clauseId: "party_authorized_representative",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.documents.powerOfAttorney,
    auditQuestions: ["A meghatalmazás mellékletként szerepel és terjedelme ellenőrzött-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "condominium",
    title: "Társasházi albetét",
    sourceRefs: ["tarsashazi-tv-2003-cxxxiii", "inytv-2021-c"],
    appliesWhen: (facts) => facts.condominium.isCondominium,
    requiredFacts: ["condominium.foundingDeedReviewed", "condominium.condominiumShare"],
    requiredClauses: [
      {
        clauseId: "property_condominium_flat",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.condominium.foundingDeedReviewed,
    auditQuestions: ["Alapító okirat, közös tulajdoni hányad és SZMSZ-státusz ellenőrzött-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "exclusiveUse",
    title: "Kizárólagos használati jog",
    sourceRefs: ["tarsashazi-tv-2003-cxxxiii", "inytv-2021-c"],
    appliesWhen: (facts) => facts.exclusiveUse.exists,
    requiredFacts: [
      "exclusiveUse.areaM2",
      "exclusiveUse.mapAttachment",
      "exclusiveUse.foundingDeedReference",
    ],
    requiredClauses: [
      {
        clauseId: "exclusive_garden_use",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.exclusiveUse.mapAttachment || !facts.exclusiveUse.foundingDeedReference,
    auditQuestions: [
      "A kizárólagos használat térképe és alapító okirati forrása mellékelve van-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "titleDeedFreshness",
    title: "Tulajdoni lap frissessége",
    sourceRefs: ["inytv-2021-c", "inyvhr-179-2023"],
    appliesWhen: always,
    requiredFacts: ["titleDeed.checkedAt", "titleDeed.encumbranceEntries"],
    requiredClauses: [
      {
        clauseId: "title_deed_encumbrances",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.titleDeed.checkedAt,
    auditQuestions: ["Friss tulajdoni lap dátuma és III. rész státusza rögzítve van-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "encumbranceCleanup",
    title: "Tehermentesítési stratégia",
    sourceRefs: ["inytv-2021-c", "inyvhr-179-2023", "ptk-2013-v"],
    appliesWhen: (facts) => facts.encumbrances.exists,
    requiredFacts: ["encumbrances.cleanupStrategy", "encumbrances.creditorStatementAvailable"],
    requiredClauses: [
      {
        clauseId: "mortgage_and_prohibition_cleanup",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.encumbrances.cleanupStrategy,
    auditQuestions: ["Minden teherhez van jogosulti nyilatkozat, törlési út és fizetési feltétel?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "mortgagePayoff",
    title: "Jelzálog / önálló zálogjog kifizetés",
    sourceRefs: ["inytv-2021-c", "inyvhr-179-2023"],
    appliesWhen: (facts) => facts.encumbrances.mortgage || facts.encumbrances.independentLien,
    requiredFacts: ["encumbrances.creditorStatementAvailable", "encumbrances.cleanupStrategy"],
    requiredClauses: [
      {
        clauseId: "mortgage_and_prohibition_cleanup",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.encumbrances.creditorStatementAvailable,
    auditQuestions: [
      "Jogosulti igazolás, értéknap és törlési engedély workflow rendelkezésre áll-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "bankFinancing",
    title: "Banki finanszírozás",
    sourceRefs: ["ptk-2013-v", "inytv-2021-c", "inyvhr-179-2023"],
    appliesWhen: (facts) => facts.bankFinancing.used,
    requiredFacts: [
      "bankFinancing.bankName",
      "bankFinancing.amount",
      "bankFinancing.disbursementDeadline",
    ],
    requiredClauses: [
      {
        clauseId: "bank_financing",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.bankFinancing.bankName ||
      !facts.bankFinancing.disbursementDeadline ||
      facts.paymentPlan.componentsTotal !== facts.purchasePrice,
    auditQuestions: [
      "Banki összeg + önerő összege egyezik-e a vételárral? Van-e folyósítási határidő?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "csokPlusz",
    title: "CSOK Plusz finanszírozás",
    sourceRefs: ["csok-plusz-518-2023"],
    appliesWhen: (facts) => facts.stateSubsidies.csokPlusz.used,
    requiredFacts: [
      "stateSubsidies.csokPlusz.amount",
      "stateSubsidies.csokPlusz.bank",
      "stateSubsidies.csokPlusz.stateLienExpected",
    ],
    requiredClauses: [
      {
        clauseId: "bank_financing",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "high",
    blocksFinalizationWhen: (facts) => !facts.stateSubsidies.csokPlusz.bank,
    auditQuestions: ["CSOK Plusz összege, bankja és állami jelzálog/tilalom kezelése rögzített-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "otthonStart",
    title: "Otthon Start finanszírozás",
    sourceRefs: ["otthon-start-227-2025"],
    appliesWhen: (facts) => facts.otthonStart.used,
    requiredFacts: ["otthonStart.amount", "stateSubsidies.otthonStart.bank"],
    requiredClauses: [
      {
        clauseId: "bank_financing",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "high",
    blocksFinalizationWhen: (facts) => !facts.otthonStart.amount,
    auditQuestions: ["Otthon Start összeg, bank és feltételek rögzítettek-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "greenLoan",
    title: "Zöld hitel",
    sourceRefs: ["energy-cert-176-2008", "energy-ekm-9-2023"],
    appliesWhen: (facts) => facts.greenLoan.used,
    requiredFacts: ["greenLoan.amount", "greenLoan.bank", "greenLoan.energyCondition"],
    requiredClauses: [
      {
        clauseId: "bank_financing",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "high",
    blocksFinalizationWhen: (facts) => !facts.greenLoan.amount || !facts.greenLoan.bank,
    auditQuestions: ["Zöld hitel feltételei és energetikai feltétel rögzítettek-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "titleRetentionBuyerRight",
    title: "Tulajdonjog-fenntartás / vevői jog",
    sourceRefs: ["ptk-2013-v", "inytv-2021-c", "inyvhr-179-2023"],
    appliesWhen: (facts) =>
      facts.paymentPlan.componentsTotal !== facts.purchasePrice || facts.bankFinancing.used,
    requiredFacts: ["registrationConsent.heldInEscrow", "registrationConsent.releaseConditions"],
    requiredClauses: [
      {
        clauseId: "title_retention_buyer_right",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.registrationConsent.heldInEscrow || !facts.registrationConsent.releaseConditions,
    auditQuestions: [
      "Vevői jog, ranghely, 6 hónapos logika és bejegyzési engedély kezelése tiszta-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "registrationConsentEscrow",
    title: "Bejegyzési engedély letét",
    sourceRefs: ["ptk-2013-v", "uttv-2017-lxxviii", "inytv-2021-c", "inyvhr-179-2023"],
    appliesWhen: (facts) => facts.escrow.used,
    requiredFacts: ["escrow.lawyerName", "escrow.kasz", "escrow.releaseConditions"],
    requiredClauses: [
      {
        clauseId: "registration_consent_escrow",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) => !facts.escrow.kasz || !facts.escrow.releaseConditions,
    auditQuestions: ["Letéti kiadás feltételei és fizetési igazolás mechanizmusa egyértelmű-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "energyCertificate",
    title: "Energetikai tanúsítvány",
    sourceRefs: ["energy-cert-176-2008", "energy-ekm-9-2023"],
    appliesWhen: (facts) => facts.energyCertificate.required,
    requiredFacts: ["energyCertificate.number", "energyCertificate.deliveredToBuyer"],
    requiredClauses: [
      {
        clauseId: "energy_certificate",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "high",
    blocksFinalizationWhen: (facts) =>
      facts.energyCertificate.required &&
      !facts.energyCertificate.lawyerApprovedException &&
      (!facts.energyCertificate.number || !facts.energyCertificate.deliveredToBuyer),
    auditQuestions: ["HET szám és átadás rögzített-e, vagy ügyvéd által jóváhagyott kivétel van?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "electricalSafety",
    title: "Villamos biztonsági tájékoztatás",
    sourceRefs: ["electrical-safety-40-2017"],
    appliesWhen: (facts) => facts.electricalSafety.applies,
    requiredFacts: ["electricalSafety.reviewDocumentAvailable"],
    requiredClauses: [
      {
        clauseId: "electrical_safety_review",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: false,
      },
    ],
    riskLevel: "medium",
    auditQuestions: [
      "Van-e felülvizsgálati dokumentum vagy kivétel, és kell-e blokkolni az iroda gyakorlata szerint?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "localMunicipalityRestriction",
    title: "Helyi önazonosság / önkormányzati korlátozás",
    sourceRefs: ["local-identity-2025-xlviii"],
    appliesWhen: (facts) => facts.localMunicipalityCheck.required,
    requiredFacts: ["localMunicipalityCheck.checkedAt", "localMunicipalityCheck.sourceUrl"],
    requiredClauses: [
      {
        clauseId: "local_municipality_preemption_check",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.localMunicipalityCheck.checkedAt || !facts.localMunicipalityCheck.sourceUrl,
    auditQuestions: ["Önkormányzati oldal/rendelet ellenőrzési dátuma és forrása rögzített-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "foreignBuyerPermit",
    title: "Külföldi vevő engedély",
    sourceRefs: ["lakastv-1993-lxxviii", "foreign-acquisition-251-2014"],
    appliesWhen: (facts) =>
      facts.buyer.some((buyer) =>
        buyer.kind === "ceg"
          ? buyer.kulfoldiSzekhely
          : Boolean(buyer.allampolgarsag && buyer.allampolgarsag.toLowerCase() !== "magyar"),
      ) && !facts.property.isFarmlandLike,
    requiredFacts: ["buyer", "documents"],
    requiredClauses: [
      {
        clauseId: "party_natural_person",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: ["Engedély szükséges-e, és ha igen, megvan-e a státusz vagy ügyvédi kivétel?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "farmlandSpecialRegime",
    title: "Földforgalmi speciális rezsim",
    sourceRefs: [
      "foldforgalmi-2013-cxxii",
      "fetv-2013-ccxii",
      "fold-hirdetmeny-474-2013",
      "termofold-vedelem-2007-cxxix",
    ],
    appliesWhen: (facts) => facts.property.isFarmlandLike,
    requiredFacts: ["property.muvelesiAg"],
    requiredClauses: [],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: [
      "Normál lakóingatlan-adásvételi workflow helyett földforgalmi workflow szükséges-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "companyPartyRepresentation",
    title: "Céges fél képviselete",
    sourceRefs: ["ctv-2006-v", "ptk-2013-v", "pmt-2017-liii"],
    appliesWhen: (facts) => facts.parties.some((party) => party.kind === "ceg"),
    requiredFacts: ["documents.companyExtract", "pmt.beneficialOwnerDone"],
    requiredClauses: [
      {
        clauseId: "pmt_identification",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: (facts) =>
      !facts.documents.companyExtract || !facts.pmt.beneficialOwnerDone,
    auditQuestions: ["Cégkivonat, képviseleti jog és tényleges tulajdonos ellenőrzött-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "enforcementOrAuction",
    title: "Végrehajtás / árverési kockázat",
    sourceRefs: ["vht-1994-liii", "inytv-2021-c"],
    appliesWhen: (facts) => facts.encumbrances.enforcement,
    requiredFacts: ["encumbrances.cleanupStrategy"],
    requiredClauses: [
      {
        clauseId: "mortgage_and_prohibition_cleanup",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: ["Végrehajtási jog esetén külön ügyvédi workflow és jogosulti igazolás van-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "insolvency",
    title: "Felszámolás / csőd / kényszertörlés",
    sourceRefs: ["cstv-1991-xlix", "ctv-2006-v"],
    appliesWhen: () => false,
    requiredFacts: ["documents.companyExtract"],
    requiredClauses: [],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: ["Céges fél fizetésképtelenségi vagy kényszertörlési státusza kizárt-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "minorOrGuardianship",
    title: "Kiskorú / gondnokolt fél",
    sourceRefs: ["ptk-2013-v", "guardianship-149-1997"],
    appliesWhen: (facts) => facts.parties.some(hasCapacityOrGuardianshipSignal),
    requiredFacts: ["representatives", "documents.powerOfAttorney"],
    requiredClauses: [
      {
        clauseId: "party_authorized_representative",
        minReviewStatus: "lawyer_approved",
        blocksFinalizationIfMissing: true,
      },
    ],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: [
      "Gyámhatósági jóváhagyás vagy képviseleti workflow szükséges és dokumentált-e?",
    ],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "stateOrMunicipalProperty",
    title: "Állami / önkormányzati vagyon",
    sourceRefs: ["national-assets-2011-cxcvi", "motv-2011-clxxxix"],
    appliesWhen: () => false,
    requiredFacts: ["documents"],
    requiredClauses: [],
    riskLevel: "critical",
    blocksFinalizationWhen: () => true,
    auditQuestions: ["Döntés, pályázat, rendeleti alap vagy jóváhagyás szükséges-e?"],
    reviewStatus: "lawyer_review_required",
  },
  {
    id: "taxAndFeeInformation",
    title: "Illeték, adó, B400E információ",
    sourceRefs: ["itv-1990-xciii", "szja-1995-cxvii", "afa-2007-cxxvii", "art-2017-cl"],
    appliesWhen: always,
    requiredFacts: ["taxAndFees.b400eStatus"],
    requiredClauses: [],
    riskLevel: "medium",
    auditQuestions: [
      "Illeték/B400E, Szja és Áfa review információk elkülönülnek-e adótanácsadástól?",
    ],
    reviewStatus: "lawyer_review_required",
  },
];
