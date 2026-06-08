import { useState } from "react";
import type { CaseFile } from "@/lib/legal/types";
import {
  B400E_BEKULDO_LABELS,
  B400E_STATUSZ_LABELS,
  mockJubLekerdezes,
  type B400EBekuldo,
  type B400EStatusz,
} from "@/lib/legal/modulok";
import { szamolIlletek, bemenetCasebol, formatHuf } from "@/lib/legal/illetek";
import { generateB400Pdf, generatePmtPdf, generateIlletekPdf, downloadBlob } from "@/lib/legal/pdf";
import { JOGSZABALYOK } from "@/lib/legal/jogszabaly";
import { Button } from "@/components/ui/button";

interface Props {
  c: CaseFile;
  update: (fn: (d: CaseFile) => void) => void;
}

const inputCls =
  "rounded-md border border-input bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full";

function L({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}
function Box({
  title,
  link,
  children,
}: {
  title: string;
  link?: { rovid: string; url: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4 mb-4">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        {title}
        {link && (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline text-primary"
          >
            {link.rovid} ↗
          </a>
        )}
      </h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

export function Modulok({ c, update }: Props) {
  const [jubInput, setJubInput] = useState({ nev: "", okmanySzam: "", okmanyTipus: "szig" });

  const ill = szamolIlletek(bemenetCasebol(c));
  const customIll = szamolIlletek({
    ...bemenetCasebol(c),
    elsoLakas: false,
    cserepotlo: false,
    cserepotloKulonbozet: 0,
    csok: false,
    csalad5MFt: false,
    testverKozott: false,
    egyenesAgiRokon: false,
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3 border-b border-border pb-2">
        Speciális és okirat-előkészítő modulok
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Minden export és számítás <strong>előkészítő</strong> dokumentum, ügyvédi ellenőrzés és
        aláírás szükséges. A B400E illetékbejelentés tényleges beadása az ONYA felületen,
        KAÜ/Ügyfélkapu/DÁP azonosítással történik.
      </p>

      {/* Ellenőrzési checklist */}
      <Box title="Ellenőrizendő dokumentumok (külső beszerzés)">
        <p className="text-xs text-muted-foreground">
          A rendszer nem tudja lekérni a tulajdoni lapot, cégkivonatot, gyámhatósági határozatot —
          az ügyvédnek kell beszereznie. Jelöld be, amit már beszereztél.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <Check
            checked={c.modulok.ellenorzes.tulajdoniLapBeszerezve}
            onChange={(v) => update((d) => void (d.modulok.ellenorzes.tulajdoniLapBeszerezve = v))}
            label="Hiteles tulajdoni lap (E-hiteles)"
          />
          <input
            type="date"
            className={inputCls}
            value={c.modulok.ellenorzes.tulajdoniLapDatuma}
            onChange={(e) =>
              update((d) => void (d.modulok.ellenorzes.tulajdoniLapDatuma = e.target.value))
            }
          />
          <Check
            checked={c.modulok.ellenorzes.terkepmasolatBeszerezve}
            onChange={(v) => update((d) => void (d.modulok.ellenorzes.terkepmasolatBeszerezve = v))}
            label="Térképmásolat"
          />
          <Check
            checked={c.modulok.ellenorzes.cegkivonatBeszerezve}
            onChange={(v) => update((d) => void (d.modulok.ellenorzes.cegkivonatBeszerezve = v))}
            label="Friss cégkivonat (céges fél esetén)"
          />
          <input
            type="date"
            className={inputCls}
            value={c.modulok.ellenorzes.cegkivonatDatuma}
            onChange={(e) =>
              update((d) => void (d.modulok.ellenorzes.cegkivonatDatuma = e.target.value))
            }
          />
          <Check
            checked={c.modulok.ellenorzes.alarrasiCimpeldanyBeszerezve}
            onChange={(v) =>
              update((d) => void (d.modulok.ellenorzes.alarrasiCimpeldanyBeszerezve = v))
            }
            label="Aláírási címpéldány / aláírásminta"
          />
          <Check
            checked={c.modulok.ellenorzes.gyamhatosagiHatarozatBeszerezve}
            onChange={(v) =>
              update((d) => void (d.modulok.ellenorzes.gyamhatosagiHatarozatBeszerezve = v))
            }
            label="Gyámhatósági jóváhagyás"
          />
          <input
            className={inputCls}
            placeholder="Gyámh. hat. szám"
            value={c.modulok.ellenorzes.gyamhatosagiHatarozatSzama}
            onChange={(e) =>
              update((d) => void (d.modulok.ellenorzes.gyamhatosagiHatarozatSzama = e.target.value))
            }
          />
          <Check
            checked={c.modulok.ellenorzes.okmanyellenorzes}
            onChange={(v) => update((d) => void (d.modulok.ellenorzes.okmanyellenorzes = v))}
            label="Okmányok átvizsgálva (JÜB)"
          />
          <Check
            checked={c.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve}
            onChange={(v) =>
              update((d) => void (d.modulok.ellenorzes.energetikaiTanusitvanyBeszerezve = v))
            }
            label="Energetikai tanúsítvány (176/2008.)"
          />
        </div>
        <textarea
          className={`${inputCls} min-h-[50px]`}
          placeholder="Egyéb megjegyzés"
          value={c.modulok.ellenorzes.egyebJegyzet}
          onChange={(e) => update((d) => void (d.modulok.ellenorzes.egyebJegyzet = e.target.value))}
        />
      </Box>

      {/* Illetékkalkulátor */}
      <Box title="Illetékkalkulátor (visszterhes vagyonátruházási illeték)" link={JOGSZABALYOK.itv}>
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Vételár (Ft, ügyiratból)">
            <input className={inputCls} value={c.payment.teljesVetelar} readOnly />
          </Field>
          <Field label="Vevő kora (számítva)">
            <input className={inputCls} value={String(bemenetCasebol(c).vevoKor ?? "—")} readOnly />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <Check
            checked={c.modulok.b400.illetekkedvezmenyKod === "elso_lakas_35"}
            onChange={(v) =>
              update((d) => void (d.modulok.b400.illetekkedvezmenyKod = v ? "elso_lakas_35" : ""))
            }
            label="35 év alatti első lakás (50%, 15M-ig)"
          />
          <Check
            checked={c.modulok.b400.illetekkedvezmenyKod === "csok_plus"}
            onChange={(v) =>
              update((d) => void (d.modulok.b400.illetekkedvezmenyKod = v ? "csok_plus" : ""))
            }
            label="CSOK Plusz alapú mentesség"
          />
          <Check
            checked={c.modulok.b400.illetekkedvezmenyKod === "cserepotlo"}
            onChange={(v) =>
              update((d) => void (d.modulok.b400.illetekkedvezmenyKod = v ? "cserepotlo" : ""))
            }
            label="Cserepótló (1 éven belül)"
          />
          <Check
            checked={c.modulok.b400.illetekkedvezmenyKod === "egyenes_agi"}
            onChange={(v) =>
              update((d) => void (d.modulok.b400.illetekkedvezmenyKod = v ? "egyenes_agi" : ""))
            }
            label="Egyenes ági rokon (mentes)"
          />
          <Check
            checked={c.modulok.b400.illetekkedvezmenyKod === "testver"}
            onChange={(v) =>
              update((d) => void (d.modulok.b400.illetekkedvezmenyKod = v ? "testver" : ""))
            }
            label="Testvérek között (mentes)"
          />
        </div>
        {(() => {
          const code = c.modulok.b400.illetekkedvezmenyKod;
          const customBemenet = {
            ...bemenetCasebol(c),
            elsoLakas: code === "elso_lakas_35",
            csok: code === "csok_plus",
            elsoLakasKedvezmenyNelkul: code === "csok_plus",
            cserepotlo: code === "cserepotlo",
            cserepotloKulonbozet: code === "cserepotlo" ? Number(c.payment.teljesVetelar) * 0.3 : 0,
            egyenesAgiRokon: code === "egyenes_agi",
            testverKozott: code === "testver",
          };
          const result = szamolIlletek(customBemenet);
          return (
            <div className="mt-3 rounded-md bg-secondary p-3 text-sm">
              <div>
                Alap: <strong>{formatHuf(result.alap)}</strong>
              </div>
              <div>
                Számított illeték: <strong>{formatHuf(result.szamitottIlletek)}</strong>
              </div>
              {result.kedvezmenyek.map((k, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  − {k.cim}: {formatHuf(k.osszeg)}
                </div>
              ))}
              <div className="text-lg font-bold mt-2">Fizetendő: {formatHuf(result.fizetendo)}</div>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
                {result.magyarazat.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          );
        })()}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadBlob(generateIlletekPdf(c), `${c.ugyAzonosito || "illetek"}-szamitas.pdf`)
          }
        >
          Illeték PDF export
        </Button>
      </Box>

      {/* B400E / ONYA */}
      <Box title="B400E / ONYA — illetékbejelentés előkészítő" link={JOGSZABALYOK.itv}>
        <p className="text-xs text-muted-foreground">
          A rendszer az ONYA B400E adatlap kitöltéséhez készít adatösszefoglalót. Elektronikus
          beküldést nem végez; a beküldést az arra jogosult személy vagy képviselő saját
          azonosítással intézi.{" "}
          <a
            className="underline text-primary"
            target="_blank"
            rel="noreferrer"
            href="https://nav.gov.hu/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/B400-copy1"
          >
            NAV B400E tájékoztató
          </a>
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Munkafolyamat státusza">
            <select
              className={inputCls}
              value={c.modulok.b400.statusz}
              onChange={(e) =>
                update((d) => void (d.modulok.b400.statusz = e.target.value as B400EStatusz))
              }
            >
              {Object.entries(B400E_STATUSZ_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ONYA beküldő">
            <select
              className={inputCls}
              value={c.modulok.b400.bekuldo}
              onChange={(e) =>
                update((d) => void (d.modulok.b400.bekuldo = e.target.value as B400EBekuldo))
              }
            >
              {Object.entries(B400E_BEKULDO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Beküldés dátuma">
            <input
              type="date"
              className={inputCls}
              value={c.modulok.b400.bekuldesDatuma}
              onChange={(e) => update((d) => void (d.modulok.b400.bekuldesDatuma = e.target.value))}
            />
          </Field>
          <Field label="Szerződés dátuma">
            <input
              type="date"
              className={inputCls}
              value={c.modulok.b400.szerzodesDatuma}
              onChange={(e) =>
                update((d) => void (d.modulok.b400.szerzodesDatuma = e.target.value))
              }
            />
          </Field>
          <Field label="Szerzett hányad">
            <input
              className={inputCls}
              value={c.modulok.b400.szerzettHanyad}
              onChange={(e) => update((d) => void (d.modulok.b400.szerzettHanyad = e.target.value))}
            />
          </Field>
          <Field label="Forgalmi érték (Ft)">
            <input
              className={inputCls}
              value={c.modulok.b400.forgalmiErtek}
              onChange={(e) => update((d) => void (d.modulok.b400.forgalmiErtek = e.target.value))}
            />
          </Field>
          <Field label="NAV nyugtaazonosító">
            <input
              className={inputCls}
              value={c.modulok.b400.navNyugtaAzonosito}
              onChange={(e) =>
                update((d) => void (d.modulok.b400.navNyugtaAzonosito = e.target.value))
              }
            />
          </Field>
        </div>
        <Check
          checked={c.modulok.b400.meghatalmazasRendelkezesreAll}
          onChange={(v) => update((d) => void (d.modulok.b400.meghatalmazasRendelkezesreAll = v))}
          label="Kifejezett meghatalmazás rendelkezésre áll, ha nem a vagyonszerző küldi be"
        />
        <Check
          checked={c.modulok.b400.onyaUtmutatoEllenorizve}
          onChange={(v) => update((d) => void (d.modulok.b400.onyaUtmutatoEllenorizve = v))}
          label="ONYA B400E kitöltési útvonal ellenőrizve az adott ügylethez"
        />
        <textarea
          className={`${inputCls} min-h-[50px]`}
          placeholder="Megjegyzés"
          value={c.modulok.b400.megjegyzes}
          onChange={(e) => update((d) => void (d.modulok.b400.megjegyzes = e.target.value))}
        />
        <Button
          size="sm"
          onClick={() =>
            downloadBlob(generateB400Pdf(c), `${c.ugyAzonosito || "b400e"}-onya-elokeszito.pdf`)
          }
        >
          B400E / ONYA előkészítő PDF
        </Button>
      </Box>

      {/* Pmt. */}
      <Box title="Pénzmosási (Pmt.) ügyfél-átvilágítási adatlap" link={JOGSZABALYOK.pmt}>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Azonosítás módja">
            <select
              className={inputCls}
              value={c.modulok.pmt.azonositasModja}
              onChange={(e) =>
                update(
                  (d) =>
                    void (d.modulok.pmt.azonositasModja = e.target.value as
                      | "szemelyes"
                      | "elektronikus"
                      | "video"),
                )
              }
            >
              <option value="szemelyes">Személyes</option>
              <option value="elektronikus">Elektronikus</option>
              <option value="video">Audiovizuális</option>
            </select>
          </Field>
          <Field label="Kockázati besorolás">
            <select
              className={inputCls}
              value={c.modulok.pmt.kockazatiBesorolas}
              onChange={(e) =>
                update(
                  (d) =>
                    void (d.modulok.pmt.kockazatiBesorolas = e.target.value as
                      | "alacsony"
                      | "kozepes"
                      | "magas"),
                )
              }
            >
              <option value="alacsony">Alacsony</option>
              <option value="kozepes">Közepes</option>
              <option value="magas">Magas</option>
            </select>
          </Field>
        </div>
        <h4 className="text-sm font-semibold mt-2">Tényleges tulajdonos (Pmt. 9. §)</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Név">
            <input
              className={inputCls}
              value={c.modulok.pmt.tenylegesTulajdonosNeve}
              onChange={(e) =>
                update((d) => void (d.modulok.pmt.tenylegesTulajdonosNeve = e.target.value))
              }
            />
          </Field>
          <Field label="Lakcím">
            <input
              className={inputCls}
              value={c.modulok.pmt.tenylegesTulajdonosCim}
              onChange={(e) =>
                update((d) => void (d.modulok.pmt.tenylegesTulajdonosCim = e.target.value))
              }
            />
          </Field>
          <Field label="Szül. hely">
            <input
              className={inputCls}
              value={c.modulok.pmt.tenylegesTulajdonosSzulHely}
              onChange={(e) =>
                update((d) => void (d.modulok.pmt.tenylegesTulajdonosSzulHely = e.target.value))
              }
            />
          </Field>
          <Field label="Szül. idő">
            <input
              type="date"
              className={inputCls}
              value={c.modulok.pmt.tenylegesTulajdonosSzulIdo}
              onChange={(e) =>
                update((d) => void (d.modulok.pmt.tenylegesTulajdonosSzulIdo = e.target.value))
              }
            />
          </Field>
          <Field label="Tulajdoni részesedés (%)">
            <input
              className={inputCls}
              value={c.modulok.pmt.tulajdoniReszesedes}
              onChange={(e) =>
                update((d) => void (d.modulok.pmt.tulajdoniReszesedes = e.target.value))
              }
            />
          </Field>
        </div>
        <Check
          checked={c.modulok.pmt.pep}
          onChange={(v) => update((d) => void (d.modulok.pmt.pep = v))}
          label="Kiemelt közszereplő (PEP)"
        />
        {c.modulok.pmt.pep && (
          <input
            className={inputCls}
            placeholder="PEP részletek (tisztség, ország, időszak)"
            value={c.modulok.pmt.pepReszlet}
            onChange={(e) => update((d) => void (d.modulok.pmt.pepReszlet = e.target.value))}
          />
        )}
        <textarea
          className={`${inputCls} min-h-[50px]`}
          placeholder="Kockázati besorolás indoklása"
          value={c.modulok.pmt.kockazatiIndok}
          onChange={(e) => update((d) => void (d.modulok.pmt.kockazatiIndok = e.target.value))}
        />
        <Check
          checked={c.modulok.pmt.forrasIgazolt}
          onChange={(v) => update((d) => void (d.modulok.pmt.forrasIgazolt = v))}
          label="Vagyon eredete igazolt"
        />
        <textarea
          className={`${inputCls} min-h-[40px]`}
          placeholder="Forrás megjegyzés"
          value={c.modulok.pmt.forrasMegjegyzes}
          onChange={(e) => update((d) => void (d.modulok.pmt.forrasMegjegyzes = e.target.value))}
        />
        <Button
          size="sm"
          onClick={() =>
            downloadBlob(generatePmtPdf(c), `${c.ugyAzonosito || "pmt"}-atvilagitas.pdf`)
          }
        >
          Pmt. adatlap PDF
        </Button>
      </Box>

      {/* JÜB mock */}
      <Box title="JÜB lekérdezés (MOCK / demo)" link={JOGSZABALYOK.uttv}>
        <div className="rounded-md border-l-4 border-destructive bg-destructive/5 p-2 text-xs">
          <strong>FIGYELEM:</strong> ez szimulált demo eredmény. A valódi JÜB-lekérdezés ügyvédi
          azonosítást és külön rendszerhozzáférést igényel. A mock eredményt SOHA NE használd valódi
          ügyletben.
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Név">
            <input
              className={inputCls}
              value={jubInput.nev}
              onChange={(e) => setJubInput((s) => ({ ...s, nev: e.target.value }))}
            />
          </Field>
          <Field label="Okmányszám">
            <input
              className={inputCls}
              value={jubInput.okmanySzam}
              onChange={(e) => setJubInput((s) => ({ ...s, okmanySzam: e.target.value }))}
            />
          </Field>
          <Field label="Okmány típus">
            <select
              className={inputCls}
              value={jubInput.okmanyTipus}
              onChange={(e) => setJubInput((s) => ({ ...s, okmanyTipus: e.target.value }))}
            >
              <option value="szig">Szem. ig.</option>
              <option value="utlevel">Útlevél</option>
              <option value="jogositvany">Jogosítvány</option>
            </select>
          </Field>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => update((d) => void (d.modulok.jub = mockJubLekerdezes(jubInput)))}
        >
          Mock JÜB futtatása
        </Button>
        {c.modulok.jub && (
          <div className="rounded-md bg-secondary p-3 text-sm mt-2">
            <div className="text-xs text-muted-foreground">Mock ID: {c.modulok.jub.mockId}</div>
            <div>
              Név: <strong>{c.modulok.jub.nev}</strong>
            </div>
            <div>
              Okmány: {c.modulok.jub.okmanyTipus} / {c.modulok.jub.okmanySzam}
            </div>
            <div>
              Státusz:{" "}
              <span className="font-bold text-green-700">{c.modulok.jub.status.toUpperCase()}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Lekérdezés ideje: {new Date(c.modulok.jub.lekerdezesIdeje).toLocaleString("hu-HU")}
            </div>
            <div className="text-[10px] text-destructive mt-1">[DEMO] Nem valódi JÜB eredmény.</div>
          </div>
        )}
      </Box>

      {/* Külföldi vevő */}
      <Box title="Külföldi vevő — ingatlanszerzési engedély" link={JOGSZABALYOK.kulfoldi}>
        <Check
          checked={c.modulok.kulfoldi.alkalmazando}
          onChange={(v) => update((d) => void (d.modulok.kulfoldi.alkalmazando = v))}
          label="Modul alkalmazandó (külföldi vevő, nem termőföld)"
        />
        {c.modulok.kulfoldi.alkalmazando && (
          <>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="Vevő állampolgársága">
                <input
                  className={inputCls}
                  value={c.modulok.kulfoldi.vevoAllampolgarsag}
                  onChange={(e) =>
                    update((d) => void (d.modulok.kulfoldi.vevoAllampolgarsag = e.target.value))
                  }
                />
              </Field>
              <Check
                checked={c.modulok.kulfoldi.eea}
                onChange={(v) => update((d) => void (d.modulok.kulfoldi.eea = v))}
                label="EGT-állam polgára (mentesülhet engedély alól)"
              />
            </div>
            <Check
              checked={c.modulok.kulfoldi.engedelyKerelmeKell}
              onChange={(v) => update((d) => void (d.modulok.kulfoldi.engedelyKerelmeKell = v))}
              label="Engedély kérelme szükséges (251/2014. Korm. r.)"
            />
            <textarea
              className={`${inputCls} min-h-[60px]`}
              placeholder="Szándéknyilatkozat (kérelem tartalma)"
              value={c.modulok.kulfoldi.szandeknyilatkozat}
              onChange={(e) =>
                update((d) => void (d.modulok.kulfoldi.szandeknyilatkozat = e.target.value))
              }
            />
            <Check
              checked={c.modulok.kulfoldi.kerelemElokeszitve}
              onChange={(v) => update((d) => void (d.modulok.kulfoldi.kerelemElokeszitve = v))}
              label="Kérelem előkészítve a fővárosi/megyei kormányhivatalhoz"
            />
            <textarea
              className={`${inputCls} min-h-[40px]`}
              placeholder="Megjegyzés"
              value={c.modulok.kulfoldi.megjegyzes}
              onChange={(e) => update((d) => void (d.modulok.kulfoldi.megjegyzes = e.target.value))}
            />
          </>
        )}
      </Box>

      {/* Társasházi */}
      <Box title="Társasházi vizsgálat" link={JOGSZABALYOK.tarsashazi}>
        <Check
          checked={c.modulok.tarsashaz.alapitoOkiratEllenoirzve}
          onChange={(v) => update((d) => void (d.modulok.tarsashaz.alapitoOkiratEllenoirzve = v))}
          label="Alapító okirat áttanulmányozva"
        />
        <Check
          checked={c.modulok.tarsashaz.szmszEllenoirzve}
          onChange={(v) => update((d) => void (d.modulok.tarsashaz.szmszEllenoirzve = v))}
          label="SZMSZ áttanulmányozva"
        />
        <Check
          checked={c.modulok.tarsashaz.kozosKoltsegTartozasEllenoirizve}
          onChange={(v) =>
            update((d) => void (d.modulok.tarsashaz.kozosKoltsegTartozasEllenoirizve = v))
          }
          label="Közös költség tartozás ellenőrizve (közös képviselő igazolás)"
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Tartozás összege (Ft)">
            <input
              className={inputCls}
              value={c.modulok.tarsashaz.kozosKoltsegTartozasOsszeg}
              onChange={(e) =>
                update(
                  (d) => void (d.modulok.tarsashaz.kozosKoltsegTartozasOsszeg = e.target.value),
                )
              }
            />
          </Field>
          <Field label="Közös képviselő">
            <input
              className={inputCls}
              value={c.modulok.tarsashaz.kozosKepviseloNev}
              onChange={(e) =>
                update((d) => void (d.modulok.tarsashaz.kozosKepviseloNev = e.target.value))
              }
            />
          </Field>
          <Field label="Felújítási alap">
            <input
              className={inputCls}
              value={c.modulok.tarsashaz.felujitasiAlap}
              onChange={(e) =>
                update((d) => void (d.modulok.tarsashaz.felujitasiAlap = e.target.value))
              }
            />
          </Field>
        </div>
        <Check
          checked={c.modulok.tarsashaz.kozosKepviseloIgazolas}
          onChange={(v) => update((d) => void (d.modulok.tarsashaz.kozosKepviseloIgazolas = v))}
          label="Közös képviselő tartozásmentességi igazolás beszerezve"
        />
        <Check
          checked={c.modulok.tarsashaz.hazirendAtadva}
          onChange={(v) => update((d) => void (d.modulok.tarsashaz.hazirendAtadva = v))}
          label="Házirend átadva a vevőnek"
        />
        <textarea
          className={`${inputCls} min-h-[40px]`}
          placeholder="Egyéb megjegyzés"
          value={c.modulok.tarsashaz.megjegyzes}
          onChange={(e) => update((d) => void (d.modulok.tarsashaz.megjegyzes = e.target.value))}
        />
      </Box>

      <p className="text-[10px] text-muted-foreground mt-2">
        <span title="Nemzeti Jogszabálytár">
          <a className="underline" target="_blank" rel="noreferrer" href="https://njt.hu/">
            njt.hu
          </a>
        </span>{" "}
        — a hatály automatikusan nem frissül; minden klauzula és modul ügyvédi visszaigazolást
        igényel.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <L>{label}</L>
      {children}
    </label>
  );
}
function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[color:var(--primary)]"
      />
      <span>{label}</span>
    </label>
  );
}
