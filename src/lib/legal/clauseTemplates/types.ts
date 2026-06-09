import type { CaseFacts, RiskLevel } from "../legalRules/types";

export type ClauseReviewStatus =
  | "draft_from_lawyer_sample"
  | "ai_extracted"
  | "lawyer_review_required"
  | "lawyer_approved"
  | "needs_update"
  | "disabled";

export type ClauseTemplate = {
  id: string;
  title: string;
  bodyTemplate: string;
  placeholders: string[];
  requiredFacts: string[];
  sourceRefs: string[];
  appliesWhen: (facts: CaseFacts) => boolean;
  riskLevel: RiskLevel;
  reviewStatus: ClauseReviewStatus;
  derivedFrom?: string[];
  auditTags?: string[];
};
