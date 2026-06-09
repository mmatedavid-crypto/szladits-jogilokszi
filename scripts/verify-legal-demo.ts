import { generateContractDraft } from "../src/lib/legal/contract";
import { generateB400EBeadasiCsomag } from "../src/lib/legal/b400eSubmission";
import { MANDATORY_INYTV_AUDIT_TERMS } from "../src/lib/legal/inytvRules";
import {
  formatReviewStatus,
  getActiveClausePairings,
  getAllLawRefs,
  type LawRef,
} from "../src/lib/legal/clauseMatrix";
import { generateClauseReviewReport } from "../src/lib/legal/clauseReviewReport";
import { realEstateSaleClauseTemplates } from "../src/lib/legal/clauseTemplates/realEstateSale";
import {
  getLegalSource,
  isKnownLegalSourceId,
  listLegalSources,
} from "../src/lib/legal/legalSources";
import { evaluateLegalRuleSystem } from "../src/lib/legal/legalRules/evaluate";
import { realEstateSaleRules } from "../src/lib/legal/legalRules/realEstateSale";
import { generateRiskFlags } from "../src/lib/legal/logic";
import { demoCase, emptyCase, newId } from "../src/lib/legal/state";
import type { CaseFile, NaturalPerson } from "../src/lib/legal/types";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Check = {
  id: string;
  label: string;
  test: (ctx: AuditContext) => boolean;
};

type Scenario = {
  id: string;
  label: string;
  caseFile: CaseFile;
  required: Check[];
  notes?: string[];
};

type AuditContext = {
  contract: string;
  risks: ReturnType<typeof generateRiskFlags>;
};

const contains = (needle: string): Check => ({
  id: `contains:${needle}`,
  label: `Tartalmazza: "${needle}"`,
  test: ({ contract }) => contract.toLowerCase().includes(needle.toLowerCase()),
});

const riskContains = (needle: string): Check => ({
  id: `risk:${needle}`,
  label: `Kockázati lista tartalmazza: "${needle}"`,
  test: ({ risks }) =>
    risks.some((risk) =>
      `${risk.cim} ${risk.miert} ${risk.ellenorizendo}`
        .toLowerCase()
        .includes(needle.toLowerCase()),
    ),
});

const noFinalClaim: Check = {
  id: "no-final-claim",
  label: "Nem állítja, hogy ügyvédi ellenőrzés nélkül végleges/felhasználható",
  test: ({ contract }) => {
    const forbidden = [
      "ügyvédi felülvizsgálat nélkül használható",
      "ellenjegyzés nélkül használható",
      "végleges szerződés",
    ];
    return !forbidden.some((text) => contract.toLowerCase().includes(text));
  },
};

const hasDraftSafeguards: Check[] = [
  contains("TERVEZET"),
  contains("ügyvédi ellenőrzés"),
  contains("ÜGYVÉDI ELLENJEGYZÉS"),
  contains("ellenjegyzés nélkül nem használható"),
  noFinalClaim,
];

function cloneCase(c: CaseFile): CaseFile {
  return JSON.parse(JSON.stringify(c)) as CaseFile;
}

function firstNatural(c: CaseFile, role: "elado" | "vevo"): NaturalPerson {
  const party = c.parties.find(
    (p): p is NaturalPerson => p.kind === "termeszetes" && p.szerep === role,
  );
  if (!party) throw new Error(`Missing natural person for role: ${role}`);
  return party;
}

function standardCase(): CaseFile {
  return demoCase();
}

function agriculturalCase(variant: "sima" | "biztonsagi_okmany"): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = variant === "sima" ? "DEMO-FOLD-SIMA" : "DEMO-FOLD-ZOLD";
  c.transactionTypes = ["termofold"];
  c.property.ingatlanTipus = "szántó";
  c.property.muvelesiAg = "szántó";
  c.special.foldforgalmi = {
    ...c.special.foldforgalmi,
    fold: true,
    muvelesiAg: "szántó",
    vevoFoldmuves: true,
    vevoHelybenLako: true,
    elovasarlasErintett: true,
    kifuggesztes: true,
    hatosagiJovahagyas: true,
    tulajdonszerzesiKorlat: true,
    nyilatkozatok: true,
    nyomtatasiValtozat: variant,
    biztonsagiOkmanySorszam: variant === "biztonsagi_okmany" ? "AB 1234567" : "",
    biztonsagiOkmanyKiallito: variant === "biztonsagi_okmany" ? "Pénzjegynyomda" : "",
  };
  return c;
}

