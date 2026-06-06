// Szladits Magánjogi Asszisztens — adatmodell
// Belső tesztverzió ügyvédi irodák számára

export type TransactionType =
  | "lakas"
  | "csaladi_haz"
  | "tarsashazi_albetet"
  | "garazs"
  | "tarolo"
  | "telek"
  | "zartkert"
  | "termofold"
  | "tanya"
  | "tulajdoni_hanyad"
  | "vegyes"
  | "ceges_fel"
  | "hitellel_erintett"
  | "tehermentesitessel_erintett";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  lakas: "Lakás",
  csaladi_haz: "Családi ház",
  tarsashazi_albetet: "Társasházi albetét",
  garazs: "Garázs",
  tarolo: "Tároló",
  telek: "Telek",
  zartkert: "Zártkert",
  termofold: "Termőföld / mezőgazdasági föld",
  tanya: "Tanya",
  tulajdoni_hanyad: "Tulajdoni hányad adásvétele",
  vegyes: "Vegyes ügylet",
  ceges_fel: "Céges eladó / vevő",
  hitellel_erintett: "Hitellel érintett ügylet",
  tehermentesitessel_erintett: "Tehermentesítéssel érintett ügylet",
};

export type ZartkertStatus =
  | "muveles_alol_kivett"
  | "mezogazdasagi"
  | "nem_ismert";

export type PartyRole = "elado" | "vevo";

export type CapacityStatus =
  | "cselekvokeptelen_kiskoru"
  | "korlatozottan_cselekvokepes_kiskoru"
  | "nagykoru_teljes"
  | "nagykoru_korlatozott"
  | "cselekvokeptelen_nagykoru"
  | "gondnokkal"
  | "ellenorzes_szukseges";

export interface Representative {
  nev: string;
  minoseg: string; // szülő / gyám / gondnok / törvényes képviselő / cégképviselő
  lakcim: string;
  azonosito: string;
  hatarozat: string; // bírósági határozat / ügycsoport
}

export interface NaturalPerson {
  kind: "termeszetes";
  id: string;
  szerep: PartyRole;
  nev: string;
  szuletesiNev: string;
  anyjaNeve: string;
  szuletesiHely: string;
  szuletesiDatum: string; // ISO
  lakcim: string;
  okmanyAzonosito: string;
  adoazonosito: string;
  allampolgarsag: string;
  tulajdoniHanyad: string;
  capacityOverride?: CapacityStatus; // ha az ügyvéd manuálisan állítja
  kepviselo?: Representative;
  kiskoruIngatlanEladasa?: boolean;
  kiskoruIngatlanMegterhelese?: boolean;
  nemTehermentesSzerzes?: boolean;
}

export interface Company {
  kind: "ceg";
  id: string;
  szerep: PartyRole;
  cegnev: string;
  cegjegyzekszam: string;
  adoszam: string;
  szekhely: string;
  kepviseloNeve: string;
  kepviseletModja: string;
  cegkivonatDatuma: string;
  alairasiCimpeldanySzukseges: boolean;
  tulajdoniHanyad: string;
  kulfoldiSzekhely: boolean;
}

export type Party = NaturalPerson | Company;

export interface Encumbrances {
  jelzalog: boolean;
  vegrehajtas: boolean;
  haszonelvezet: boolean;
  elidegenitesiTilalom: boolean;
  elovasarlasiJog: boolean;
  szolgalmiJog: boolean;
  egyeb: string;
}

export interface Property {
  telepules: string;
  iranyitoszam: string;
  cim: string;
  helyrajziSzam: string;
  ingatlanTipus: string;
  muvelesiAg: string;
  alapterulet: string;
  tulajdoniHanyad: string;
  tarsashaziAlbetet: boolean;
  teremgarazsTarolo: boolean;
  energetikaiTanusitvany: string;
  birtokbanElado: boolean;
  hasznalatiStatusz: "lakott" | "ures" | "berbeadott" | "";
  birtokbaadasTervezett: string;
  encumbrances: Encumbrances;
  tehermentesitesiTerv: string;
}

export type AfaKezeles =
  | ""
  | "afa_korin_kivuli"
  | "afa_mentes"
  | "tartalmazza_27"
  | "tartalmazza_5"
  | "forditott";

