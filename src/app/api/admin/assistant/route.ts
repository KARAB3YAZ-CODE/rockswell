import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { runAdminAssistantChat, type PendingAction } from "@/lib/admin-assistant"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  let body: {
    messages?: { role: "user" | "assistant"; content: string }[]
    pendingAction?: PendingAction | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  const cleaned = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-20)

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Mesaj gerekli" }, { status: 400 })
  }

  try {
    const result = await runAdminAssistantChat({
      service: guard.service,
      callerId: guard.callerId,
      messages: cleaned,
      pendingAction: body.pendingAction ?? null,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Asistan hatası" },
      { status: 500 }
    )
  }
}
