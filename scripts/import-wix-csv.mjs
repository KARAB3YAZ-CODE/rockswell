import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

function parseCSV(text) {
  const rows = []
  let current = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        current.push(field.trim())
        field = ""
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++
        current.push(field.trim())
        field = ""
        if (current.length > 0 && current.some((f) => f.length > 0)) {
          rows.push(current)
        }
        current = []
      } else {
        field += ch
      }
    }
  }

  if (field || current.length > 0) {
    current.push(field.trim())
    if (current.some((f) => f.length > 0)) rows.push(current)
  }

  return rows
}

function stripHTML(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function extractOEMs(description) {
  const oems = new Set()
  const text = stripHTML(description)
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")

  const oemBlocks = text.match(/OEM\s*[:;]?\s*([A-Z0-9\s.\-,\/]+)/gi)
  if (oemBlocks) {
    for (const block of oemBlocks) {
      const parts = block
        .replace(/^OEM\s*[:;]?\s*/i, "")
        .split(/[\s,]+(?=[A-Z0-9])/)
        .flatMap((s) => s.split(/\s*-\s*/))
      for (const part of parts) {
        const oem = part.replace(/[^A-Z0-9.\/]/gi, "").trim()
        if (oem.length >= 4 && oem.length <= 25) {
          oems.add(oem.toUpperCase())
        }
      }
    }
  }

  return [...oems]
}

function extractOEMFromSKU(sku) {
  const parts = sku.split(">").map((p) => p.trim())
  if (parts.length >= 2) {
    const oem = parts[1].replace(/^OEM\s*/i, "").trim()
    return oem
  }
  return null
}

function parsePrice(val) {
  const num = parseFloat(val.replace(",", ".").replace(/[^0-9.]/g, ""))
  return isNaN(num) ? 0 : num
}

function parseInventory(val) {
  if (!val || val.toLowerCase() === "outofstock") return 0
  const num = parseInt(val, 10)
  return isNaN(num) ? 0 : num
}

const raw = readFileSync(join(ROOT, "catalog_products.csv"), "utf-8")
const rows = parseCSV(raw)

if (rows.length < 2) {
  console.error("Not enough rows in CSV")
  process.exit(1)
}

const header = rows[0]
const dataRows = rows.slice(1)

console.log(`Parsed ${dataRows.length} product rows from CSV`)

const products = dataRows.map((row, idx) => {
  const get = (colIdx) => {
    const val = row[colIdx] ?? ""
    return val.trim()
  }

  const handleId = get(0)
  const name = get(2)
  const descriptionHTML = get(3)
  const imageUrl = get(4)
  const collection = get(5)
  const skuRaw = get(6)
  const ribbon = get(7)
  const priceRaw = get(8)
  const visibleRaw = get(10)
  const inventoryRaw = get(13)
  const brandRaw = get(52)

  const description = stripHTML(descriptionHTML)
  const oems = new Set([...extractOEMs(descriptionHTML)])
  const skuOEM = extractOEMFromSKU(skuRaw)
  if (skuOEM) oems.add(skuOEM)

  const sku = skuRaw.split(">")[0].trim()

  const cats = collection.split(";").map((c) => c.trim()).filter(Boolean)
  const category = cats[0] || "Genel"
  const subcategory = cats.slice(1).join(" / ") || ""

  const basePrice = parsePrice(priceRaw)
  const stock = parseInventory(inventoryRaw)
  const isActive = visibleRaw === "true"
  const brand = brandRaw || "ROCKSWELL"

  const tags = []
  if (ribbon && ribbon.toLowerCase() !== "yeni ürün") {
    tags.push(ribbon)
  }

  // Extract compatible vehicles from additionalInfo fields (columns 35-46)
  const compatibleVehicles = []
  for (let j = 34; j <= 44; j += 2) {
    const title = get(j)
    const desc = get(j + 1)
    if (!title || !desc) continue
    const titleClean = stripHTML(title).trim()
    if (titleClean !== "Uyumlu Araçlar" && titleClean !== "Uyuklu Araçlar") continue
    const text = stripHTML(desc)
    if (!text || text === "-" || text === "UNIVERSAL") continue
    const words = text.split(/\s+/)
    const firstBrand = words[0].replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ\-]/g, "")
    compatibleVehicles.push({
      brand: firstBrand || "Universal",
      model: words.slice(1).join(" ") || text,
      yearStart: 0,
      yearEnd: 0,
      engine: "",
      fuel: "",
      transmission: "",
    })
  }

  return {
    id: `prod_${handleId.replace("product_", "").substring(0, 8)}`,
    sku,
    name,
    description,
    brand,
    category,
    subcategory,
    oemNumbers: [...oems],
    crossNumbers: [],
    compatibleVehicles,
    images: imageUrl ? [`https://static.wixstatic.com/media/${imageUrl}`] : [],
    specifications: [],
    documents: [],
    videos: [],
    stock: [
      {
        warehouseId: "wh_001",
        warehouseName: "Ana Depo",
        quantity: stock,
        reserved: 0,
        available: stock,
        location: "",
        lastUpdated: new Date().toISOString(),
      },
    ],
    basePrice,
    unit: "Adet",
    minOrderQuantity: 1,
    maxOrderQuantity: 9999,
    isActive,
    isFeatured: ribbon === "Yeni Ürün",
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
})

const outDir = join(ROOT, "src", "lib", "data")
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, "products.json")
writeFileSync(outPath, JSON.stringify(products, null, 2), "utf-8")
console.log(`Wrote ${products.length} products to ${outPath}`)
