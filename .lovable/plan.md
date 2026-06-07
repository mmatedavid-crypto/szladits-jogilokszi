## Cél

Komoly, fehér ügyvédi landing oldal + Google bejelentkezés + fiókhoz kötött ügytárolás Lovable Cloudban, RLS-sel. A meglévő Workspace funkcióit (klauzula review, contract generation, PDF/DOCX export, intake linkek, legal verify script) érintetlenül hagyjuk — csak a perzisztencia réteget cseréljük.

## 1. Lovable Cloud bekapcsolása + Google auth

- Cloud enable.
- Google provider konfig (`supabase--configure_social_auth`).
- Apple most kimarad — később ön intézi a Services ID/Key konfigot a Cloud Auth panelban.

## 2. Adatmodell (single JSON-blob megközelítés)

A jelenlegi `CaseFile` típus mély, beágyazott (parties, property, payment, possession, modulok, intake, clauseReviewStates, checklistStates…). Külön normalizált táblákba szétszedni most több kockázattal jár, mint haszonnal: az egész contract generator, clause matrix és intake flow `CaseFile` objektumon dolgozik. Egy refactor itt nagy eséllyel törne valamit a verify script alól.

Pragmatikus megoldás:

```text
public.matters
  id uuid pk
  user_id uuid → auth.users
  cimke text
  ugy_azonosito text
  data jsonb           -- a teljes CaseFile, kivéve id/user_id/timestamp
  letrehozva timestamptz
  utoljara_mentve timestamptz
  deleted_at timestamptz null     -- soft delete
  created_at, updated_at

public.intake_tokens
  token text pk
  matter_id uuid → matters(id)
  szerep text check ('elado','vevo')
  beadva bool, beadva_ido timestamptz
  created_at, updated_at
```

Indexek: `matters(user_id, utoljara_mentve desc)`, `intake_tokens(matter_id)`.

GRANTs + RLS minden táblára kötelezően kiadva:
- `matters`: csak `auth.uid() = user_id` lát/ír (SELECT/INSERT/UPDATE/DELETE). Anonra semmi.
- `intake_tokens`: tulajdonos ügyvéd CRUD-ot kap (`EXISTS matters WHERE user_id = auth.uid()`); az adatbekérő publikus oldal viszont **nem** olvas közvetlenül — ehelyett egy `get_intake_by_token(token)` SECURITY DEFINER függvény ad vissza csak a tokenhez tartozó minimális szeletet, és egy `save_intake_by_token(token, payload)` függvény ír. Így a `/adatbekero/$token` route továbbra is auth nélkül működik, de nem lát be az egész `matters.data`-ba.

## 3. Storage réteg csere

`src/lib/legal/state.ts` jelenleg localStorage-ot használ (`listCases`, `loadCase`, `saveCase`, `createCase`, `switchCase`, `duplicateCase`, `renameCase`, `deleteCase`, `findCaseByIntakeToken`).

Átalakítás:
- Bevezetünk egy `casesStore` modult amelynek ugyanaz a publikus API-ja (`listCases`, `loadCase`, …), de háttérben szerver fn-eket hív (`getMatters`, `getMatter`, `saveMatter`, `createMatter`, `deleteMatter`, `duplicateMatter`, `renameMatter`).
- Szerver fn-ek `requireSupabaseAuth` middleware-rel, `user_id = context.userId`.
- A Workspace komponensben az autosave debounce-olt `saveMatter`-t hív.
- Tiszta lap: localStorage-ot már nem írunk/olvasunk. Régi adat figyelmeztetés nélkül helyben marad a böngészőben, de nem importáljuk.
- `findCaseByIntakeToken` → a publikus intake oldal a fenti `get_intake_by_token` RPC-t hívja, nem localStorage-ot.

## 4. Route-ok

- `/` — új landing (Playfair Display címek, Inter body, sok fehér, mélykék #0D1B2A + arany #B89A5B akcent). Tartalom: hero + 4 funkciókártya + márkajegyek sáv + footer. Egyetlen elsődleges CTA: **„Asszisztens megnyitása"** → ha van session: `/app`, ha nincs: `/auth`.
- `/auth` — Google gomb + (disabled) Apple gomb tooltippel „Konfigurációra vár". Nincs email/password most.
- `/_authenticated/app` — a jelenlegi `Workspace`. Az `/` és `/app` szétválik: `/` mostantól landing.
- `_authenticated` layout: integration-managed `ssr: false`, `supabase.auth.getUser()` gate, signed-out → `/auth`.
- `/adatbekero/$token` változatlan public route.

## 5. UI design tokenek

`src/styles.css` bővítése a brand színekkel:
```
--brand-ink: 0D1B2A    (primary)
--brand-graphite: 2A2E34
--brand-slate: 6B7280
--brand-paper: F5F6F8  (background)
--brand-line: E6E8EC
--brand-gold: B89A5B   (accent)
```
+ Playfair Display (display) és Inter (body) Google Font linkek. Komponenseket semantic tokeneken keresztül színezünk.

## 6. Auth state plumbing

- Root route: egyetlen `onAuthStateChange` listener → `router.invalidate()` SIGNED_IN/OUT/USER_UPDATED-nél, `queryClient.invalidateQueries()` ha van session.
- `src/start.ts`: `attachSupabaseAuth` registráció a `functionMiddleware`-ben.

## 7. Tesztelés / validáció

- `bun scripts/verify-legal-demo.ts` — változatlanul fusson le, mert csak `contract.ts` / `clauseMatrix.ts` szerkezetre épül, amit nem érintünk.
- Smoke: bejelentkezés → új ügy → mentés → reload → ügy visszatöltődik. Kijelentkezés → `/app` redirect `/auth`-ra.
- `/adatbekero/$token` továbbra is auth nélkül elérhető.

## Mit NEM csinálok ebben a körben

- Nem szedem szét a CaseFile-t normalizált táblákra (matters / parties / properties / payments / encumbrances / possession / clause_review_states / checklist_states külön táblákba). Egy JSONB oszlop sokkal kisebb regressziós kockázat a meglévő contract/clause logikára. Ha később külön szeretné, az egy önálló migráció lesz.
- Nem építek marketing landinget (pricing, blog, careers). Egy oldal, egy CTA, komoly hangvétel.
- Nem nyúlok a `LawRef` struktúrához, klauzula matrixhoz, contract.ts-hez, contractPdf.ts-hez, clause review reporthoz, HIANYOS-TERVEZET guardrailhez.

## Ismert nyitott pontok jelzésre a reportban

- Apple OAuth provider konfig hiányzik (szándékos).
- A korábban localStorage-ban tárolt ügyek nem kerülnek importálásra (egyeztetett, „tiszta lap").
- A `saved_exports` táblát nem hozom létre, mert a jelenlegi export flow nem perzisztál export metaadatot — ha kell, külön körben.
