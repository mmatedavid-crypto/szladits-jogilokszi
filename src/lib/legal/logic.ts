import type {
  CaseFile,
  CapacityStatus,
  NaturalPerson,
  Party,
  RiskFlag,
  MissingField,
  AttachmentItem,
  Company,
} from "./types";
import { TRANSACTION_TYPE_LABELS, DRAFT_BANNER } from "./types";

// ---------- Age & capacity ----------

export function calculateAge(isoDate: string, today = new Date()): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function determineCapacityStatus(p: NaturalPerson): CapacityStatus {
  if (p.capacityOverride) return p.capacityOverride;
  const age = calculateAge(p.szuletesiDatum);
  if (age === null) return "ellenorzes_szukseges";
  if (age < 14) return "cselekvokeptelen_kiskoru";
  if (age < 18) return "korlatozottan_cselekvokepes_kiskoru";
  return "nagykoru_teljes";
}

export const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  cselekvokeptelen_kiskoru: "Cselekvőképtelen kiskorú",
  korlatozottan_cselekvokepes_kiskoru: "Korlátozottan cselekvőképes kiskorú",
  nagykoru_teljes: "Nagykorú, teljesen cselekvőképes",
  nagykoru_korlatozott: "Cselekvőképességében részlegesen korlátozott nagykorú",
  cselekvokeptelen_nagykoru: "Cselekvőképtelen nagykorú",
  gondnokkal: "Gondnokkal jár el",
  ellenorzes_szukseges: "Ügyvédi ellenőrzést igényel",
};

// ---------- Risk detectors ----------

export function isMinor(p: NaturalPerson): boolean {
  const s = determineCapacityStatus(p);
  return (
    s === "cselekvokeptelen_kiskoru" ||
    s === "korlatozottan_cselekvokepes_kiskoru"
  );
}

function isRestricted(p: NaturalPerson): boolean {
  const s = determineCapacityStatus(p);
  return (
    s === "nagykoru_korlatozott" ||
    s === "cselekvokeptelen_nagykoru" ||
    s === "gondnokkal" ||
    s === "ellenorzes_szukseges"
  );
}

export function detectMinorRisk(c: CaseFile): RiskFlag[] {
  const out: RiskFlag[] = [];
  c.parties.forEach((p) => {
    if (p.kind !== "termeszetes") return;
    if (!isMinor(p)) return;
    out.push({
      id: `minor_${p.id}`,
      cim: `Kiskorú fél: ${p.nev || "(név hiányzik)"}`,
      severity: "kritikus",
      miert:
        "Kiskorú részvétele esetén törvényes képviselet és — meghatározott körben — gyámhatósági jóváhagyás szükséges.",
      ellenorizendo:
        "Törvényes képviselő személye, gyámhatósági jóváhagyás szükségessége, ingatlanszerzés/terhelés feltételei.",
    });
    if (!p.kepviselo || !p.kepviselo.nev) {
      out.push({
        id: `minor_rep_${p.id}`,
        cim: `Törvényes képviselő adatai hiányoznak — ${p.nev || "kiskorú"}`,
        severity: "magas",
        miert: "Kiskorú nevében csak törvényes képviselő járhat el.",
        ellenorizendo: "Szülő/gyám személyazonossága, képviseleti jog igazolása.",
      });
    }
  });
  return out;
}

export function detectGuardianshipRisk(c: CaseFile): RiskFlag[] {
  const out: RiskFlag[] = [];
  c.parties.forEach((p) => {
    if (p.kind !== "termeszetes") return;
    if (!isRestricted(p)) return;
    out.push({
      id: `guard_${p.id}`,
      cim: `Cselekvőképességi státusz ellenőrzendő: ${p.nev || "(név hiányzik)"}`,
      severity: "magas",
      miert:
        "Korlátozott cselekvőképesség vagy gondnokság esetén az ügylet érvényessége külön feltételekhez kötött.",
      ellenorizendo:
        "Bírósági határozat, érintett ügycsoport, gondnok adatai, esetleges gyámhatósági jóváhagyás.",
    });
  });
  return out;
}

export function detectAgriculturalLandRisk(c: CaseFile): RiskFlag[] {
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  if (!agri) return [];
  return [
    {
      id: "agri",
      cim: "Termőföld / mezőgazdasági ingatlan — földforgalmi szabályok",
      severity: "kritikus",
      miert:
        "Termőföld és mezőgazdasági ingatlan adásvételére a földforgalmi szabályok, elővásárlási jogok, kifüggesztési és hatósági jóváhagyási kötelezettségek vonatkoznak.",
      ellenorizendo:
        "Földműves státusz, helyben lakás, elővásárlási sorrend, kifüggesztés, hatósági jóváhagyás, tulajdonszerzési korlátok.",
    },
  ];
}

