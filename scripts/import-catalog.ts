import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"
import { parseCatalogCsv, type CatalogImportResult } from "../src/lib/catalog-import"

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function upsertCatalog(csvPath: string): Promise<CatalogImportResult> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("Missing SUPABASE_SERVICE_KEY")

  const service = createClient(url, key, { auth: { persistSession: false } })
  const text = readFileSync(csvPath, "utf8")
  const { rows, skipped } = parseCatalogCsv(text)
  const errors: string[] = []
  let upserted = 0

  const { data: warehouses } = await service.from("warehouses").select("id, name, code")
  const whByCode = new Map((warehouses ?? []).map((w) => [String(w.code).toUpperCase(), w]))

  for (const row of rows) {
    try {
      const wh = whByCode.get(row.warehouseCode) || whByCode.get("ANA")
      const now = new Date().toISOString()
      const stock = [
        {
          warehouseId: wh?.id ?? "",
          warehouseName: (wh?.name as string) ?? "Ana Depo",
          quantity: row.quantity,
          reserved: 0,
          available: row.quantity,
          location: "",
          lastUpdated: now,
        },
      ]

      const { data: existing } = await service
        .from("products")
        .select("id, stock")
        .eq("sku", row.sku)
        .maybeSingle()

      if (existing?.id) {
        const prevStock = (existing.stock as Array<Record<string, unknown>>) ?? []
        const reserved = Number(
          prevStock.find((s) => String(s.warehouseId) === String(wh?.id ?? ""))?.reserved ?? 0
        )
        const mergedStock =
          wh?.id && prevStock.some((s) => String(s.warehouseId) === String(wh.id))
            ? prevStock.map((s) =>
                String(s.warehouseId) === String(wh.id)
                  ? {
                      ...s,
                      quantity: row.quantity,
                      reserved,
                      available: Math.max(0, row.quantity - reserved),
                      lastUpdated: now,
                    }
                  : s
              )
            : stock

        const { error } = await service
          .from("products")
          .update({
            name: row.name,
            brand: row.brand,
            category: row.category,
            description: row.description,
            base_price: row.price,
            oem_numbers: row.oem,
            is_active: row.isActive,
            stock: mergedStock,
            updated_at: now,
          })
          .eq("id", existing.id)
        if (error) throw error
      } else {
        const { error } = await service.from("products").insert({
          sku: row.sku,
          name: row.name,
          brand: row.brand,
          category: row.category,
          description: row.description,
          base_price: row.price,
          oem_numbers: row.oem,
          is_active: row.isActive,
          stock,
        })
        if (error) throw error
      }
      upserted += 1
    } catch (e) {
      errors.push(`${row.sku}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { upserted, skipped, errors }
}

async function main() {
  const file = process.argv[2] || resolve(process.cwd(), "scripts/samples/catalog.sample.csv")
  console.log("Importing catalog from", file)
  const result = await upsertCatalog(file)
  console.log(`Upserted: ${result.upserted}`)
  if (result.skipped.length) console.log("Skipped:", result.skipped.slice(0, 20))
  if (result.errors.length) {
    console.error("Errors:", result.errors.slice(0, 20))
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
