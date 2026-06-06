
# Szladits Magánjogi Asszisztens — Belső okiratszerkesztési tesztverzió

Belső, magyar nyelvű demo ügyvédi irodáknak: ingatlan adásvételi szerződés tervezetét állítja elő szabálylogika alapján. Nincs login, fizetés, marketing, publikus oldal. Minden kimenet "TERVEZET — ügyvédi ellenőrzés és ellenjegyzés szükséges" figyelmeztetéssel.

## Architektúra

- TanStack Start (meglévő stack), TypeScript strict
- Egyetlen útvonal: `/` (a teljes app egy stepper-alapú workspace)
- Állapot: React state + `localStorage` perzisztencia (autosave)
- Nincs backend, nincs külső API, nincs AI hívás — minden logika determinisztikus TS kód
- Nyomtatás: böngésző `window.print()`, plusz `.txt` és `.html` export
- Komoly, jogi/professzionális vizuális irány: világosszürke háttér, sötétkék (és másodlagos sötét bordó) akcentus, olvasható tipográfia, sűrű űrlapok. Design tokenek a `src/styles.css`-ben (oklch).

## Layout

```text
+--------------------------------------------------------------+
| Szladits Magánjogi Asszisztens                               |
| Belső okiratszerkesztési tesztverzió ügyvédi irodák számára  |
+----------------+---------------------------------------------+
| Lépések        | Aktív lépés űrlapjai                        |
| 1 Ügylet típus |                                             |
| 2 Felek        |                                             |
| 3 Ingatlan     |                                             |
| 4 Vételár      |                                             |
| 5 Birtokba ad. |                                             |
| 6 Speciális    |                                             |
| 7 Kimenetek    |                                             |
+----------------+---------------------------------------------+
| Élő panel: Hiányzó adatok | Kockázati flagek (folyamatosan)  |
+--------------------------------------------------------------+
| Footer: belső tesztverzió — nem nyilvános termék             |
+--------------------------------------------------------------+
```

A 7. lépés tabokra bomlik: Szerződéstervezet · Hiányzó adatok · Kockázati lista · Mellékletlista · Ügyleti összefoglaló.

Globális műveletek a fejlécben: `Demo adatok betöltése`, `Mentés törlése`, `Szerződés generálása`, `Nyomtatás / PDF`, `Export .html`, `Export .txt`, `Másolás vágólapra`.

## Adatmodell (`src/lib/legal/types.ts`)

`CaseFile`, `TransactionFlags`, `Party` (diszkriminált unió: `NaturalPerson` | `Company`), `Representative`, `Property`, `Encumbrances`, `PaymentPlan`, `Possession`, `SpecialRules` (földforgalmi, zártkert, kiskorú, gondnokolt, céges, külföldi), `GeneratedDocument`, `RiskFlag` (severity: `alacsony|közepes|magas|kritikus`), `MissingField` (csoportokba sorolva), `AttachmentItem`.

## Determinisztikus logikai modulok (`src/lib/legal/`)

Külön fájlok, tisztán tesztelhetők:

- `age.ts`: `calculateAge`, `determineCapacityStatus`
- `risks/minor.ts`: `detectMinorRisk`
- `risks/guardianship.ts`: `detectGuardianshipRisk`
- `risks/agricultural.ts`: `detectAgriculturalLandRisk`
- `risks/zartkert.ts`: `detectZartkertRisk`
- `risks/loan.ts`: `detectLoanRisk`
- `risks/encumbrance.ts`: `detectEncumbranceRisk`
- `risks/company.ts`: `detectCompanyPartyRisk`
- `risks/foreign.ts`: `detectForeignPartyRisk`
- `missing.ts`: `detectMissingFields` (csoportosítva: felek/ingatlan/vételár/fizetés/birtokbaadás/jóváhagyások/mellékletek)
- `riskFlags.ts`: `generateRiskFlags` (a fenti detect-ek összevonása)
- `attachments.ts`: `generateAttachmentList` (feltételes mellékletek)
- `summary.ts`: `generateCaseSummary`
- `contract.ts`: `generateContractDraft` (template-alapú szerződésszöveg)

Minden generált dokumentum első sora:
`TERVEZET — ügyvédi ellenőrzés és ellenjegyzés szükséges. A rendszer nem helyettesíti az ügyvéd szakmai döntését.`

## Workflow lépések (kötelező mezők szerint)