export function detectZartkertRisk(c: CaseFile): RiskFlag[] {
  if (!c.transactionTypes.includes("zartkert")) return [];
  const status = c.special.zartkertStatus;
  if (status === "muveles_alol_kivett") {
    return [
      {
        id: "zartkert",
        cim: "Zártkert (művelés alól kivett)",
        severity: "kozepes",
        miert:
          "A művelés alóli kivettség dokumentált státuszát a tulajdoni lap alapján ellenőrizni kell.",
        ellenorizendo: "Tulajdoni lap I. része, művelési ág, kivett megjelölés.",
      },
    ];
  }
  return [
    {
      id: "zartkert",
      cim: "Zártkert minősítés — földforgalmi kockázat",
      severity: "magas",
      miert:
        "Mezőgazdasági művelési ágban nyilvántartott zártkert a földforgalmi szabályok hatálya alá eshet.",
      ellenorizendo: "Művelési ág, földforgalmi szabályok alkalmazhatósága.",
    },
  ];
}

export function detectLoanRisk(c: CaseFile): RiskFlag[] {
  if (!c.payment.bankhitelVan && !c.transactionTypes.includes("hitellel_erintett"))
    return [];
  return [
    {
      id: "loan",
      cim: "Bankhitelből finanszírozott vételár",
      severity: "magas",
      miert:
        "A banki folyósítás feltételei, a bejegyzési engedély kezelése, a függőben tartás és a banki jelzálog egyidejű bejegyzése külön gondosságot igényel.",
      ellenorizendo:
        "Önerő/hitel bontás, folyósítási határidő, bejegyzési engedély letétbe helyezése, függőben tartás, banki jelzálog és tilalom.",
    },
  ];
}

export function detectEncumbranceRisk(c: CaseFile): RiskFlag[] {
  const e = c.property.encumbrances;
  const out: RiskFlag[] = [];
  if (e.jelzalog)
    out.push({
      id: "enc_jelzalog",
      cim: "Jelzálogjog az ingatlanon",
      severity: "magas",
      miert: "Tehermentes tulajdonszerzéshez kiváltás szükséges.",
      ellenorizendo: "Kiváltási nyilatkozat, vételár felosztás, letét.",
    });
  if (e.vegrehajtas)
    out.push({
      id: "enc_vegrehajtas",
      cim: "Végrehajtási jog bejegyzés",
      severity: "kritikus",
      miert: "Végrehajtás alatt álló ingatlan értékesítése külön eljárást igényel.",
      ellenorizendo: "Végrehajtó megkeresése, kiváltás vagy törlési feltételek.",
    });
  if (e.haszonelvezet)
    out.push({
      id: "enc_haszonelvezet",
      cim: "Haszonélvezeti jog",
      severity: "magas",
      miert: "A haszonélvező hozzájárulása vagy lemondása szükséges.",
      ellenorizendo: "Haszonélvező nyilatkozata, ellenérték kérdése.",
    });
  if (e.elidegenitesiTilalom)
    out.push({
      id: "enc_tilalom",
      cim: "Elidegenítési és terhelési tilalom",
      severity: "kritikus",
      miert: "A tilalom feloldása nélkül a tulajdonjog nem ruházható át.",
      ellenorizendo: "Jogosult hozzájárulása, kiváltási feltételek.",
    });
  if (e.elovasarlasiJog)
    out.push({
      id: "enc_elovasarlas",
      cim: "Elővásárlási jog",
      severity: "magas",
      miert: "Az elővásárlásra jogosultaknak a vételi ajánlatot fel kell ajánlani.",
      ellenorizendo: "Jogosultak köre, ajánlat közlése, lemondó nyilatkozat.",
    });
  if (e.szolgalmiJog)
    out.push({
      id: "enc_szolgalmi",
      cim: "Szolgalmi jog",
      severity: "kozepes",
      miert: "A szolgalmi jog tartalma és terjedelme értékbefolyásoló lehet.",
      ellenorizendo: "Szolgalom tárgya, jogosult köre.",
    });
  if (e.egyeb.trim())
    out.push({
      id: "enc_egyeb",
      cim: "Egyéb teher feltüntetve",
      severity: "kozepes",
      miert: e.egyeb,
      ellenorizendo: "A bejegyzés tartalmi és formai vizsgálata.",
    });
  return out;
}

