import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `Te a "Szladits Magánjogi Asszisztens" jogi szakértői modulja vagy, MAGYAR ügyvédek számára.
Kizárólag magyar polgári jogi (különösen ingatlan adásvétel) kérdésekre válaszolj a HATÁLYOS magyar jogszabályok alapján.

KÖTELEZŐ szabályok:
1. MINDIG hivatkozz a konkrét hatályos jogszabályra (rövid név + szakasz), pl. "Ptk. 6:215. §", "Inytv. 32. §", "Itv. 21. §", "Pmt. 7. §", "Földforgalmi tv. (2013. évi CXXII. tv.) 18. §", "2017. évi LXXVIII. tv. (Üttv.) 43. §".
2. MINDEN válasz végén tedd hozzá: "⚖️ Forrás: njt.hu — a hatály ügyvédileg ellenőrizendő. Generálás dátuma: ${new Date().toLocaleDateString("hu-HU")}."
3. Ha a kérdés a felhasználó ügyiratára vonatkozik, használd a megadott ügyiratösszefoglalót.
4. SOHA ne adj végleges jogi tanácsot — minden válasz "AI-generált, ügyvédi ellenőrzés szükséges" jelleggel záruljon.
5. Ha bizonytalan vagy a hatályos szövegben (pl. 2024 utáni módosítás), jelezd egyértelműen: "[HATÁLY ELLENŐRIZENDŐ]".
6. Magyar nyelven válaszolj, tömören, strukturáltan (markdown).
7. Releváns njt.hu link sablon: https://njt.hu/jogszabaly/{év}-{szám}-00-00 — ha tudod, illeszd be.

Főbb releváns jogszabályok:
- 2013. évi V. tv. (Ptk.) — adásvétel, foglaló, szavatosság, képviselet, cselekvőképesség
- 1997. évi CXLI. tv. (Inytv.) — ingatlan-nyilvántartás, bejegyzés, függőben tartás
- 1990. évi XCIII. tv. (Itv.) — visszterhes vagyonátruházási illeték, kedvezmények
- 2017. évi LIII. tv. (Pmt.) — pénzmosási átvilágítás, tényleges tulajdonos
- 2013. évi CXXII. tv. (Földforgalmi tv.) — termőföld, elővásárlás, kifüggesztés
- 251/2014. (X. 2.) Korm. r. — külföldi ingatlanszerzés engedélye
- 2017. évi LXXVIII. tv. (Üttv.) — ügyvédi ellenjegyzés, letét
- 2003. évi CXXXIII. tv. (Társasházi tv.) — alapító okirat, SZMSZ
- 176/2008. (VI. 30.) Korm. r. — energetikai tanúsítvány`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages, ugyiratContext } = (await request.json()) as {
            messages?: UIMessage[];
            ugyiratContext?: string;
          };
          if (!Array.isArray(messages)) {
            return new Response("Messages required", { status: 400 });
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const gateway = createLovableAiGatewayProvider(key);
          const system =
            SYSTEM_PROMPT +
            (ugyiratContext
              ? `\n\nAKTUÁLIS ÜGYIRAT ÖSSZEFOGLALÓ:\n${ugyiratContext}`
              : "");

          const result = streamText({
            model: gateway("google/gemini-3-flash-preview"),
            system,
            messages: await convertToModelMessages(messages),
          });
          return result.toUIMessageStreamResponse({ originalMessages: messages });
        } catch (e) {
          console.error("chat error", e);
          return new Response("Chat error", { status: 500 });
        }
      },
    },
  },
});
