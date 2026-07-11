import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { parseCatalogCsv } from "@/lib/catalog-import"

export async function POST(request: Request) {
  const guard = await requireAdmin(request)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  try {
    const body = await request.json()
    const csvText = String(body.csvText ?? "")
    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV boş" }, { status: 400 })
    }

    const { rows, skipped } = parseCatalogCsv(csvText)
    if (!rows.length) {
      return NextResponse.json({ error: "İçe aktarılacak satır yok", skipped }, { status: 400 })
    }

    const service = guard.service
    const { data: warehouses } = await service.from("warehouses").select("id, name, code")
    const whByCode = new Map((warehouses ?? []).map((w) => [String(w.code).toUpperCase(), w]))

    const errors: string[] = []
    let upserted = 0

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

    return NextResponse.json({ upserted, skipped, errors })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "İçe aktarma başarısız" },
      { status: 500 }
    )
  }
}
