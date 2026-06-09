const PLACEHOLDER_PATTERNS: Array<{ id: string; pattern: RegExp; label: string }> = [
  {
    id: "bracket-placeholder",
    pattern: /\[[^\]\n]{1,120}\]/g,
    label: "Szögletes zárójeles placeholder",
  },
  { id: "ellipsis", pattern: /…|\.{3,}/g, label: "Kitöltetlen pontozás" },
  { id: "cash-or-transfer", pattern: /átutalás vagy kp\?/gi, label: "Nyitott fizetési mód" },
  { id: "todo", pattern: /\bTODO\b|\bFIXME\b/gi, label: "TODO/FIXME maradvány" },
  { id: "empty-date", pattern: /____\.\s*__\.\s*__/g, label: "Üres dátum" },
  { id: "generic-empty", pattern: /_{4,}/g, label: "Üres aláírási vagy kitöltési mező" },
  {
    id: "party-placeholder",
    pattern: /\[(ELADÓ|VEVŐ|ÜGYVÉD|MEGHATALMAZOTT)[^\]]*\]/gi,
    label: "Félre vagy ügyvédre mutató placeholder",
  },
  {
    id: "approx-amount",
    pattern: /\bkb\.\s*\d[\d\s.]*/gi,
    label: "Kb. jelölés joghatású összeg környezetében",
  },
];

export type PlaceholderIssue = {
  id: string;
  label: string;
  match: string;
  index: number;
};

export function detectUnresolvedPlaceholders(text: string): PlaceholderIssue[] {
  const issues: PlaceholderIssue[] = [];

  for (const detector of PLACEHOLDER_PATTERNS) {
    for (const match of text.matchAll(detector.pattern)) {
      issues.push({
        id: detector.id,
        label: detector.label,
        match: match[0],
        index: match.index ?? 0,
      });
    }
  }

  return issues;
}