function minorBuyerCase(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "DEMO-KISKORU-VEVO";
  const buyer = firstNatural(c, "vevo");
  buyer.nev = "Szabó Bence";
  buyer.szuletesiDatum = "2015-01-10";
  buyer.kepviselo = {
    nev: "Szabó Anna",
    minoseg: "szülő",
    lakcim: "4024 Debrecen, Piac utca 5.",
    azonosito: "654321CD",
    hatarozat: "",
  };
  return c;
}

function restrictedAdultBuyerCase(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "VALIDACIO-GONDNOKOLT-VEVO";
  const buyer = firstNatural(c, "vevo");
  buyer.nev = "Kovács Júlia";
  buyer.szuletesiDatum = "1980-02-12";
  buyer.capacityOverride = "gondnokkal";
  buyer.kepviselo = undefined;
  return c;
}

function foreignBuyerCase(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "DEMO-KULFOLDI-VEVO";
  const buyer = firstNatural(c, "vevo");
  buyer.allampolgarsag = "német";
  return c;
}

function companySellerCase(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "DEMO-CEGES-ELADO";
  c.parties = [
    {
      kind: "ceg",
      id: newId("c"),
      szerep: "elado",
      cegnev: "Eladó Ingatlan Kft.",
      cegjegyzekszam: "01-09-999999",
      adoszam: "99999999-2-41",
      szekhely: "1051 Budapest, Minta utca 1.",
      kepviseloNeve: "Minta Márton ügyvezető",
      kepviseletModja: "önálló",
      cegkivonatDatuma: "2026-06-01",
      alairasiCimpeldanySzukseges: true,
      tulajdoniHanyad: "1/1",
      kulfoldiSzekhely: false,
    },
    ...c.parties.filter((party) => party.szerep === "vevo"),
  ];
  return c;
}

function incompleteCase(): CaseFile {
  const c = emptyCase();
  c.ugyAzonosito = "VALIDACIO-HIANYOS";
  return c;
}

function privateBasicFlatSaleNoLoan(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "SZABALY-PRIVAT-LAKAS";
  c.payment.bankhitelVan = false;
  c.payment.hitelOsszeg = "";
  c.payment.bankNeve = "";
  c.payment.ugyvediLetet = false;
  c.payment.fizetesiUtemezes = "A teljes vételár aláíráskor átutalással teljesül.";
  return c;
}

function mortgagedPropertySale(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "SZABALY-JELZALOG";
  c.property.encumbrances.jelzalog = true;
  c.property.encumbrances.elidegenitesiTilalom = true;
  c.payment.tehermentesitesModja = "Jogosulti igazolás alapján közvetlen banki kifizetés.";
  return c;
}

function csokPluszSale(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "SZABALY-CSOK-PLUSZ";
  c.modulok.b400.illetekkedvezmenyKod = "csok_plus";
  return c;
}

function localMunicipalityRestrictionUnknown(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "SZABALY-HELYI-ELLENORZES-HIANYZIK";
  c.property.tarsashaziAlbetet = true;
  return c;
}

function condominiumExclusiveUseMissingMap(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "SZABALY-KIZAROLAGOS-HASZNALAT-HIANYOS";
  c.property.tarsashaziAlbetet = true;
  c.property.teremgarazsTarolo = true;
  c.modulok.ellenorzes.terkepmasolatBeszerezve = false;
  c.modulok.tarsashaz.alapitoOkiratEllenoirzve = false;
  return c;
}