export function detectCompanyPartyRisk(c: CaseFile): RiskFlag[] {
  const out: RiskFlag[] = [];
  c.parties.forEach((p) => {
    if (p.kind !== "ceg") return;
    out.push({
      id: `comp_${p.id}`,
      cim: `Céges fél: ${p.cegnev || "(cégnév hiányzik)"}`,
      severity: "kozepes",
      miert:
        "Céges fél esetén képviseleti jogosultság, cégkivonat és aláírásminta ellenőrzése kötelező.",
      ellenorizendo:
        "Cégkivonat, aláírási címpéldány, képviselet módja, tényleges tulajdonosi nyilatkozat (pénzmosási).",
    });
  });
  return out;
}

export function detectForeignPartyRisk(c: CaseFile): RiskFlag[] {
  const out: RiskFlag[] = [];
  c.parties.forEach((p) => {
    const foreign =
      (p.kind === "termeszetes" &&
        p.allampolgarsag.trim() &&
        p.allampolgarsag.trim().toLowerCase() !== "magyar") ||
      (p.kind === "ceg" && p.kulfoldiSzekhely);
    if (!foreign) return;
    const nev = p.kind === "termeszetes" ? p.nev : p.cegnev;
    out.push({
      id: `foreign_${p.id}`,
      cim: `Külföldi fél: ${nev || "(név hiányzik)"}`,
      severity: "magas",
      miert:
        "Külföldi fél esetén személyazonosítás, fordítás, meghatalmazás formai követelménye és apostille/konzuli felülhitelesítés kérdése merülhet fel.",
      ellenorizendo:
        "Okmányok hitelesítése, fordítás, meghatalmazás formai követelménye, esetleges tulajdonszerzési korlát.",
    });
  });
  return out;
}

export function generateRiskFlags(c: CaseFile): RiskFlag[] {
  return [
    ...detectMinorRisk(c),
    ...detectGuardianshipRisk(c),
    ...detectEncumbranceRisk(c),
    ...detectLoanRisk(c),
    ...detectAgriculturalLandRisk(c),
    ...detectZartkertRisk(c),
    ...detectCompanyPartyRisk(c),
    ...detectForeignPartyRisk(c),
  ];
}

// ---------- Missing fields ----------

function partyLabel(p: Party) {
  return p.kind === "termeszetes"
    ? `${p.szerep === "elado" ? "Eladó" : "Vevő"} (természetes személy): ${p.nev || "név nélkül"}`
    : `${p.szerep === "elado" ? "Eladó" : "Vevő"} (cég): ${p.cegnev || "név nélkül"}`;
}

