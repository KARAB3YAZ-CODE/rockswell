"use client"

import { useEffect, useRef, useState } from "react"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { SectionHeader, inputCls } from "@/components/admin/ui"
import { askAdminAssistant } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Bot, Send, Sparkles, User } from "lucide-react"

type Msg = { role: "user" | "assistant"; content: string }
type Pending = { tool: string; args: Record<string, unknown> } | null

const SUGGESTIONS = [
  "Kategorileri listele",
  "Fren kategorisine %15 zam yap",
  "Yeni kampanya: %10 indirim, 15 gün",
  "Onay bekleyen siparişler",
  "Firmaları listele",
  "Düşük stok",
  "İş özeti ver",
  "Sistem durumu",
  "Komutlar",
]

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Merhaba! Ücretsiz asistan — kategori/marka bulanık eşleştirme, firma iskontosu, sipariş onayı, düşük stok ve daha fazlası. Belirsiz isimlerde seçenek sunarım; kritik işlemlerde önce önizleme → “onayla”.",
    },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<Pending>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, busy])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || busy) return
    const nextMessages: Msg[] = [...messages, { role: "user", content }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    try {
      const history = nextMessages.filter((m, i) => !(i === 0 && m.role === "assistant"))
      const res = await askAdminAssistant(history, pendingAction)
      setPendingAction(res.pendingAction ?? null)
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Bir hata oluştu",
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] max-w-3xl flex flex-col gap-4">
      <SectionHeader
        icon={Bot}
        tone="accent"
        title="AI Asistan"
        subtitle="Ücretsiz — akıllı komut motoru (bulanık eşleştirme + onay akışı)"
      />

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => send(s)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/55 hover:text-white hover:border-accent/30 hover:bg-accent/5 transition-colors disabled:opacity-40"
          >
            <Sparkles size={10} className="inline mr-1 opacity-60" />
            {s}
          </button>
        ))}
        {pendingAction && (
          <button
            type="button"
            disabled={busy}
            onClick={() => send("onayla")}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-accent/40 bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-40"
          >
            Onayla
          </button>
        )}
      </div>

      <GlassCard intensity="light" className="flex-1 min-h-0 p-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-accent" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-black rounded-br-md"
                    : "bg-white/[0.05] border border-white/10 text-white/85 rounded-bl-md"
                )}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} className="text-white/60" />
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-white/40 pl-9">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              İşleniyor…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="p-3 border-t border-white/10 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Örn: Fren kategorisine %15 zam yap"
            disabled={busy}
            className={cn(inputCls, "flex-1")}
          />
          <Button type="submit" disabled={busy || !input.trim()} icon={<Send size={14} />}>
            Gönder
          </Button>
        </form>
      </GlassCard>

      <p className="text-[11px] text-white/30">
        OpenAI yok — tamamen ücretsiz. Bilinen Türkçe komutları anlar; serbest sohbet ChatGPT gibi değildir.
      </p>
    </div>
  )
}