function lawyerSampleCondominiumBankFinancedSale(): CaseFile {
  const c = cloneCase(demoCase());
  c.ugyAzonosito = "LAWYER-SAMPLE-CONDO-BANK";
  c.property.tarsashaziAlbetet = true;
  c.property.teremgarazsTarolo = true;
  c.property.encumbrances.jelzalog = true;
  c.property.encumbrances.elidegenitesiTilalom = true;
  c.property.tehermentesitesiTerv =
    "Két jogosulti igazolás alapján közvetlen hitelezői kifizetés és törlési engedély letéti kezelése.";
  c.payment.teljesVetelar = "100000000";
  c.payment.foglaloVan = true;
  c.payment.foglaloOsszeg = "5000000";
  c.payment.onero = "5000000";
  c.payment.bankhitelVan = true;
  c.payment.hitelOsszeg = "95000000";
  c.payment.bankNeve = "K&H Bank Zrt. (mintaszöveg)";
  c.payment.hitelFolyositasHatarido = "2026-09-30";
  c.payment.ugyvediLetet = true;
  c.payment.fizetesiUtemezes =
    "5.000.000 Ft önerő/foglaló, 50.000.000 Ft Otthon Start, 30.000.000 Ft CSOK Plusz, 15.000.000 Ft zöld hitel.";
  c.modulok.ellenorzes.terkepmasolatBeszerezve = true;
  c.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve = true;
  c.property.energetikaiTanusitvany = "HET-12345678";
  c.modulok.tarsashaz.alapitoOkiratEllenoirzve = true;
  c.modulok.b400.illetekkedvezmenyKod = "csok_plus";
  const seller = firstNatural(c, "elado");
  seller.kepviselo = {
    nev: "Meghatalmazott Mária",
    minoseg: "meghatalmazott",
    lakcim: "1111 Budapest, Példa utca 2.",
    azonosito: "AB123456",
    hatarozat: "",
  };
  return c;
}