export function detectMissingFields(c: CaseFile): MissingField[] {
  const m: MissingField[] = [];

  // Felek
  if (c.parties.length === 0)
    m.push({ group: "felek", field: "Legalább egy eladó és egy vevő szükséges." });
  const elado = c.parties.some((p) => p.szerep === "elado");
  const vevo = c.parties.some((p) => p.szerep === "vevo");
  if (!elado) m.push({ group: "felek", field: "Hiányzó eladó fél." });
  if (!vevo) m.push({ group: "felek", field: "Hiányzó vevő fél." });

  c.parties.forEach((p) => {
    const label = partyLabel(p);
    if (p.kind === "termeszetes") {
      if (!p.nev) m.push({ group: "felek", field: "Név", reszlet: label });
      if (!p.anyjaNeve) m.push({ group: "felek", field: "Anyja neve", reszlet: label });
      if (!p.szuletesiDatum) m.push({ group: "felek", field: "Születési dátum", reszlet: label });
      if (!p.lakcim) m.push({ group: "felek", field: "Lakcím", reszlet: label });
      if (!p.adoazonosito) m.push({ group: "felek", field: "Adóazonosító jel", reszlet: label });
      if (!p.allampolgarsag) m.push({ group: "felek", field: "Állampolgárság", reszlet: label });
      if (isMinor(p) && (!p.kepviselo || !p.kepviselo.nev))
        m.push({
          group: "specialis_jovahagyasok",
          field: "Törvényes képviselő adatai",
          reszlet: label,
        });
    } else {
      if (!p.cegnev) m.push({ group: "felek", field: "Cégnév", reszlet: label });
      if (!p.cegjegyzekszam)
        m.push({ group: "felek", field: "Cégjegyzékszám", reszlet: label });
      if (!p.adoszam) m.push({ group: "felek", field: "Adószám", reszlet: label });
      if (!p.szekhely) m.push({ group: "felek", field: "Székhely", reszlet: label });
      if (!p.kepviseloNeve)
        m.push({ group: "felek", field: "Képviselő neve", reszlet: label });
    }
  });

  // Ingatlan
  const pr = c.property;
  if (!pr.telepules) m.push({ group: "ingatlan", field: "Település" });
  if (!pr.cim) m.push({ group: "ingatlan", field: "Cím" });
  if (!pr.helyrajziSzam) m.push({ group: "ingatlan", field: "Helyrajzi szám" });
  if (!pr.alapterulet) m.push({ group: "ingatlan", field: "Alapterület" });
  if (!pr.ingatlanTipus) m.push({ group: "ingatlan", field: "Ingatlan típusa" });

  // Vételár
  if (!c.payment.teljesVetelar) m.push({ group: "vetelar", field: "Teljes vételár" });
  if (c.payment.foglaloVan && !c.payment.foglaloOsszeg)
    m.push({ group: "vetelar", field: "Foglaló összege" });
  if (c.payment.bankhitelVan) {
    if (!c.payment.bankNeve) m.push({ group: "fizetes", field: "Bank neve" });
    if (!c.payment.hitelOsszeg) m.push({ group: "fizetes", field: "Hitel összege" });
    if (!c.payment.hitelFolyositasHatarido)
      m.push({ group: "fizetes", field: "Hitel folyósításának határideje" });
  }
  if (!c.payment.utalasiSzamlaszam)
    m.push({ group: "fizetes", field: "Utalási célszámlaszám" });

  // Birtokbaadás
  if (!c.possession.datum) m.push({ group: "birtokbaadas", field: "Birtokbaadás dátuma" });
  if (c.possession.kotberKesedelem && !c.possession.kotberOsszeg)
    m.push({ group: "birtokbaadas", field: "Kötbér összege" });

  // Speciális
  if (c.transactionTypes.includes("zartkert") && !c.special.zartkertStatus)
    m.push({ group: "specialis_jovahagyasok", field: "Zártkert minősítés" });

  // Mellékletek (általános elvárások)
  if (!pr.energetikaiTanusitvany)
    m.push({ group: "mellekletek", field: "Energetikai tanúsítvány száma" });

  return m;
}

// ---------- Attachments ----------

export function generateAttachmentList(c: CaseFile): AttachmentItem[] {
  const out: AttachmentItem[] = [];
  out.push({
    cim: "Tulajdoni lap (hiteles, friss)",
    kotelezo: true,
    indok: "Tulajdoni és teherviszonyok ellenőrzése.",
  });
  out.push({
    cim: "Személyes okmányok másolata (felek)",
    kotelezo: true,
    indok: "Személyazonosítás és JÜB ellenőrzés.",
  });
  out.push({
    cim: "Lakcímkártya másolata",
    kotelezo: true,
    indok: "Lakcím igazolása.",
  });
  out.push({
    cim: "Adóazonosító jel igazolása",
    kotelezo: true,
    indok: "Tulajdonjog-bejegyzéshez szükséges.",
  });
  if (c.property.energetikaiTanusitvany || c.property.ingatlanTipus)
    out.push({
      cim: "Energetikai tanúsítvány",
      kotelezo: true,
      indok: "Jogszabály alapján kötelező az átadás-átvételhez.",
    });
  if (c.property.tarsashaziAlbetet)
    out.push({
      cim: "Társasházi alapító okirat / közös képviselő igazolás",
      kotelezo: false,
      indok: "Társasházi albetét esetén szükséges lehet.",
    });
  if (c.payment.bankhitelVan)
    out.push({
      cim: "Banki hitelígérvény / kölcsönszerződés",
      kotelezo: true,
      indok: "Banki finanszírozás feltételei.",
    });
  if (c.property.encumbrances.jelzalog || c.payment.meglevoTeherKivaltas)
    out.push({
      cim: "Tehermentesítési / kiváltási igazolás",
      kotelezo: true,
      indok: "Jelzálog / teher kiváltásához.",
    });
  if (c.property.encumbrances.haszonelvezet)
    out.push({
      cim: "Haszonélvező hozzájáruló nyilatkozata",
      kotelezo: true,
      indok: "Haszonélvezeti jog érintettsége.",
    });
  if (c.parties.some((p) => p.kind === "termeszetes" && isMinor(p)))
    out.push({
      cim: "Gyámhatósági jóváhagyás (ha szükséges)",
      kotelezo: false,
      indok: "Kiskorú érintettsége — ügyvédi ellenőrzés alapján.",
    });
  if (c.parties.some((p) => p.kind === "ceg")) {
    out.push({
      cim: "Cégkivonat (friss)",
      kotelezo: true,
      indok: "Céges fél képviseletének igazolása.",
    });
    out.push({
      cim: "Aláírási címpéldány / aláírásminta",
      kotelezo: true,
      indok: "Cégszerű aláírás formai követelménye.",
    });
  }
  const agri =
    c.transactionTypes.includes("termofold") ||
    c.transactionTypes.includes("tanya") ||
    (c.transactionTypes.includes("zartkert") &&
      c.special.zartkertStatus === "mezogazdasagi");
  if (agri) {
    out.push({
      cim: "Földforgalmi nyilatkozatok",
      kotelezo: true,
      indok: "Földforgalmi törvény szerinti nyilatkozati kötelezettség.",
    });
    out.push({
      cim: "Térképmásolat",
      kotelezo: false,
      indok: "Földrészlet azonosításához ajánlott.",
    });
  }
  if (c.parties.some((p) => (p.kind === "termeszetes" && p.kepviselo) || false))
    out.push({
      cim: "Meghatalmazás / képviseleti igazolás",
      kotelezo: true,
      indok: "Képviselő eljárása esetén.",
    });
  return out;
}

