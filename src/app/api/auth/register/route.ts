import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-admin"
import { mapUser } from "@/lib/mappers"
import { MIN_PASSWORD_LENGTH } from "@/lib/password"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, surname, companyName, taxNumber, phone } = body

    if (!email?.trim() || !password?.trim() || !name?.trim() || !surname?.trim() || !companyName?.trim()) {
      return NextResponse.json({ error: "Gerekli alanlar eksik" }, { status: 400 })
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır` },
        { status: 400 }
      )
    }

    const service = getServiceClient()

    const { data: company, error: companyError } = await service
      .from("companies")
      .insert({
        name: companyName,
        tax_number: taxNumber || "",
        tax_office: "",
        phone: phone || "",
        email,
        is_active: false,
        address: {
          street: "",
          city: "",
          district: "",
          country: "Türkiye",
          zipCode: "",
        },
      })
      .select()
      .single()

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 400 })
    }

    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        surname,
        phone: phone || "",
        role: "company_admin",
        company_id: company.id,
      },
    })

    if (authError) {
      await service.from("companies").delete().eq("id", company.id)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil oluşturulamadı" }, { status: 500 })
    }

    return NextResponse.json({
      user: mapUser(profile, email),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Kayıt başarısız"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
