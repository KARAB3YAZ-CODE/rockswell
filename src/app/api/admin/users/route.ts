import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireAdmin } from "@/lib/admin-guard"

/** Admin-only. Creates a new company (if needed) + auth user + profile. */
export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { service } = guard

  try {
    const body = await request.json()
    const { email, name, surname, phone, role, taxNumber } = body
    let companyId: string | undefined = body.companyId
    const companyName: string | undefined = body.companyName

    if (!email?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "E-posta ve ad zorunlu" }, { status: 400 })
    }

    if (!companyId && companyName?.trim()) {
      const { data: company, error: cErr } = await service
        .from("companies")
        .insert({
          name: companyName,
          tax_number: taxNumber || "",
          tax_office: "",
          phone: phone || "",
          email,
          address: { street: "", city: "", district: "", country: "Türkiye", zipCode: "" },
        })
        .select("id")
        .single()
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })
      companyId = company.id as string
    }

    const password = randomBytes(18).toString("base64url")
    const { error: aErr } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        surname: surname || "",
        phone: phone || "",
        role: role || "company_admin",
        company_id: companyId,
      },
    })
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kullanıcı oluşturulamadı" }, { status: 500 })
  }
}