function validateLawRef(lawRef: LawRef): string[] {
  const missing: string[] = [];
  const requiredStringFields: Array<keyof LawRef> = [
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

  for (const field of requiredStringFields) {
    if (!String(lawRef[field] ?? "").trim()) missing.push(field);
  }
  if (lawRef.source !== "NJT") missing.push("source !== NJT");
  if (!lawRef.sourceUrl.startsWith("https://njt.hu/")) {
    missing.push("sourceUrl is not an NJT URL");
  }
  if (!isKnownLegalSourceId(lawRef.sourceId)) {
    missing.push("sourceId is not in LEGAL_SOURCES");
  } else {
    const legalSource = getLegalSource(lawRef.sourceId);
    if (lawRef.act !== legalSource.act) missing.push("act does not match LEGAL_SOURCES");
    if (lawRef.shortName !== legalSource.shortName)
      missing.push("shortName does not match LEGAL_SOURCES");
    if (lawRef.sourceUrl !== legalSource.sourceUrl)
      missing.push("sourceUrl does not match LEGAL_SOURCES");
    if (lawRef.checkedAt !== legalSource.checkedAt)
      missing.push("checkedAt does not match LEGAL_SOURCES");
    if (legalSource.lawyerReviewStatus === "lawyer_validated") {
      missing.push("legalSource is unexpectedly lawyer_validated");
    }
  }
  if (lawRef.verificationStatus !== "ai_prelinked_pending_lawyer_review") {
    missing.push("verificationStatus");
  }
  if (lawRef.effectiveDateBasis !== "ügyvédi validáció szükséges") {
    missing.push("effectiveDateBasis");
  }
  return missing;
}

const scenarios: Scenario[] = [
  {
    id: "standard-lakas-hitel",
    label: "Lakás adásvétel bankhitellel és jelzálog tehermentesítéssel",
    caseFile: standardCase(),
    required: [
      ...hasDraftSafeguards,
      contains("6:185. §"),
      contains("2021. évi C. tv"),
      contains("Üttv."),
      contains("Pmt."),
      contains("B400E"),
      contains("ONYA"),
      contains("Jelzálogjog"),
      riskContains("Bankhitel"),
      riskContains("Jelzálogjog"),
    ],
  },
  {
    id: "foldforgalmi-sima",
    label: "Termőföld sima nyomtatott munkapéldány",
    caseFile: agriculturalCase("sima"),
    required: [
      ...hasDraftSafeguards,
      contains("SIMA NYOMTATOTT VÁLTOZAT"),
      contains("FÖLDFORGALMI RENDELKEZÉSEK"),
      contains("kifüggesztés"),
      contains("jóváhagy"),
      riskContains("földforgalmi"),
    ],
    notes: [
      "Ügyvédi ellenőrzéshez: ellenőrizni kell, hogy a sima változat szövege egyértelműen csak munkapéldány.",
    ],
  },
  {
    id: "foldforgalmi-zold",
    label: "Termőföld biztonsági okmányos változat",
    caseFile: agriculturalCase("biztonsagi_okmany"),
    required: [
      ...hasDraftSafeguards,
      contains("BIZTONSÁGI OKMÁNYRA"),
      contains("AB 1234567"),
      contains("Pénzjegynyomda"),
      contains("zöld papír"),
      contains("kifüggesztési záradék"),
      riskContains("földforgalmi"),
    ],
  },
  {
    id: "minor-buyer",
    label: "Kiskorú vevő törvényes képviselővel",
    caseFile: minorBuyerCase(),
    required: [
      ...hasDraftSafeguards,
      contains("Törvényes képviselet"),
      contains("gyámhatósági jóváhagyás"),
      contains("felfüggesztett hatállyal"),
      riskContains("Kiskorú"),
    ],
  },
  {
    id: "restricted-adult-buyer",
    label: "Gondnokkal eljáró vevő képviselői adatok nélkül",
    caseFile: restrictedAdultBuyerCase(),
    required: [
      ...hasDraftSafeguards,
      contains("Törvényes képviselet"),
      contains("képviselő / gondnok"),
      contains("gyámhatósági jóváhagyás"),
      contains("felfüggesztett hatállyal"),
      riskContains("Cselekvőképességi"),
    ],
    notes: [
      "Ez a validációs eset azt ellenőrzi, hogy a nem kiskorú, de korlátozott cselekvőképességű fél is aktív klauzulát és HIANYOS-TERVEZET report címet kapjon.",
    ],
  },
  {
    id: "foreign-buyer",
    label: "Külföldi vevő engedélyezési figyelmeztetéssel",
    caseFile: foreignBuyerCase(),
    required: [
      ...hasDraftSafeguards,
      contains("KÜLFÖLDI SZERZŐ INGATLANSZERZÉSI ENGEDÉLYE"),
      contains("251/2014. (X. 2.) Korm. rendelet"),
      riskContains("Külföldi"),
    ],
  },
  {
    id: "company-seller",
    label: "Céges eladó képviseleti/Pmt. kockázatokkal",
    caseFile: companySellerCase(),
    required: [
      ...hasDraftSafeguards,
      contains("cégjegyzékszám"),
      contains("képviselet módja"),
      contains("tényleges tulajdonosi nyilatkozat"),
      riskContains("Céges fél"),
    ],
  },
  {
    id: "incomplete",
    label: "Hiányos ügy placeholder-ekkel",
    caseFile: incompleteCase(),
    required: [
      ...hasDraftSafeguards,
      contains("eladó adatai hiányoznak"),
      contains("vevő adatai hiányoznak"),
      contains("[hrsz.]"),
    ],
    notes: ["Ez a validációs eset direkt hiányos: a cél az, hogy ne tűnjön kész szerződésnek."],
  },
];

const legalRuleScenarios: Scenario[] = [
  {
    id: "lawyerSampleCondominiumBankFinancedSale",
    label: "Ügyvédmintából képzett társasházi, bankfinanszírozott ügy",
    caseFile: lawyerSampleCondominiumBankFinancedSale(),
    required: [],
  },
  {
    id: "privateBasicFlatSaleNoLoan",
    label: "Magánszemély lakásvétel hitel nélkül",
    caseFile: privateBasicFlatSaleNoLoan(),
    required: [],
  },
  {
    id: "companySellerFlatSale",
    label: "Céges eladó",
    caseFile: companySellerCase(),
    required: [],
  },
  { id: "nonEuBuyerFlatSale", label: "Külföldi vevő", caseFile: foreignBuyerCase(), required: [] },
  {
    id: "mortgagedPropertySale",
    label: "Jelzáloggal terhelt ingatlan",
    caseFile: mortgagedPropertySale(),
    required: [],
  },
  { id: "csokPluszSale", label: "CSOK Plusz ügy", caseFile: csokPluszSale(), required: [] },
  {
    id: "farmlandSaleStopRule",
    label: "Földforgalmi stop rule",
    caseFile: agriculturalCase("sima"),
    required: [],
  },
  {
    id: "minorSellerSaleStopRule",
    label: "Kiskorú/gondnokolt stop rule",
    caseFile: minorBuyerCase(),
    required: [],
  },
  {
    id: "incompletePropertyData",
    label: "Hiányos ingatlanadat",
    caseFile: incompleteCase(),
    required: [],
  },
  {
    id: "localMunicipalityRestrictionUnknown",
    label: "Hiányzó önkormányzati ellenőrzés",
    caseFile: localMunicipalityRestrictionUnknown(),
    required: [],
  },
  {
    id: "condominiumExclusiveUseMissingMap",
    label: "Kizárólagos használat térkép nélkül",
    caseFile: condominiumExclusiveUseMissingMap(),
    required: [],
  },
];

function scanFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (["node_modules", ".git", "dist", ".output"].includes(entry)) return [];
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return scanFiles(fullPath);
    return fullPath.match(/\.(ts|tsx|js|jsx)$/) ? [fullPath] : [];
  });
}

