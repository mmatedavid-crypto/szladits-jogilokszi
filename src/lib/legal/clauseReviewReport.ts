import {
  formatReviewStatus,
  getActiveClausePairings,
  getAllLawRefs,
  type ClausePairing,
  type LawRef,
} from "./clauseMatrix";
import { generateContractDraft } from "./contract";
import { getLegalSource, isKnownLegalSourceId } from "./legalSources";
import {
  contractOutputStatusLabel,
  evaluateLegalRuleSystem,
  type LegalRuleAuditResult,
} from "./legalRules/evaluate";
import { detectMissingFields, generateCaseSummary, generateRiskFlags } from "./logic";
import type { CaseFile, MissingField, Party, RiskFlag } from "./types";

export interface ClauseReportItem {
  clause: ClausePairing;
  excerpt: string;
  inclusionReason: string;
  technicalMatch: boolean;
}

export interface ClauseReviewReport {
  title: string;
  markdown: string;
  activeClauses: ClauseReportItem[];
  missingLawRefMetadata: string[];
  hasCriticalMissingData: boolean;
  legalRuleAudit: LegalRuleAuditResult;
}

const REVIEW_REQUIRED_STATUS = "ai_prelinked_pending_lawyer_review";

function partyName(p: Party): string {
  return p.kind === "termeszetes" ? p.nev || "(név nélkül)" : p.cegnev || "(cégnév nélkül)";
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function code(s: string): string {
  return `\`${s}\``;
}

function isCriticalMissingData(missing: MissingField[]): boolean {
  const criticalGroups = new Set([
    "felek",
    "ingatlan",
    "vetelar",
    "fizetes",
    "birtokbaadas",
    "specialis_jovahagyasok",
  ]);
  return missing.some((m) => criticalGroups.has(m.group));
}

function risksBySeverity(risks: RiskFlag[], severity: RiskFlag["severity"]): RiskFlag[] {
  return risks.filter((risk) => risk.severity === severity);
}

function findExcerpt(contract: string, clause: ClausePairing): string {
  const paragraphs = contract
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const term of clause.auditTerms) {
    const found = paragraphs.find((paragraph) =>
      paragraph.toLowerCase().includes(term.toLowerCase()),
    );
    if (found) return found.slice(0, 900);
  }

  return "Nincs automatikusan azonosított szerződésbeli részlet. Ügyvédi ellenőrzés szükséges.";
}

function hasTechnicalMatch(contract: string, clause: ClausePairing): boolean {
  return clause.auditTerms.some((term) => contract.toLowerCase().includes(term.toLowerCase()));
}

function lawRefMetadataErrors(lawRef: LawRef): string[] {
  const errors: string[] = [];
  const fields: Array<keyof LawRef> = [
    "sourceId",
    "act",
    "shortName",
    "section",
    "label",
    "source",
    "sourceUrl",
    "checkedAt",
    "effectiveDateBasis",
    "verificationStatus",
  ];

  for (const field of fields) {
    if (!String(lawRef[field] ?? "").trim())
      errors.push(`${lawRef.shortName || "(nincs rövid név)"}: ${field}`);
  }
  if (lawRef.source !== "NJT") errors.push(`${lawRef.shortName}: source`);
  if (!lawRef.sourceUrl.startsWith("https://njt.hu/")) {
    errors.push(`${lawRef.shortName}: sourceUrl`);
  }
  if (!isKnownLegalSourceId(lawRef.sourceId)) {
    errors.push(`${lawRef.shortName}: unknown sourceId`);
  } else {
    const legalSource = getLegalSource(lawRef.sourceId);
    if (lawRef.act !== legalSource.act) errors.push(`${lawRef.shortName}: act != legalSource`);
    if (lawRef.shortName !== legalSource.shortName)
      errors.push(`${lawRef.shortName}: shortName != legalSource`);
    if (lawRef.sourceUrl !== legalSource.sourceUrl)
      errors.push(`${lawRef.shortName}: sourceUrl != legalSource`);
    if (lawRef.checkedAt !== legalSource.checkedAt)
      errors.push(`${lawRef.shortName}: checkedAt != legalSource`);
  }
  if (lawRef.verificationStatus !== REVIEW_REQUIRED_STATUS) {
    errors.push(`${lawRef.shortName}: verificationStatus`);
  }
  return errors;
}

function lawRefBlock(lawRef: LawRef): string {
  return [
    "```ts",
    "lawRef: {",
    `  sourceId: ${JSON.stringify(lawRef.sourceId)},`,
    `  act: ${JSON.stringify(lawRef.act)},`,
    `  shortName: ${JSON.stringify(lawRef.shortName)},`,
    `  section: ${JSON.stringify(lawRef.section)},`,
    `  label: ${JSON.stringify(lawRef.label)},`,
    `  source: ${JSON.stringify(lawRef.source)},`,
    `  sourceUrl: ${JSON.stringify(lawRef.sourceUrl)},`,
    `  checkedAt: ${JSON.stringify(lawRef.checkedAt)},`,
    `  effectiveDateBasis: ${JSON.stringify(lawRef.effectiveDateBasis)},`,
    `  verificationStatus: ${JSON.stringify(lawRef.verificationStatus)}`,
    "}",
    "```",
  ].join("\n");
}

