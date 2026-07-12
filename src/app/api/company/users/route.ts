import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireBearerUser } from "@/lib/auth-api"

const DEALER_ROLES = [
  "company_admin",
  "purchase_manager",
  "finance_user",
  "warehouse_user",
  "sales_manager",
] as const

/** Company admin: invite/create a teammate under the same company. */
export async function POST(request: Request) {
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (auth.role !== "company_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Takım yönetimi için yetkiniz yok" }, { status: 403 })
  }
  if (!auth.companyId && auth.role !== "admin") {
    return NextResponse.json({ error: "Firma bağlı değil" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const name = String(body.name ?? "").trim()
    const surname = String(body.surname ?? "").trim()
    const phone = String(body.phone ?? "").trim()
    const role = String(body.role ?? "purchase_manager")
    const companyId =
      auth.role === "admin" && body.companyId
        ? String(body.companyId)
        : auth.companyId

    if (!email || !name) {
      return NextResponse.json({ error: "E-posta ve ad zorunlu" }, { status: 400 })
    }
    if (!companyId) {
      return NextResponse.json({ error: "Firma gerekli" }, { status: 400 })
    }
    if (role === "admin" || !(DEALER_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 })
    }

    const password = randomBytes(18).toString("base64url")
    const { data: created, error: aErr } = await auth.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        surname,
        phone,
        role,
        company_id: companyId,
      },
    })
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 })

    // Ensure profile company/role (trigger may already set from metadata)
    if (created.user?.id) {
      await auth.service
        .from("profiles")
        .update({
          company_id: companyId,
          role,
          name,
          surname,
          phone,
          is_active: true,
        })
        .eq("id", created.user.id)
    }

    return NextResponse.json({ ok: true, userId: created.user?.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Kullanıcı oluşturulamadı" },
      { status: 500 }
    )
  }
}

/** List teammates for current company (company_admin / admin). */
export async function GET(request: Request) {
  const auth = await requireBearerUser(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (auth.role !== "company_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 })
  }

  const companyId =
    auth.role === "admin"
      ? new URL(request.url).searchParams.get("companyId") || auth.companyId
      : auth.companyId

  if (!companyId) {
    return NextResponse.json({ error: "Firma gerekli" }, { status: 400 })
  }

  const { data, error } = await auth.service
    .from("profiles")
    .select("id, name, surname, role, phone, is_active, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const users = []
  for (const row of data ?? []) {
    let email = ""
    try {
      const { data: authUser } = await auth.service.auth.admin.getUserById(String(row.id))
      email = authUser.user?.email ?? ""
    } catch {
      /* ignore */
    }
    users.push({
      id: String(row.id),
      name: String(row.name ?? ""),
      surname: String(row.surname ?? ""),
      role: String(row.role ?? ""),
      phone: String(row.phone ?? ""),
      isActive: row.is_active !== false,
      email,
      createdAt: String(row.created_at ?? ""),
    })
  }

  return NextResponse.json({ users })
}