function runRuleCatalogueAudit(): string[] {
  const failures: string[] = [];
  const sources = new Set(listLegalSources().map((source) => source.id));
  const clauseIds = new Set(realEstateSaleClauseTemplates.map((clause) => clause.id));

  for (const rule of realEstateSaleRules) {
    if (rule.sourceRefs.length === 0) failures.push(`${rule.id}: empty sourceRefs`);
    for (const sourceRef of rule.sourceRefs) {
      if (!isKnownLegalSourceId(sourceRef))
        failures.push(`${rule.id}: unknown sourceRef ${sourceRef}`);
    }
    if (rule.riskLevel === "critical" && !rule.blocksFinalizationWhen) {
      failures.push(`${rule.id}: critical rule lacks blocking logic`);
    }
    if (rule.riskLevel === "critical" && rule.auditQuestions.length === 0) {
      failures.push(`${rule.id}: critical rule lacks audit questions`);
    }
    for (const requiredClause of rule.requiredClauses) {
      if (!clauseIds.has(requiredClause.clauseId)) {
        failures.push(`${rule.id}: missing required clause ${requiredClause.clauseId}`);
      }
    }
  }

  for (const clause of realEstateSaleClauseTemplates) {
    if (clause.sourceRefs.length === 0) failures.push(`${clause.id}: empty sourceRefs`);
    for (const sourceRef of clause.sourceRefs) {
      if (!isKnownLegalSourceId(sourceRef))
        failures.push(`${clause.id}: unknown sourceRef ${sourceRef}`);
    }
    if (
      clause.reviewStatus === "lawyer_approved" &&
      clause.derivedFrom?.includes("lawyer-sample-sale-agreement-2026")
    ) {
      failures.push(`${clause.id}: lawyer sample clause is unexpectedly lawyer-approved`);
    }
  }

  for (const sourceId of sources) {
    const source = getLegalSource(sourceId);
    if (!source.sourceUrl || !source.verificationStatus) {
      failures.push(`${sourceId}: incomplete LegalSource metadata`);
    }
  }

  for (const file of scanFiles(process.cwd())) {
    const content = readFileSync(file, "utf8");
    const forbiddenFinalStatusTerms = [
      ["LEGAL", "FINAL", "BY", "AI"].join("_"),
      ["legal", "OK"].join(" "),
      ["compliance", "passed"].join(" "),
      ["jogilag", "valid"].join(" "),
      ["jogi megfelelőség", "igazolva"].join(" "),
    ];
    if (
      forbiddenFinalStatusTerms.some((term) => content.toLowerCase().includes(term.toLowerCase()))
    ) {
      failures.push(`${file}: forbidden final/legal-compliance wording`);
    }
  }

  return failures;
}

