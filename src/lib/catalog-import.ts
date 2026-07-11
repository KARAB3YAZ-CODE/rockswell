export type CatalogImportRow = {
  sku: string
  name: string
  brand: string
  category: string
  description: string
  oem: string[]
  price: number
  warehouseCode: string
  quantity: number
  isActive: boolean
}

export type CatalogImportResult = {
  upserted: number
  skipped: string[]
  errors: string[]
}

/** Parse catalog CSV: sku;name;brand;category;oem;price;warehouse_code;qty;[description] */
export function parseCatalogCsv(csvText: string): { rows: CatalogImportRow[]; skipped: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const skipped: string[] = []
  const rows: CatalogImportRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    if (
      i === 0 &&
      (lower.includes("sku") || lower.startsWith("name") || lower.includes("ürün"))
    ) {
      continue
    }
    const parts = line.split(/[;,]/).map((p) => p.trim().replace(/^"|"$/g, ""))
    const sku = parts[0]
    const name = parts[1] || sku
    const brand = parts[2] || "ROCKSWELL"
    const category = parts[3] || "Genel"
    const oemRaw = parts[4] || ""
    const price = Number((parts[5] || "0").replace(",", "."))
    const warehouseCode = (parts[6] || "ANA").toUpperCase()
    const quantity = Number(parts[7] || "0")
    const description = parts[8] || ""

    if (!sku) {
      skipped.push(line)
      continue
    }
    if (!Number.isFinite(price) || price < 0) {
      skipped.push(`${sku}: geçersiz fiyat`)
      continue
    }

    rows.push({
      sku,
      name,
      brand,
      category,
      description,
      oem: oemRaw
        ? oemRaw.split(/[|/]+/).map((s) => s.trim()).filter(Boolean)
        : [],
      price,
      warehouseCode,
      quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
      isActive: true,
    })
  }

  return { rows, skipped }
}