function lawRefSummary(lawRef: LawRef): string[] {
  return [
    `- Forrásazonosító: ${lawRef.sourceId}`,
    `- Rövid név: ${lawRef.shortName}`,
    `- Törvény/rendelet: ${lawRef.act}`,
    `- Szakasz / kapcsolódás: ${lawRef.section}`,
    `- Címke: ${lawRef.label}`,
    `- Forrás: ${lawRef.source}`,
    `- NJT: ${lawRef.sourceUrl}`,
    `- Ellenőrzési dátum: ${lawRef.checkedAt}`,
    `- Verifikációs státusz: ${lawRef.verificationStatus}`,
  ];
}

export function generateClauseReviewReport(c: CaseFile): ClauseReviewReport {
  const contract = generateContractDraft(c);
  const legalRuleAudit = evaluateLegalRuleSystem(c, contract);
  const risks = generateRiskFlags(c);
  const missing = detectMissingFields(c);
  const activePairings = getActiveClausePairings(c);
  const hasCriticalMissing =
    isCriticalMissingData(missing) || legalRuleAudit.outputStatus === "HIANYOS_TERVEZET";
  const titlePrefix = hasCriticalMissing ? "HIANYOS-TERVEZET - " : "";
  const title = `${titlePrefix}Ügyvédi klauzula review report`;

  const activeClauses: ClauseReportItem[] = activePairings.map((clause) => ({
    clause,
    excerpt: findExcerpt(contract, clause),
    inclusionReason: `${clause.triggerLeiras}; technikai egyezés: ${clause.auditTerms
      .map(code)
      .join(", ")}`,
    technicalMatch: hasTechnicalMatch(contract, clause),
  }));

  const missingLawRefMetadata = activePairings.flatMap((clause) =>
    getAllLawRefs(clause).flatMap((lawRef) =>
      lawRefMetadataErrors(lawRef).map((error) => `${clause.id}: ${error}`),
    ),
  );

  const eladok = c.parties.filter((p) => p.szerep === "elado").map(partyName);
  const vevok = c.parties.filter((p) => p.szerep === "vevo").map(partyName);
  const criticalCount = risksBySeverity(risks, "kritikus").length;
  const highCount = risksBySeverity(risks, "magas").length;
  const mediumCount = risksBySeverity(risks, "kozepes").length;
  const blockingClauses = activeClauses.filter(
    (item) =>
      item.clause.riskLevel === "kritikus" || item.clause.reviewStatus === "blocked_missing_data",
  ).length;

  const lines: string[] = [
    `# ${title}`,
    "",
    "## Ügy összefoglaló",
    "",
    `- Ügy neve: ${c.cimke || c.ugyAzonosito || "Névtelen ügy"}`,
    `- Ügyazonosító: ${c.ugyAzonosito || "—"}`,
    `- Ingatlan: ${
      [
        c.property.iranyitoszam,
        c.property.telepules,
        c.property.cim,
        c.property.helyrajziSzam ? `(hrsz.: ${c.property.helyrajziSzam})` : "",
      ]
        .filter(Boolean)
        .join(" ") || "—"
    }`,
    `- Eladó(k): ${eladok.join(", ") || "—"}`,
    `- Vevő(k): ${vevok.join(", ") || "—"}`,
    `- Generálás időpontja: ${new Date().toLocaleString("hu-HU")}`,
    `- Tervezet státusza: ${legalRuleAudit.outputStatus} — ${contractOutputStatusLabel(legalRuleAudit.outputStatus)}`,
    `- Figyelmeztetések: kritikus ${criticalCount}, magas ${highCount}, közepes ${mediumCount}`,
    "",
    "## Aktív jogi szabályok",
    "",
    ...legalRuleAudit.activeRules.flatMap((item) => [
      `### ${item.rule.id} — ${item.rule.title}`,
      "",
      "- Miért aktív? Determinisztikus appliesWhen feltétel teljesült; technikai egyezés.",
      `- Kockázati szint: ${item.rule.riskLevel}`,
      `- Szabály review státusz: ${item.rule.reviewStatus}`,
      `- Blokkoló feltétel: ${item.blocking ? "igen" : "nem"}`,
      `- Jogforrás-kapcsolódások: ${item.rule.sourceRefs
        .map((sourceRef) => {
          const source = getLegalSource(sourceRef);
          return `${sourceRef} (${source.sourceUrl}; ${source.verificationStatus})`;
        })
        .join("; ")}`,
      `- Szükséges tények: ${item.rule.requiredFacts.map(code).join(", ") || "—"}`,
      `- Hiányzó tények: ${item.missingFacts.map(code).join(", ") || "—"}`,
      `- Szükséges klauzulák: ${
        item.requiredClauseStatuses
          .map(
            (clause) => `${clause.clauseId} (${clause.found ? clause.reviewStatus : "hiányzik"})`,
          )
          .join(", ") || "—"
      }`,
      "",
      "Ügyvédi review kérdések:",
      "",
      ...(item.rule.auditQuestions.length
        ? item.rule.auditQuestions.map((question) => `- ${question}`)
        : ["- —"]),
      "",
    ]),
    "## Hiányzó kritikus adatok",
    "",
    ...(legalRuleAudit.missingCriticalFacts.length
      ? legalRuleAudit.missingCriticalFacts.map((field) => `- ${field}`)
      : ["- Nincs azonosított kritikus hiány a szabálymotor szerint."]),
    "",
    "## Blokkoló feltételek",
    "",
    ...(legalRuleAudit.blockingConditions.length
      ? legalRuleAudit.blockingConditions.map((condition) => `- ${condition}`)
      : ["- Nincs aktív blokkoló feltétel."]),
    "",
    "## Aktív klauzulák",
    "",
  ];

  activeClauses.forEach((item, index) => {
    const { clause } = item;
    lines.push(
      `### ${index + 1}. ${clause.cim}`,
      "",
      `- Klauzula: ${clause.cim}`,
      `- Miért került bele? ${clause.triggerLeiras}`,
      `- Trigger: ${code(clause.triggerLeiras)}`,
      `- Technikai inclusion reason: ${item.inclusionReason}`,
      `- Technikai egyezés: ${item.technicalMatch ? "igen" : "nem"}`,
      `- Kockázati szint: ${clause.riskLevel}`,
      `- Ügyvédi review státusz: ${formatReviewStatus(clause.reviewStatus)}`,
      "",
      "Szerződésbeli részlet:",
      "",
      "```text",
      item.excerpt,
      "```",
      "",
      "Jogszabályi kapcsolódás:",
      "",
      ...lawRefSummary(clause.lawRef),
      "",
      lawRefBlock(clause.lawRef),
    );

    const related = clause.relatedLawRefs ?? [];
    if (related.length > 0) {
      lines.push("", "Kapcsolódó előpárosított hivatkozások:", "");
      related.forEach((lawRef) => {
        lines.push(
          `- ${lawRef.shortName} ${lawRef.section} – ${lawRef.label} (${lawRef.sourceUrl})`,
        );
      });
    }

    lines.push("", "Ügyvédi kérdések:", "");
    clause.ugyvediKerdesek.forEach((question) => lines.push(`- ${question}`));
    lines.push("");
  });

  lines.push("## Red flags", "");
  (["kritikus", "magas", "kozepes"] as const).forEach((severity) => {
    lines.push(`### ${severity}`);
    const items = risksBySeverity(risks, severity);
    if (items.length === 0) lines.push("- Nincs azonosított pont.");
    items.forEach((risk) =>
      lines.push(`- ${escapeMd(risk.cim)}: ${risk.severity} – ${escapeMd(risk.ellenorizendo)}`),
    );
    lines.push("");
  });

  lines.push("## Hiányzó adatok", "");
  if (missing.length === 0) {
    lines.push("- Nincs azonosított hiányzó adat.");
  } else {
    missing.forEach((m) =>
      lines.push(`- ${m.group}: ${m.field}${m.reszlet ? ` – ${m.reszlet}` : ""}`),
    );
  }
  lines.push("");

  const clausesRequiringDecision = activeClauses.filter(
    (item) => item.clause.reviewStatus !== "lawyer_approved",
  ).length;

  lines.push(
    "## Review summary",
    "",
    `- Total active clauses: ${activeClauses.length}`,
    `- Total lawRef-linked clauses: ${activeClauses.filter((item) => item.clause.lawRef).length}`,
    `- Clauses missing lawRef metadata: ${missingLawRefMetadata.length}`,
    `- Clauses requiring lawyer decision: ${clausesRequiringDecision}`,
    `- Clauses that should block finalization: ${hasCriticalMissing ? blockingClauses + missing.length : blockingClauses}`,
    `- Determinisztikus aktív szabályok: ${legalRuleAudit.activeRules.length}`,
    `- Aktív klauzulasablonok: ${legalRuleAudit.activeClauses.length}`,
    `- Unresolved placeholders: ${legalRuleAudit.unresolvedPlaceholders.length}`,
    `- Consistency issues: ${legalRuleAudit.consistencyIssues.length}`,
    `- Final output status: ${legalRuleAudit.outputStatus}`,
    "",
    "Megjegyzés: a fenti elemek előpárosított hivatkozások és jogszabályi kapcsolódások. A hatály és az ügyre alkalmazhatóság ügyvédi ellenőrzést igényel.",
    "",
    "## Ügyleti összefoglaló technikai kontextus",
    "",
    "```text",
    generateCaseSummary(c),
    "```",
  );

  return {
    title,
    markdown: lines.join("\n"),
    activeClauses,
    missingLawRefMetadata,
    hasCriticalMissingData: hasCriticalMissing,
    legalRuleAudit,
  };
}