function runScenarioRuleAudit(): string[] {
  const failures: string[] = [];

  for (const scenario of legalRuleScenarios) {
    const contract = generateContractDraft(scenario.caseFile);
    const audit = evaluateLegalRuleSystem(scenario.caseFile, contract);
    const activeRuleIds = new Set(audit.activeRules.map((item) => item.rule.id));

    console.log(`\n--- Szabálymotor audit: ${scenario.label} (${scenario.id}) ---`);
    console.log(`Aktív szabályok: ${[...activeRuleIds].join(", ") || "—"}`);
    console.log(
      `Aktív klauzulasablonok: ${audit.activeClauses.map((clause) => clause.id).join(", ") || "—"}`,
    );
    console.log(`Hiányzó kritikus tények: ${audit.missingCriticalFacts.length}`);
    console.log(`Unresolved placeholders: ${audit.unresolvedPlaceholders.length}`);
    console.log(`Output status: ${audit.outputStatus}`);

    if (audit.sourceIssues.length > 0)
      failures.push(...audit.sourceIssues.map((issue) => `${scenario.id}: ${issue}`));

    if (audit.unresolvedPlaceholders.length > 0 && audit.outputStatus !== "HIANYOS_TERVEZET") {
      failures.push(`${scenario.id}: unresolved placeholders without HIANYOS_TERVEZET`);
    }
    if (
      audit.consistencyIssues.some((issue) => issue.severity === "critical") &&
      audit.outputStatus !== "HIANYOS_TERVEZET"
    ) {
      failures.push(`${scenario.id}: critical consistency issue without HIANYOS_TERVEZET`);
    }
    if (
      scenario.id === "farmlandSaleStopRule" &&
      (!activeRuleIds.has("farmlandSpecialRegime") || audit.outputStatus !== "HIANYOS_TERVEZET")
    ) {
      failures.push(`${scenario.id}: farmland stop rule did not block normal workflow`);
    }
    if (
      scenario.id === "minorSellerSaleStopRule" &&
      (!activeRuleIds.has("minorOrGuardianship") ||
        audit.outputStatus === "UGYVED_ALTAL_JOVAHAGYOTT_TERVEZET")
    ) {
      failures.push(`${scenario.id}: minor/guardianship rule did not prevent approved draft`);
    }
    if (
      scenario.id === "localMunicipalityRestrictionUnknown" &&
      (!activeRuleIds.has("localMunicipalityRestriction") ||
        audit.outputStatus !== "HIANYOS_TERVEZET")
    ) {
      failures.push(`${scenario.id}: missing local municipality check did not block`);
    }
    if (
      scenario.id === "condominiumExclusiveUseMissingMap" &&
      (!activeRuleIds.has("exclusiveUse") || audit.outputStatus !== "HIANYOS_TERVEZET")
    ) {
      failures.push(`${scenario.id}: missing exclusive-use map did not block`);
    }
    if (
      audit.activeRules.some((item) =>
        item.requiredClauseStatuses.some(
          (clause) => clause.found && clause.reviewStatus === "lawyer_approved",
        ),
      )
    ) {
      failures.push(`${scenario.id}: clause auto-marked as lawyer-approved`);
    }
  }

  return failures;
}

let failed = 0;

