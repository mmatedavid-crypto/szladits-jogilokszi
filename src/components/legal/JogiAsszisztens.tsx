import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import type { CaseFile } from "@/lib/legal/types";
import { generateCaseSummary } from "@/lib/legal/logic";
import { JOGSZABALYOK } from "@/lib/legal/jogszabaly";

interface Props {
  c: CaseFile;
  onClose: () => void;
}

export function JogiAsszisztens({ c, onClose }: Props) {
  const [input, setInput] = useState("");
  const ugyiratContext = generateCaseSummary(c);
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    body: { ugyiratContext },
  });
  const { messages, sendMessage, status } = useChat({
    id: "szladits-jogi-asszisztens",
    transport,
  });
  const loading = status === "submitted" || status === "streaming";

  const send = async () => {
    if (!input.trim() || loading) return;
    const t = input.trim();
    setInput("");
    await sendMessage({ text: t });
  };

  const quick = (q: string) => {
    setInput(q);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border bg-primary text-primary-foreground">
        <div>
          <div className="font-semibold text-sm">Jogi asszisztens (AI)</div>
          <div className="text-[10px] opacity-80">
            Hatályos magyar jogszabályok alapján — ügyvédi visszaigazolás szükséges
          </div>
        </div>
        <button onClick={onClose} className="text-primary-foreground/80 hover:text-primary-foreground text-xl px-2">×</button>
      </div>

      <div className="px-3 py-2 border-b border-border bg-secondary/40 text-[11px] flex flex-wrap gap-1">
        {Object.values(JOGSZABALYOK).map((j) => (
          <a
            key={j.rovid}
            href={j.url}
            target="_blank"
            rel="noreferrer"
            className="underline text-primary hover:opacity-80"
            title={j.teljes}
          >
            {j.rovid}
          </a>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="text-muted-foreground text-xs">
            <p className="mb-2">Tegyél fel kérdést az ügyirat jogi vonatkozásairól. Pl.:</p>
            <div className="flex flex-col gap-1">
              {[
                "Milyen kockázatai vannak ennek az ügyletnek?",
                "Milyen illetékkedvezmény jár a vevőnek?",
                "Kell-e gyámhatósági jóváhagyás ehhez az ügylethez?",
                "Mit kell tartalmaznia a Pmt. szerinti átvilágítási adatlapnak?",
                "Mi a függőben tartás eljárása banki hitel esetén?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => quick(q)}
                  className="text-left rounded-md border border-border px-2 py-1 hover:bg-accent hover:text-accent-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m: UIMessage) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          return (
            <div
              key={m.id}
              className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary/10 ml-6"
                  : "bg-muted mr-6 border border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                {m.role === "user" ? "Ügyvéd" : "Asszisztens (AI)"}
              </div>
              {text}
            </div>
          );
        })}
        {loading && (
          <div className="text-xs text-muted-foreground italic">Gondolkodik…</div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
          }}
          placeholder="Kérdés... (Ctrl+Enter küldés)"
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm min-h-[60px]"
        />
        <div className="flex justify-between items-center mt-2">
          <div className="text-[10px] text-muted-foreground">
            AI-generált válasz — ügyvédi ellenőrzés kötelező
          </div>
          <Button size="sm" onClick={() => void send()} disabled={loading || !input.trim()}>
            Küldés
          </Button>
        </div>
      </div>
    </div>
  );
}