1. **Ügylet típusa** — checkbox-lista a megadott típusokkal (lakás … vegyes, hitellel/tehermentesítéssel érintett, céges fél). Zártkert választása alkérdést nyit. Termőföld/tanya/agrár-zártkert automatikusan aktiválja a Földforgalmi modult a 6. lépésben.
2. **Felek** — dinamikus lista (több eladó/vevő). Természetes személy / cég váltó. Természetes személynél `calculateAge` automatikusan beállítja a státuszt: 14 alatt cselekvőképtelen kiskorú; 14–18 korlátozottan cselekvőképes; 18+ nagykorú + cselekvőképesség selector. Kiskorúnál törvényes képviselő blokk + gyámhatósági jóváhagyás (default „ügyvédi ellenőrzést igényel"). Cégnél cégkivonat / aláírási címpéldány mezők. Külföldi állampolgárság vagy külföldi székhely külön kockázatot generál.
3. **Ingatlan** — cím, hrsz, típus, művelési ág, alapterület, tulajdoni hányad, társasházi/teremgarázs flagek, energetikai tanúsítvány, birtoklási állapot. Tulajdoni lap teher-toggle-ök → automatikus kockázatok és tehermentesítési követelmény.
4. **Vételár és fizetés** — összeg, pénznem, foglaló/előleg/önerő/hitel/letét/részletfizetés. Hitelnél bank, összeg, folyósítási határidő, és kötelező kockázati klauzulák (banki folyósítás, bejegyzési engedély kezelése, függőben tartás placeholder, jelzálog/elidegenítési tilalom).
5. **Birtokbaadás** — dátum, feltételek, közmű, kulcs, kiköltözés, ingóságok, kötbér.
6. **Speciális modulok** — feltételesen megjelenő szekciók: Földforgalmi ellenőrző · Zártkert · Kiskorú/gondnokolt · Céges fél · Külföldi fél. Mindegyik az adott check-listával és kötelező figyelmeztetésekkel.
7. **Kimenetek** — 5 tab: szerződéstervezet, hiányzó adatok, kockázati lista (cím, súlyosság, miért fontos, mit ellenőrizzen az ügyvéd), mellékletlista, ügyleti összefoglaló.

## Élő mellék-panel

A jobb/alsó panel folyamatosan futtatja `detectMissingFields` és `generateRiskFlags` függvényeket az aktuális állapoton, hogy az ügyvéd minden lépésnél lássa a hiányokat és kockázatokat — nem csak a 7. lépésnél.

## Szerződéstervezet sablon

Magyar, szakaszolt sablon (Felek · Előzmények · Az ingatlan · Vételár és fizetés · Tehermentesítés · Birtokbaadás · Szavatosság és nyilatkozatok · Kiskorú/korlátozott cselekvőképesség speciális rendelkezései · Termőföld/földforgalmi figyelmeztetés · Mellékletek · Záró rendelkezések · Aláírások · Ügyvédi ellenjegyzés placeholder). A szakaszok feltételesen jelennek meg a flagek alapján. Minden szöveg `TERVEZET` jelöléssel és „jogi review szükséges" lábjegyzettel.

## Tiltott / engedett szóhasználat

Tiltva: „végleges szerződés", „jogilag garantált", „mindig hatályos jogszabályoknak megfelelő", „ügyvéd nélkül használható". Használva: „ügyvédi ellenőrzésre előkészített tervezet", „szabálylogikával támogatott okiratszerkesztési demo", „belső tesztverzió ügyvédi irodák számára", „jogi review szükséges". Lint-szerű ellenőrzés nem kell — a sablonok fixek.

## Fájlszerkezet

```text
src/
  routes/index.tsx                 # workspace shell (header, sidebar, panels)
  components/legal/
    StepSidebar.tsx
    LivePanel.tsx                  # hiányzó adatok + kockázatok élőben
    steps/Step1Transaction.tsx
    steps/Step2Parties.tsx
    steps/Step3Property.tsx
    steps/Step4Payment.tsx
    steps/Step5Possession.tsx
    steps/Step6Special.tsx
    steps/Step7Outputs.tsx
    outputs/ContractDraft.tsx
    outputs/MissingList.tsx
    outputs/RiskList.tsx
    outputs/AttachmentList.tsx
    outputs/CaseSummary.tsx
    PartyEditor.tsx
    EncumbranceEditor.tsx
    Toolbar.tsx                    # globális akciógombok
  lib/legal/
    types.ts
    state.ts                       # localStorage perzisztencia + demo data
    age.ts
    missing.ts
    attachments.ts
    summary.ts
    contract.ts
    riskFlags.ts
    risks/{minor,guardianship,agricultural,zartkert,loan,encumbrance,company,foreign}.ts
  styles.css                       # token frissítések (sötétkék/bordó akcentus)
```

## Korlátozások (a végén kommunikálva)

- Nem helyettesíti az ügyvédet; csak demo szabálylogika
- Földforgalmi modul csak ellenőrző lista, nem teljes automatizmus
- Tulajdoni lap és cégadat nincs lekérve külső rendszerből
- A sablon egy fix vázlat, nem minden ügyleti variációt fed le
- Nincs nyelvi/jogszabályi auto-frissítés

## Megvalósítási sorrend

1. Tokenek + layout shell (header, sidebar, élő panel, footer)
2. Adatmodell + localStorage + demo seed
3. Lépés 1–5 űrlapok
4. Determinisztikus logikai modulok (age/missing/risks/attachments/summary)
5. Lépés 6 speciális modulok
6. Szerződésgenerátor sablon
7. Lépés 7 kimeneti tabok + export/print
8. Élő panel bekötése, végső szövegellenőrzés, demo adatok finomítása
