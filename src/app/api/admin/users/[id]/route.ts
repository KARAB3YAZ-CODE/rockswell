import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"

/** Admin-only. Deletes an auth user (cascades to their profile). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { service, callerId } = guard

  const { id } = await params
  if (id === callerId) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 })
  }

  const { error } = await service.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
