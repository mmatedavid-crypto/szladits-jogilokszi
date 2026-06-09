import { determineCapacityStatus, isMinor } from "../logic";
import type { CaseFile, Company, NaturalPerson, Party } from "../types";
import type { CaseFacts } from "./types";

function money(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isResidential(c: CaseFile): boolean {
  const text = `${c.property.ingatlanTipus} ${c.property.cim}`.toLowerCase();
  return (
    c.transactionTypes.some((type) =>
      ["lakas", "csaladi_haz", "tarsashazi_albetet"].includes(type),
    ) ||
    c.property.tarsashaziAlbetet ||
    text.includes("lakás") ||
    text.includes("ház") ||
    text.includes("lakó")
  );
}

function isFarmlandLike(c: CaseFile): boolean {
  const text = `${c.property.ingatlanTipus} ${c.property.muvelesiAg}`.toLowerCase();
  return (
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    c.special.foldforgalmi.fold ||
    text.includes("szántó") ||
    text.includes("rét") ||
    text.includes("legelő") ||
    text.includes("erdő") ||
    text.includes("tanya")
  );
}

function partyName(p: Party): string {
  return p.kind === "termeszetes" ? p.nev : p.cegnev;
}

function hasRepresentative(p: Party): boolean {
  if (p.kind === "termeszetes") return Boolean(p.kepviselo?.nev);
  return Boolean(p.kepviseloNeve);
}

function hasCapacityIssue(p: Party): boolean {
  if (p.kind !== "termeszetes") return false;
  const status = determineCapacityStatus(p);
  return (
    isMinor(p) ||
    status === "nagykoru_korlatozott" ||
    status === "cselekvokeptelen_nagykoru" ||
    status === "gondnokkal" ||
    status === "ellenorzes_szukseges"
  );
}

function hasCompanyParty(parties: Party[]): boolean {
  return parties.some((party): party is Company => party.kind === "ceg");
}

function hasForeignBuyer(parties: Party[]): boolean {
  return parties.some((party) => {
    if (party.szerep !== "vevo") return false;
    if (party.kind === "ceg") return party.kulfoldiSzekhely;
    return Boolean(
      party.allampolgarsag.trim() && party.allampolgarsag.trim().toLowerCase() !== "magyar",
    );
  });
}

function hasMinorOrGuardianship(parties: Party[]): boolean {
  return parties.some(hasCapacityIssue);
}

export function caseFactsFromCaseFile(c: CaseFile): CaseFacts {
  const sellers = c.parties.filter((party) => party.szerep === "elado");
  const buyers = c.parties.filter((party) => party.szerep === "vevo");
  const enc = c.property.encumbrances;
  const purchasePrice = money(c.payment.teljesVetelar);
  const ownFunds =
    money(c.payment.onero) || money(c.payment.teljesVetelar) - money(c.payment.hitelOsszeg);
  const bankLoanAmount = c.payment.bankhitelVan ? money(c.payment.hitelOsszeg) : 0;
  const depositAmount = c.payment.foglaloVan ? money(c.payment.foglaloOsszeg) : 0;
  const titleDeedDate = c.modulok.ellenorzes.tulajdoniLapDatuma;
  const pmt = c.modulok.pmt;
  const b400 = c.modulok.b400;
  const isResidentialProperty = isResidential(c);
  const isFarmland = isFarmlandLike(c);

  return {
    caseFile: c,
    transactionType: isFarmland ? "farmland_sale" : "real_estate_sale",
    parties: c.parties,
    seller: sellers,
    buyer: buyers,
    representatives: c.parties.map((party) => ({
      partyId: party.id,
      partyName: partyName(party),
      exists: hasRepresentative(party),
    })),
    property: {
      ...c.property,
      isCondominium: c.property.tarsashaziAlbetet,
      isResidential: isResidentialProperty,
      isFarmlandLike: isFarmland,
    },
    titleDeed: {
      checkedAt: titleDeedDate,
      source: titleDeedDate ? "E-hiteles tulajdoni lap" : "",
      encumbranceEntries: [enc.egyeb].filter(Boolean),
      szeljegyStatus: "",
    },
    encumbrances: {
      exists:
        enc.jelzalog ||
        enc.vegrehajtas ||
        enc.haszonelvezet ||
        enc.elidegenitesiTilalom ||
        enc.elovasarlasiJog ||
        enc.szolgalmiJog ||
        Boolean(enc.egyeb.trim()),
      mortgage: enc.jelzalog,
      independentLien: false,
      prohibition: enc.elidegenitesiTilalom,
      enforcement: enc.vegrehajtas,
      usufruct: enc.haszonelvezet,
      easement: enc.szolgalmiJog,
      litigation: false,
      pendingNote: false,
      cleanupStrategy: c.property.tehermentesitesiTerv || c.payment.tehermentesitesModja,
      creditorStatementAvailable: Boolean(c.payment.tehermentesitesModja),
    },
    purchasePrice,
    paymentPlan: {
      currency: c.payment.penznem,
      ownFunds,
      bankLoanAmount,
      otherFundingAmount: 0,
      componentsTotal: Math.max(0, ownFunds) + bankLoanAmount,
      disbursementDeadline: c.payment.hitelFolyositasHatarido,
    },
    deposit: {
      exists: c.payment.foglaloVan,
      amount: depositAmount,
      alreadyPaidAmount: 0,
      remainingAmount: depositAmount,
      paymentMethod: c.payment.utalasiSzamlaszam ? "átutalás" : "",
      deadline: "",
    },
    bankFinancing: {
      used: c.payment.bankhitelVan,
      bankName: c.payment.bankNeve,
      amount: bankLoanAmount,
      disbursementDeadline: c.payment.hitelFolyositasHatarido,
    },
    stateSubsidies: {
      csokPlusz: {
        used: b400.illetekkedvezmenyKod === "csok_plus",
        amount: 0,
        bank: c.payment.bankNeve,
        stateLienExpected: b400.illetekkedvezmenyKod === "csok_plus",
      },
      otthonStart: { used: false, amount: 0, bank: "" },
    },
    csok: { used: b400.illetekkedvezmenyKod === "csok_plus", amount: 0 },
    otthonStart: { used: false, amount: 0 },
    greenLoan: { used: false, amount: 0, bank: "", energyCondition: "" },
    registrationConsent: {
      exists: true,
      heldInEscrow: c.payment.ugyvediLetet || c.payment.bankhitelVan,
      releaseConditions: c.payment.fizetesiUtemezes || c.payment.hitelFolyositasHatarido,
    },
    escrow: {
      used: c.payment.ugyvediLetet || c.payment.bankhitelVan,
      lawyerName: c.eljaroUgyved.nev,
      kasz: c.eljaroUgyved.kaszSzam,
      originalCopies: "",
      releaseConditions: c.payment.fizetesiUtemezes || c.payment.hitelFolyositasHatarido,
    },
    condominium: {
      isCondominium: c.property.tarsashaziAlbetet,
      foundingDeedReviewed: c.modulok.tarsashaz.alapitoOkiratEllenoirzve,
      condominiumShare: c.property.tulajdoniHanyad,
      szmszReviewed: c.modulok.tarsashaz.szmszEllenoirzve,
    },
    exclusiveUse: {
      exists: c.property.teremgarazsTarolo,
      areaM2: "",
      mapAttachment: c.modulok.ellenorzes.terkepmasolatBeszerezve,
      foundingDeedReference: c.modulok.tarsashaz.alapitoOkiratEllenoirzve ? "alapító okirat" : "",
    },
    energyCertificate: {
      required: isResidentialProperty,
      number: c.property.energetikaiTanusitvany,
      deliveredToBuyer: c.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve,
      deliveryDate: "",
      lawyerApprovedException: false,
    },
    electricalSafety: {
      applies: isResidentialProperty,
      reviewDocumentAvailable: false,
      exceptionMarked: false,
    },
    pmt: {
      statusKnown: Boolean(pmt.azonositasModja),
      identityVerificationDone: c.modulok.ellenorzes.okmanyellenorzes,
      beneficialOwnerDone: Boolean(pmt.tenylegesTulajdonosNeve || !hasCompanyParty(c.parties)),
    },
    sanctions: {
      statusKnown: false,
      hit: false,
    },
    localMunicipalityCheck: {
      required: isResidentialProperty,
      checkedAt: "",
      sourceUrl: "",
      restrictionExists: null,
      preemptionRightExists: null,
    },
    possessionTransfer: {
      date: c.possession.datum,
      condition: c.possession.feltetel,
    },
    taxAndFees: {
      b400eStatus: b400.statusz,
      vatReviewRequired: Boolean(c.payment.afaKezeles),
    },
    documents: {
      titleDeed: c.modulok.ellenorzes.tulajdoniLapBeszerezve,
      companyExtract: c.modulok.ellenorzes.cegkivonatBeszerezve,
      powerOfAttorney: c.parties.some(
        (party): party is NaturalPerson =>
          party.kind === "termeszetes" && Boolean(party.kepviselo?.nev),
      ),
      creditorPayoffCertificates: Boolean(c.payment.tehermentesitesModja),
      energyCertificate: c.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve,
    },
    attachments: [
      c.modulok.ellenorzes.tulajdoniLapBeszerezve ? "tulajdoni lap" : "",
      c.modulok.ellenorzes.terkepmasolatBeszerezve ? "térképmásolat" : "",
      c.modulok.ellenorzes.cegkivonatBeszerezve ? "cégkivonat" : "",
      c.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve ? "energetikai tanúsítvány" : "",
    ].filter(Boolean),
  };
}

export const caseFactPredicates = {
  hasCompanyParty,
  hasForeignBuyer,
  hasMinorOrGuardianship,
};
