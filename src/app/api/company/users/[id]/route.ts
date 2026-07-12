import { NextResponse } from "next/server"
import { requireBearerUser } from "@/lib/auth-api"

/** Company admin: activate/deactivate or change role of a teammate. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (auth.role !== "company_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 })
  if (id === auth.userId) {
    return NextResponse.json({ error: "Kendi hesabınızı bu yoldan değiştiremezsiniz" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const { data: target, error: fetchErr } = await auth.service
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", id)
    .single()
  if (fetchErr || !target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
  }
  if (auth.role !== "admin" && String(target.company_id) !== auth.companyId) {
    return NextResponse.json({ error: "Bu kullanıcı firmanıza ait değil" }, { status: 403 })
  }
  if (String(target.role) === "admin") {
    return NextResponse.json({ error: "Admin hesabı düzenlenemez" }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive
  if (typeof body.role === "string") {
    const allowed = [
      "company_admin",
      "purchase_manager",
      "finance_user",
      "warehouse_user",
      "sales_manager",
    ]
    if (!allowed.includes(body.role)) {
      return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 })
    }
    patch.role = body.role
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 })
  }

  const { error } = await auth.service.from("profiles").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