for (const scenario of scenarios) {
  const contract = generateContractDraft(scenario.caseFile);
  const report = generateClauseReviewReport(scenario.caseFile);
  const b400ePackage = generateB400EBeadasiCsomag(scenario.caseFile);
  const risks = generateRiskFlags(scenario.caseFile);
  const pairings = getActiveClausePairings(scenario.caseFile);
  const ctx: AuditContext = { contract, risks };
  const scenarioFailures = scenario.required.filter((check) => !check.test(ctx));
  const pairingFailures = pairings.flatMap((pairing) =>
    pairing.auditTerms
      .filter((term) => !contract.toLowerCase().includes(term.toLowerCase()))
      .map((term) => ({
        label: `${pairing.cim}: hiányzó audit-kifejezés "${term}"`,
      })),
  );
  const lawRefFailures = pairings.flatMap((pairing) =>
    getAllLawRefs(pairing).flatMap((lawRef) =>
      validateLawRef(lawRef).map((field) => ({
        label: `${pairing.cim}: hiányos lawRef metadata (${lawRef.shortName} ${lawRef.section}) -> ${field}`,
      })),
    ),
  );
  const reportFailures = [
    !report.markdown.includes("# ") && { label: `${scenario.id}: review report title missing` },
    !report.markdown.includes("## Aktív klauzulák") && {
      label: `${scenario.id}: review report active clauses section missing`,
    },
    !report.markdown.includes("lawRef: {") && {
      label: `${scenario.id}: review report lawRef block missing`,
    },
    !report.markdown.includes("AI előpárosítás") && {
      label: `${scenario.id}: review report lawyer review wording missing`,
    },
    (scenario.id === "incomplete" || scenario.id === "restricted-adult-buyer") &&
      !report.title.includes("HIANYOS-TERVEZET") && {
        label: `${scenario.id}: critical missing data did not create HIANYOS-TERVEZET title`,
      },
    ...report.missingLawRefMetadata.map((metadataIssue) => ({
      label: `${scenario.id}: report missing lawRef metadata -> ${metadataIssue}`,
    })),
    ...pairings
      .filter((pairing) => pairing.reviewStatus === "lawyer_approved")
      .map((pairing) => ({
        label: `${scenario.id}: clause auto-marked lawyer-approved -> ${pairing.id}`,
      })),
  ].filter(Boolean) as Array<{ label: string }>;
  const b400eFailures = [
    b400ePackage.mezok.length === 0 && {
      label: `${scenario.id}: B400E / ONYA beadási csomag nem generált mezőket`,
    },
    !b400ePackage.osszefoglalo.includes("B400E") && {
      label: `${scenario.id}: B400E / ONYA beadási csomag összefoglaló nem tartalmaz B400E hivatkozást`,
    },
    !b400ePackage.mezok.some((field) => field.csoport === "Vagyonszerző / vevő") && {
      label: `${scenario.id}: B400E / ONYA beadási csomagból hiányzik a vagyonszerző csoport`,
    },
    !b400ePackage.mezok.some((field) => field.csoport === "Ingatlan") && {
      label: `${scenario.id}: B400E / ONYA beadási csomagból hiányzik az ingatlan csoport`,
    },
  ].filter(Boolean) as Array<{ label: string }>;
  const mandatoryInytvFailures = MANDATORY_INYTV_AUDIT_TERMS.filter(
    (term) => !contract.toLowerCase().includes(term.toLowerCase()),
  ).map((term) => ({
    label: `${scenario.id}: kötelező új Inytv./vhr. generálási szabály hiányzó kifejezése -> ${term}`,
  }));
  const failures = [
    ...scenarioFailures,
    ...pairingFailures,
    ...lawRefFailures,
    ...reportFailures,
    ...b400eFailures,
    ...mandatoryInytvFailures,
  ];
  const placeholderCount = (contract.match(/\[[^\]]+\]|_{6,}/g) ?? []).length;

  console.log(`\n=== ${scenario.label} (${scenario.id}) ===`);
  console.log(`Tervezet hossz: ${contract.length.toLocaleString("hu-HU")} karakter`);
  console.log(`Kockázati pontok: ${risks.length}`);
  console.log(`Aktív jogi párosítások: ${pairings.length}`);
  console.log(`Review report cím: ${report.title}`);
  console.log(`Review report hossz: ${report.markdown.length.toLocaleString("hu-HU")} karakter`);
  console.log(`B400E / ONYA mezők: ${b400ePackage.mezok.length}`);
  console.log(`B400E / ONYA hiányzó kötelező adatok: ${b400ePackage.hianyzoMezok.length}`);
  console.log(`Placeholder / üres aláírási mező jelölések: ${placeholderCount}`);
  for (const pairing of pairings) {
    const statutes = getAllLawRefs(pairing)
      .map((lawRef) => `${lawRef.shortName} ${lawRef.section}`)
      .join("; ");
    console.log(
      `- ${pairing.cim} [${pairing.riskLevel}] :: ${statutes} :: ${formatReviewStatus(
        pairing.reviewStatus,
      )}`,
    );
  }

  if (scenario.notes?.length) {
    for (const note of scenario.notes) console.log(`Megjegyzés: ${note}`);
  }

  if (failures.length === 0) {
    console.log("Eredmény: OK");
    continue;
  }

  failed += failures.length;
  console.log("Eredmény: HIBA");
  for (const failure of failures) {
    console.log(`- ${failure.label}`);
  }
}

const catalogueFailures = runRuleCatalogueAudit();
const scenarioRuleFailures = runScenarioRuleAudit();
if (catalogueFailures.length || scenarioRuleFailures.length) {
  const ruleFailures = [...catalogueFailures, ...scenarioRuleFailures];
  failed += ruleFailures.length;
  console.log("\n=== Determinisztikus szabálymotor audit ===");
  for (const failure of ruleFailures) console.log(`- ${failure}`);
}

if (failed > 0) {
  console.error(`\nTechnical legal rule audit failed: ${failed} ellenőrzés nem teljesült.`);
  process.exit(1);
}

console.log("\nTechnical legal rule audit OK");
console.log("Technical legal-matrix audit OK.");
console.log("Clause review report generated successfully.");
console.log("B400E / ONYA submission package generated successfully.");
console.log("Mandatory new Inytv./vhr. generation rules applied successfully.");
console.log("All active legal references include complete lawRef metadata.");
console.log("All active legal references are linked to the central legalSources registry.");
console.log("All AI-prelinked references remain pending lawyer review.");
