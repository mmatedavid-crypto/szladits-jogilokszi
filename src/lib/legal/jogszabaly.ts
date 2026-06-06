// Hatályos magyar jogszabályok deep-link regisztere (njt.hu)
// FIGYELEM: a hatály automatikusan nem frissül, ügyvédi visszaigazolás szükséges.

export interface JogszabalyRef {
  rovid: string;
  teljes: string;
  url: string;
  szakasz?: string;
}

export const JOGSZABALYOK = {
  ptk: {
    rovid: "Ptk.",
    teljes: "2013. évi V. törvény a Polgári Törvénykönyvről",
    url: "https://njt.hu/jogszabaly/2013-5-00-00",
  },
  inytv: {
    rovid: "Inytv.",
    teljes: "1997. évi CXLI. törvény az ingatlan-nyilvántartásról",
    url: "https://njt.hu/jogszabaly/1997-141-00-00",
  },
  itv: {
    rovid: "Itv.",
    teljes: "1990. évi XCIII. törvény az illetékekről",
    url: "https://njt.hu/jogszabaly/1990-93-00-00",
  },
  pmt: {
    rovid: "Pmt.",
    teljes: "2017. évi LIII. törvény a pénzmosás megelőzéséről",
    url: "https://njt.hu/jogszabaly/2017-53-00-00",
  },
  foldforgalmi: {
    rovid: "Földforgalmi tv.",
    teljes: "2013. évi CXXII. törvény a mező- és erdőgazdasági földek forgalmáról",
    url: "https://njt.hu/jogszabaly/2013-122-00-00",
  },
  kulfoldi: {
    rovid: "251/2014. (X. 2.) Korm. r.",
    teljes: "251/2014. Korm. rendelet a külföldiek mező- és erdőgazdasági hasznosítású földnek nem minősülő ingatlanokat érintő tulajdonszerzéséről",
    url: "https://njt.hu/jogszabaly/2014-251-20-22",
  },
  uttv: {
    rovid: "Üttv.",
    teljes: "2017. évi LXXVIII. törvény az ügyvédi tevékenységről",
    url: "https://njt.hu/jogszabaly/2017-78-00-00",
  },
  tarsashazi: {
    rovid: "Társasházi tv.",
    teljes: "2003. évi CXXXIII. törvény a társasházakról",
    url: "https://njt.hu/jogszabaly/2003-133-00-00",
  },
  energetikai: {
    rovid: "176/2008. (VI. 30.) Korm. r.",
    teljes: "176/2008. Korm. rendelet az épületek energetikai jellemzőinek tanúsításáról",
    url: "https://njt.hu/jogszabaly/2008-176-20-22",
  },
} as const satisfies Record<string, JogszabalyRef>;

export type JogszabalyKulcs = keyof typeof JOGSZABALYOK;
