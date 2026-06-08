import { generateContractDraft } from "../src/lib/legal/contract";
import { generateB400EBeadasiCsomag } from "../src/lib/legal/b400eSubmission";
import {
  formatReviewStatus,
  getActiveClausePairings,
  getAllLawRefs,
  type LawRef,
} from "../src/lib/legal/clauseMatrix";
import { generateClauseReviewReport } from "../src/lib/legal/clauseReviewReport";
import { getLegalSource, isKnownLegalSourceId } from "../src/lib/legal/legalSources";
import { generateRiskFlags } from "../src/lib/legal/logic";
import { demoCase, emptyCase, newId } from "../src/lib/legal/state";
import type { CaseFile, NaturalPerson } from "../src/lib/legal/types";

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
  const failures = [
    ...scenarioFailures,
    ...pairingFailures,
    ...lawRefFailures,
    ...reportFailures,
    ...b400eFailures,
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

if (failed > 0) {
  console.error(`\nTechnical legal-matrix audit failed: ${failed} ellenőrzés nem teljesült.`);
  process.exit(1);
}

console.log("\nTechnical legal-matrix audit OK.");
console.log("Clause review report generated successfully.");
console.log("B400E / ONYA submission package generated successfully.");
console.log("All active legal references include complete lawRef metadata.");
console.log("All active legal references are linked to the central legalSources registry.");
console.log("All AI-prelinked references remain pending lawyer review.");
