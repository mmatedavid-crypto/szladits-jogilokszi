import { realEstateSaleClauseTemplates } from "../clauseTemplates/realEstateSale";
import type { ClauseTemplate } from "../clauseTemplates/types";
import { generateContractDraft } from "../contract";
import { getLegalSource, isKnownLegalSourceId } from "../legalSources";
import type { CaseFile } from "../types";
import {
  validateContractConsistency,
  type ContractConsistencyIssue,
} from "../validation/contractConsistency";
import { detectUnresolvedPlaceholders, type PlaceholderIssue } from "../validation/placeholders";
import { caseFactsFromCaseFile } from "./caseFacts";
import { realEstateSaleRules } from "./realEstateSale";
import type { ActiveRuleResult, CaseFacts, ContractOutputStatus, LegalRule } from "./types";

export type LegalRuleAuditResult = {
  facts: CaseFacts;
  activeRules: ActiveRuleResult[];
  activeClauses: ClauseTemplate[];
  missingCriticalFacts: string[];
  blockingConditions: string[];
  unresolvedPlaceholders: PlaceholderIssue[];
  consistencyIssues: ContractConsistencyIssue[];
  sourceIssues: string[];
  outputStatus: ContractOutputStatus;
  contract: string;
};

export function contractOutputStatusLabel(status: ContractOutputStatus): string {
  switch (status) {
    case "HIANYOS_TERVEZET":
      return "HIÁNYOS TERVEZET – ÜGYVÉDI ELLENŐRZÉS SZÜKSÉGES";
    case "UGYVEDI_REVIEW_SZUKSEGES":
      return "TERVEZET – ÜGYVÉDI ELLENŐRZÉSRE";
    case "UGYVED_ALTAL_JOVAHAGYOTT_TERVEZET":
      return "ÜGYVÉD ÁLTAL JÓVÁHAGYOTT TERVEZET";
  }
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (value == null) return undefined;
    if (Array.isArray(value) && part === "length") return value.length;
    if (typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

function hasFact(facts: CaseFacts, path: string): boolean {
  const value = readPath(facts, path);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  return value != null;
}

function safeAppliesWhen(rule: LegalRule, facts: CaseFacts): boolean {
  try {
    return rule.reviewStatus !== "disabled" && rule.appliesWhen(facts);
  } catch {
    return false;
  }
}

function safeClauseAppliesWhen(template: ClauseTemplate, facts: CaseFacts): boolean {
  try {
    return template.reviewStatus !== "disabled" && template.appliesWhen(facts);
  } catch {
    return false;
  }
}

function validateSourceRefs(ownerId: string, sourceRefs: string[]): string[] {
  if (sourceRefs.length === 0) return [`${ownerId}: hiányzó sourceRefs`];
  return sourceRefs.flatMap((sourceRef) => {
    if (!isKnownLegalSourceId(sourceRef))
      return [`${ownerId}: ismeretlen sourceRef (${sourceRef})`];
    const source = getLegalSource(sourceRef);
    const missing = [
      !source.id && "id",
      !source.title && "title",
      !source.sourceUrl && "sourceUrl",
      !source.sourceType && "sourceType",
      !source.verificationStatus && "verificationStatus",
    ].filter(Boolean);
    return missing.map((field) => `${ownerId}: hiányos jogforrás metadata (${sourceRef}.${field})`);
  });
}

export function evaluateLegalRuleSystem(c: CaseFile, contractText?: string): LegalRuleAuditResult {
  const facts = caseFactsFromCaseFile(c);
  const activeClauses = realEstateSaleClauseTemplates.filter((template) =>
    safeClauseAppliesWhen(template, facts),
  );
  const activeClauseById = new Map(activeClauses.map((template) => [template.id, template]));

  const activeRules: ActiveRuleResult[] = realEstateSaleRules
    .filter((rule) => safeAppliesWhen(rule, facts))
    .map((rule) => {
      const missingFacts = rule.requiredFacts.filter((path) => !hasFact(facts, path));
      const requiredClauseStatuses = rule.requiredClauses.map((requiredClause) => {
        const clause = activeClauseById.get(requiredClause.clauseId);
        return {
          clauseId: requiredClause.clauseId,
          found: Boolean(clause),
          reviewStatus: clause?.reviewStatus,
          blocksFinalizationIfMissing: requiredClause.blocksFinalizationIfMissing,
        };
      });
      return {
        rule,
        missingFacts,
        blocking: Boolean(rule.blocksFinalizationWhen?.(facts)),
        requiredClauseStatuses,
      };
    });

  const contract = contractText ?? generateContractDraft(c);
  const unresolvedPlaceholders = detectUnresolvedPlaceholders(contract);
  const consistencyIssues = validateContractConsistency(facts);
  const sourceIssues = [
    ...realEstateSaleRules.flatMap((rule) =>
      validateSourceRefs(`rule:${rule.id}`, rule.sourceRefs),
    ),
    ...realEstateSaleClauseTemplates.flatMap((template) =>
      validateSourceRefs(`clause:${template.id}`, template.sourceRefs),
    ),
  ];
  const missingCriticalFacts = activeRules
    .filter((item) => item.rule.riskLevel === "critical")
    .flatMap((item) => item.missingFacts.map((fact) => `${item.rule.id}.${fact}`));
  const blockingConditions = activeRules
    .filter((item) => item.blocking)
    .map((item) => `${item.rule.id}: ${item.rule.title}`);
  const criticalReviewRequired = activeRules.some(
    (item) => item.rule.riskLevel === "critical" && item.rule.reviewStatus !== "lawyer_approved",
  );
  const criticalClauseReviewRequired = activeRules.some((item) =>
    item.requiredClauseStatuses.some(
      (clause) =>
        clause.blocksFinalizationIfMissing &&
        (!clause.found || clause.reviewStatus !== "lawyer_approved"),
    ),
  );

  let outputStatus: ContractOutputStatus = "UGYVED_ALTAL_JOVAHAGYOTT_TERVEZET";
  if (
    blockingConditions.length > 0 ||
    missingCriticalFacts.length > 0 ||
    unresolvedPlaceholders.length > 0 ||
    consistencyIssues.some((issue) => issue.severity === "critical") ||
    sourceIssues.length > 0
  ) {
    outputStatus = "HIANYOS_TERVEZET";
  } else if (criticalReviewRequired || criticalClauseReviewRequired) {
    outputStatus = "UGYVEDI_REVIEW_SZUKSEGES";
  }

  return {
    facts,
    activeRules,
    activeClauses,
    missingCriticalFacts,
    blockingConditions,
    unresolvedPlaceholders,
    consistencyIssues,
    sourceIssues,
    outputStatus,
    contract,
  };
}
