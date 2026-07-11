/**
 * Minimal seed placeholder — use import:catalog for product data.
 * Creates ANA warehouse if missing.
 */
import { createClient } from "@supabase/supabase-js"

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Missing SUPABASE_SERVICE_KEY")
  const service = createClient(url, key, { auth: { persistSession: false } })

  const { data: existing } = await service.from("warehouses").select("id").eq("code", "ANA").maybeSingle()
  if (!existing) {
    const { error } = await service.from("warehouses").insert({
      name: "Ana Depo",
      code: "ANA",
      address: { street: "", city: "İstanbul", district: "", country: "Türkiye", zipCode: "" },
      is_active: true,
      capacity: 100000,
      used_capacity: 0,
      manager: "",
      phone: "",
      working_hours: "09:00-18:00",
    })
    if (error) throw error
    console.log("Created ANA warehouse")
  } else {
    console.log("ANA warehouse already exists")
  }
  console.log("Seed complete. Run: npm run import:catalog -- scripts/samples/catalog.sample.csv")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
