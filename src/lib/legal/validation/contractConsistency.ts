import type { CaseFacts } from "../legalRules/types";

export type ContractConsistencyIssue = {
  id: string;
  severity: "medium" | "high" | "critical";
  message: string;
};

const almostEqual = (a: number, b: number): boolean => Math.abs(a - b) < 1;

function parseFraction(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : numerator / denominator;
  }
  const decimal = Number(normalized.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

export function validateContractConsistency(facts: CaseFacts): ContractConsistencyIssue[] {
  const issues: ContractConsistencyIssue[] = [];

  if (
    facts.purchasePrice > 0 &&
    !almostEqual(facts.paymentPlan.componentsTotal, facts.purchasePrice)
  ) {
    issues.push({
      id: "payment-components-total",
      severity: "critical",
      message: "A fizetési komponensek összege nem egyezik a teljes vételárral.",
    });
  }

  const buyerShares = facts.buyer
    .map((party) => parseFraction(party.tulajdoniHanyad ?? ""))
    .filter((share): share is number => share !== null);
  if (facts.buyer.length > 0 && buyerShares.length === facts.buyer.length) {
    const shareTotal = buyerShares.reduce((sum, share) => sum + share, 0);
    if (!almostEqual(shareTotal, 1)) {
      issues.push({
        id: "buyer-ownership-shares",
        severity: "critical",
        message: "A vevői tulajdoni hányadok összege nem 1/1.",
      });
    }
  } else if (facts.buyer.length > 0) {
    issues.push({
      id: "buyer-ownership-shares-missing",
      severity: "critical",
      message: "Nem minden vevőnél szerepel értelmezhető tulajdoni hányad.",
    });
  }

  if (facts.deposit.exists) {
    if (
      !almostEqual(
        facts.deposit.alreadyPaidAmount + facts.deposit.remainingAmount,
        facts.deposit.amount,
      )
    ) {
      issues.push({
        id: "deposit-sum",
        severity: "critical",
        message: "A megfizetett és fennmaradó foglaló összege nem egyezik a teljes foglalóval.",
      });
    }
    if (facts.deposit.amount > facts.purchasePrice) {
      issues.push({
        id: "deposit-in-purchase-price",
        severity: "critical",
        message:
          "A foglaló összege meghaladja a vételárat, ezért nem kezelhető a vételár részeként.",
      });
    }
  }

  if (facts.encumbrances.exists && !facts.encumbrances.cleanupStrategy) {
    issues.push({
      id: "encumbrance-cleanup",
      severity: "critical",
      message: "Teherrel érintett ingatlannál hiányzik a tehermentesítési stratégia.",
    });
  }

  if (facts.encumbrances.mortgage && !facts.encumbrances.creditorStatementAvailable) {
    issues.push({
      id: "mortgage-creditor-statement",
      severity: "critical",
      message: "Jelzálog/önálló zálogjog esetén hiányzik a jogosulti igazolás státusza.",
    });
  }

  if (facts.bankFinancing.used && !facts.bankFinancing.disbursementDeadline) {
    issues.push({
      id: "bank-disbursement-deadline",
      severity: "critical",
      message: "Banki finanszírozásnál hiányzik a folyósítási határidő.",
    });
  }

  if (facts.purchasePrice > facts.paymentPlan.ownFunds && !facts.registrationConsent.heldInEscrow) {
    issues.push({
      id: "escrow-required",
      severity: "critical",
      message:
        "Ha a teljes vételár nem aláíráskor teljesül, a bejegyzési engedély/letéti logika nem hiányozhat.",
    });
  }

  if (facts.representatives.some((rep) => rep.exists) && !facts.documents.powerOfAttorney) {
    issues.push({
      id: "power-of-attorney-attachment",
      severity: "critical",
      message: "Meghatalmazotti eljárásnál a meghatalmazás mellékletként nem igazolt.",
    });
  }

  if (facts.condominium.isCondominium && !facts.condominium.foundingDeedReviewed) {
    issues.push({
      id: "condominium-founding-deed",
      severity: "critical",
      message: "Társasházi albetétnél az alapító okirat ellenőrzése hiányzik.",
    });
  }

  if (
    facts.exclusiveUse.exists &&
    (!facts.exclusiveUse.mapAttachment || !facts.exclusiveUse.foundingDeedReference)
  ) {
    issues.push({
      id: "exclusive-use-attachments",
      severity: "critical",
      message: "Kizárólagos használatnál hiányzik a térkép vagy az alapító okirati hivatkozás.",
    });
  }

  if (
    facts.energyCertificate.required &&
    !facts.energyCertificate.lawyerApprovedException &&
    (!facts.energyCertificate.number || !facts.energyCertificate.deliveredToBuyer)
  ) {
    issues.push({
      id: "energy-certificate",
      severity: "high",
      message: "Lakóingatlannál hiányzik az energetikai tanúsítvány száma vagy átadási státusza.",
    });
  }

  if (
    facts.localMunicipalityCheck.required &&
    (!facts.localMunicipalityCheck.checkedAt || !facts.localMunicipalityCheck.sourceUrl)
  ) {
    issues.push({
      id: "local-municipality-check",
      severity: "critical",
      message:
        "Hiányzik az önkormányzati/helyi önazonossági korlátozás ellenőrzési dátuma vagy forrása.",
    });
  }

  return issues;
}