export interface PaymentPlan {
  teljesVetelar: string;
  penznem: "HUF" | "EUR" | "USD";
  afaKezeles: AfaKezeles;
  foglaloVan: boolean;
  foglaloOsszeg: string;
  elolegVan: boolean;
  onero: string;
  bankhitelVan: boolean;
  bankNeve: string;
  hitelOsszeg: string;
  hitelFolyositasHatarido: string;
  reszletfizetes: boolean;
  fizetesiUtemezes: string;
  ugyvediLetet: boolean;
  meglevoTeherKivaltas: boolean;
  tehermentesitesModja: string;
  utalasiSzamlaszam: string;
}

export interface Possession {
  datum: string;
  feltetel: string;
  kozmuAtiras: boolean;
  kulcsAtadas: boolean;
  eladoKikoltozes: string;
  ingosagokMaradnak: boolean;
  ingosagokListaja: string;
  kotberKesedelem: boolean;
  kotberOsszeg: string;
}

export type FoldforgalmiNyomtatas = "sima" | "biztonsagi_okmany";

export interface FoldforgalmiModul {
  fold: boolean;
  muvelesiAg: string;
  vevoFoldmuves: boolean;
  eladoFoldmuves: boolean;
  vevoHelybenLako: boolean;
  vevoSzomszed: boolean;
  haszonberlet: boolean;
  foldhasznalo: boolean;
  elovasarlasErintett: boolean;
  kifuggesztes: boolean;
  hatosagiJovahagyas: boolean;
  tulajdonszerzesiKorlat: boolean;
  nyilatkozatok: boolean;
  // Nyomtatási változat: sima nyomtatott példány vs. biztonsági okmány („zöld papír")
  nyomtatasiValtozat: FoldforgalmiNyomtatas;
  biztonsagiOkmanySorszam: string;
  biztonsagiOkmanyKiallito: string;
}

export interface SpecialRules {
  zartkertStatus?: ZartkertStatus;
  foldforgalmi: FoldforgalmiModul;
}

import type { ModulokState } from "./modulok";

export interface EljaroUgyved {
  nev: string;
  kaszSzam: string;
  iroda: string;
  irodaCim: string;
  email?: string;
  telefon?: string;
  website?: string;
  rovidHeader?: string;
  logoDataUrl?: string;
  pecsetDataUrl?: string;
}

export interface IntakeStatus {
  token: string;
  letrehozva: string;
  utoljaraMentve: string;
  beadva: boolean;
  beadvaIdo: string;
}

export interface IntakeLinks {
  elado: IntakeStatus;
  vevo: IntakeStatus;
}

export interface CaseFile {
  id?: string;
  cimke?: string;
  utoljaraMentve?: string;
  ugyAzonosito: string;
  letrehozva: string;
  eljaroUgyved: EljaroUgyved;
  transactionTypes: TransactionType[];
  parties: Party[];
  property: Property;
  payment: PaymentPlan;
  possession: Possession;
  special: SpecialRules;
  modulok: ModulokState;
  intake: IntakeLinks;
}


export type Severity = "alacsony" | "kozepes" | "magas" | "kritikus";

export interface RiskFlag {
  id: string;
  cim: string;
  severity: Severity;
  miert: string;
  ellenorizendo: string;
}

export type MissingGroup =
  | "felek"
  | "ingatlan"
  | "vetelar"
  | "fizetes"
  | "birtokbaadas"
  | "specialis_jovahagyasok"
  | "mellekletek";

export interface MissingField {
  group: MissingGroup;
  field: string;
  reszlet?: string;
}

export interface AttachmentItem {
  cim: string;
  kotelezo: boolean;
  indok: string;
}

export interface GeneratedDocument {
  cim: string;
  tartalom: string;
}

export const DRAFT_BANNER =
  "TERVEZET — ügyvédi ellenőrzés és ellenjegyzés szükséges. A rendszer nem helyettesíti az ügyvéd szakmai döntését.";

export const INTERNAL_FOOTER =
  "Szladits Magánjogi Asszisztens — belső tesztverzió ügyvédi irodák számára. Nem nyilvános termék.";
