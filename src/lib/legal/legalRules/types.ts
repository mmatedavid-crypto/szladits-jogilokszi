import type { CaseFile, Party, Property } from "../types";

export type RuleReviewStatus =
  | "ai_extracted"
  | "lawyer_review_required"
  | "lawyer_approved"
  | "needs_update"
  | "disabled";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ContractOutputStatus =
  | "HIANYOS_TERVEZET"
  | "UGYVEDI_REVIEW_SZUKSEGES"
  | "UGYVED_ALTAL_JOVAHAGYOTT_TERVEZET";

export type ReferencedClauseReviewStatus =
  | "draft_from_lawyer_sample"
  | "ai_extracted"
  | "lawyer_review_required"
  | "lawyer_approved"
  | "needs_update"
  | "disabled";

export type RequiredClauseRef = {
  clauseId: string;
  minReviewStatus: "lawyer_approved";
  blocksFinalizationIfMissing: boolean;
};

export type CaseFacts = {
  caseFile: CaseFile;
  transactionType: "real_estate_sale" | "farmland_sale" | "unknown";
  parties: Party[];
  seller: Party[];
  buyer: Party[];
  representatives: Array<{ partyId: string; partyName: string; exists: boolean }>;
  property: Property & {
    isCondominium: boolean;
    isResidential: boolean;
    isFarmlandLike: boolean;
  };
  titleDeed: {
    checkedAt: string;
    source: string;
    encumbranceEntries: string[];
    szeljegyStatus: string;
  };
  encumbrances: {
    exists: boolean;
    mortgage: boolean;
    independentLien: boolean;
    prohibition: boolean;
    enforcement: boolean;
    usufruct: boolean;
    easement: boolean;
    litigation: boolean;
    pendingNote: boolean;
    cleanupStrategy: string;
    creditorStatementAvailable: boolean;
  };
  purchasePrice: number;
  paymentPlan: {
    currency: string;
    ownFunds: number;
    bankLoanAmount: number;
    otherFundingAmount: number;
    componentsTotal: number;
    disbursementDeadline: string;
  };
  deposit: {
    exists: boolean;
    amount: number;
    alreadyPaidAmount: number;
    remainingAmount: number;
    paymentMethod: string;
    deadline: string;
  };
  bankFinancing: {
    used: boolean;
    bankName: string;
    amount: number;
    disbursementDeadline: string;
  };
  stateSubsidies: {
    csokPlusz: { used: boolean; amount: number; bank: string; stateLienExpected: boolean };
    otthonStart: { used: boolean; amount: number; bank: string };
  };
  csok: { used: boolean; amount: number };
  otthonStart: { used: boolean; amount: number };
  greenLoan: { used: boolean; amount: number; bank: string; energyCondition: string };
  registrationConsent: {
    exists: boolean;
    heldInEscrow: boolean;
    releaseConditions: string;
  };
  escrow: {
    used: boolean;
    lawyerName: string;
    kasz: string;
    originalCopies: string;
    releaseConditions: string;
  };
  condominium: {
    isCondominium: boolean;
    foundingDeedReviewed: boolean;
    condominiumShare: string;
    szmszReviewed: boolean;
  };
  exclusiveUse: {
    exists: boolean;
    areaM2: string;
    mapAttachment: boolean;
    foundingDeedReference: string;
  };
  energyCertificate: {
    required: boolean;
    number: string;
    deliveredToBuyer: boolean;
    deliveryDate: string;
    lawyerApprovedException: boolean;
  };
  electricalSafety: {
    applies: boolean;
    reviewDocumentAvailable: boolean;
    exceptionMarked: boolean;
  };
  pmt: {
    statusKnown: boolean;
    identityVerificationDone: boolean;
    beneficialOwnerDone: boolean;
  };
  sanctions: {
    statusKnown: boolean;
    hit: boolean;
  };
  localMunicipalityCheck: {
    required: boolean;
    checkedAt: string;
    sourceUrl: string;
    restrictionExists: boolean | null;
    preemptionRightExists: boolean | null;
  };
  possessionTransfer: {
    date: string;
    condition: string;
  };
  taxAndFees: {
    b400eStatus: string;
    vatReviewRequired: boolean;
  };
  documents: {
    titleDeed: boolean;
    companyExtract: boolean;
    powerOfAttorney: boolean;
    creditorPayoffCertificates: boolean;
    energyCertificate: boolean;
  };
  attachments: string[];
};

export type LegalRule = {
  id: string;
  title: string;
  sourceRefs: string[];
  appliesWhen: (facts: CaseFacts) => boolean;
  requiredFacts: string[];
  requiredClauses: RequiredClauseRef[];
  riskLevel: RiskLevel;
  blocksFinalizationWhen?: (facts: CaseFacts) => boolean;
  auditQuestions: string[];
  reviewStatus: RuleReviewStatus;
  notes?: string;
};

export type ActiveRuleResult = {
  rule: LegalRule;
  missingFacts: string[];
  blocking: boolean;
  requiredClauseStatuses: Array<{
    clauseId: string;
    found: boolean;
    reviewStatus?: ReferencedClauseReviewStatus;
    blocksFinalizationIfMissing: boolean;
  }>;
};