// ---------- Summary ----------

function formatAmount(amt: string, ccy: string) {
  if (!amt) return "—";
  const n = Number(amt);
  if (Number.isNaN(n)) return `${amt} ${ccy}`;
  return `${n.toLocaleString("hu-HU")} ${ccy}`;
}

export function generateCaseSummary(c: CaseFile): string {
  const risks = generateRiskFlags(c);
  const missing = detectMissingFields(c);
  const types = c.transactionTypes
    .map((t) => TRANSACTION_TYPE_LABELS[t])
    .join(", ");
  const eladok = c.parties.filter((p) => p.szerep === "elado");
  const vevok = c.parties.filter((p) => p.szerep === "vevo");
  const partyName = (p: Party) =>
    p.kind === "termeszetes" ? p.nev || "(név nélkül)" : p.cegnev || "(név nélkül)";
  const top = risks
    .filter((r) => r.severity === "kritikus" || r.severity === "magas")
    .slice(0, 8)
    .map((r) => `  • [${r.severity.toUpperCase()}] ${r.cim}`)
    .join("\n");
  const teendok: string[] = [
    "Tulajdoni lap lekérése és teherviszonyok ellenőrzése.",
    "Felek személyazonosságának és képviseleti jogának ellenőrzése.",
    "Vételár és fizetési struktúra ügyvédi átvizsgálása.",
  ];
  if (c.payment.bankhitelVan)
    teendok.push("Banki folyósítási feltételek és bejegyzési engedély kezelésének egyeztetése.");
  if (c.parties.some((p) => p.kind === "termeszetes" && isMinor(p)))
    teendok.push("Kiskorú érintettsége — gyámhatósági jóváhagyás vizsgálata.");

  return [
    DRAFT_BANNER,
    "",
    `Ügyazonosító: ${c.ugyAzonosito || "—"}`,
    `Ügylet típusa: ${types || "—"}`,
    "",
    "Felek:",
    `  Eladó(k): ${eladok.map(partyName).join(", ") || "—"}`,
    `  Vevő(k): ${vevok.map(partyName).join(", ") || "—"}`,
    "",
    "Ingatlan:",
    `  ${c.property.iranyitoszam} ${c.property.telepules}, ${c.property.cim}`,
    `  Hrsz.: ${c.property.helyrajziSzam || "—"}  •  ${c.property.alapterulet || "—"} m²`,
    "",
    `Vételár: ${formatAmount(c.payment.teljesVetelar, c.payment.penznem)}`,
    `Fizetési struktúra: foglaló ${c.payment.foglaloVan ? "igen" : "nem"}, önerő ${c.payment.onero || "—"}, hitel ${c.payment.bankhitelVan ? c.payment.bankNeve || "igen" : "nem"}, ügyvédi letét ${c.payment.ugyvediLetet ? "igen" : "nem"}.`,
    "",
    "Kiemelt kockázatok:",
    top || "  • Nincs magas/kritikus kockázat azonosítva (ügyvédi ellenőrzés szükséges).",
    "",
    `Hiányzó adatok száma: ${missing.length}`,
    "",
    "Következő ügyvédi teendők:",
    ...teendok.map((t) => `  • ${t}`),
    "",
    "Megjegyzés: szabálylogikával támogatott okiratszerkesztési demo. Jogi review szükséges.",
  ].join("\n");
}

// re-export helpers
export { isMinor, isRestricted };
export type { Company };
