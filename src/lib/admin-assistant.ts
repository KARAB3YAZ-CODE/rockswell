import type { SupabaseClient } from "@supabase/supabase-js"

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string }

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function addDays(days: number, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d
}

function toIsoDate(d: Date) {
  return d.toISOString()
}

async function listCategories(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service.from("products").select("category").eq("is_active", true)
  if (error) return { ok: false, error: error.message }
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const cat = String(row.category ?? "").trim() || "(kategorisiz)"
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }
  const categories = [...counts.entries()]
    .map(([name, productCount]) => ({ name, productCount }))
    .sort((a, b) => b.productCount - a.productCount)
  return { ok: true, data: { categories, totalCategories: categories.length } }
}

async function listBrands(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service.from("products").select("brand").eq("is_active", true)
  if (error) return { ok: false, error: error.message }
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const brand = String(row.brand ?? "").trim() || "(markasız)"
    counts.set(brand, (counts.get(brand) ?? 0) + 1)
  }
  const brands = [...counts.entries()]
    .map(([name, productCount]) => ({ name, productCount }))
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 50)
  return { ok: true, data: { brands } }
}

async function searchProducts(service: SupabaseClient, args: { query: string; limit?: number }): Promise<ToolResult> {
  const q = String(args.query ?? "").trim().replace(/[%_,]/g, " ").slice(0, 80)
  if (!q) return { ok: false, error: "Arama metni gerekli" }
  const limit = Math.min(30, Math.max(1, Number(args.limit) || 10))
  const { data, error } = await service
    .from("products")
    .select("id, sku, name, brand, category, base_price, is_active")
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`)
    .limit(limit)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      products: (data ?? []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        category: p.category,
        basePrice: Number(p.base_price),
        isActive: p.is_active,
      })),
    },
  }
}

async function adjustPrices(
  service: SupabaseClient,
  args: {
    filterType: "category" | "brand"
    filterValue: string
    percent: number
    dryRun?: boolean
  }
): Promise<ToolResult> {
  const filterValue = String(args.filterValue ?? "").trim()
  const percent = Number(args.percent)
  const dryRun = args.dryRun !== false
  if (!filterValue) return { ok: false, error: "Filtre değeri gerekli" }
  if (!Number.isFinite(percent) || percent === 0) return { ok: false, error: "Geçerli bir yüzde girin (0 olamaz)" }
  if (Math.abs(percent) > 100) return { ok: false, error: "Yüzde en fazla ±100 olabilir" }

  const column = args.filterType === "brand" ? "brand" : "category"
  let { data, error } = await service
    .from("products")
    .select("id, sku, name, base_price, category, brand")
    .ilike(column, filterValue)
    .eq("is_active", true)

  if (error) return { ok: false, error: error.message }

  if (!data?.length) {
    const soft = await service
      .from("products")
      .select("id, sku, name, base_price, category, brand")
      .ilike(column, `%${filterValue}%`)
      .eq("is_active", true)
    if (soft.error) return { ok: false, error: soft.error.message }
    data = soft.data
  }

  const products = data ?? []
  if (products.length === 0) {
    return {
      ok: false,
      error: `"${filterValue}" ile eşleşen aktif ürün bulunamadı. Önce list_categories veya list_brands ile tam adı kontrol edin.`,
    }
  }

  const factor = 1 + percent / 100
  const samples = products.slice(0, 5).map((p) => ({
    sku: p.sku,
    name: p.name,
    oldPrice: Number(p.base_price),
    newPrice: round2(Number(p.base_price) * factor),
  }))

  if (dryRun) {
    return {
      ok: true,
      data: {
        dryRun: true,
        filterType: args.filterType,
        filterValue,
        percent,
        matchedProducts: products.length,
        samples,
        message: `${products.length} ürüne %${percent} ${percent > 0 ? "zam" : "indirim"} uygulanacak. Onay için dry_run=false ile tekrar çağırın.`,
      },
    }
  }

  let updated = 0
  const chunkSize = 40
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (p) => {
        const newPrice = round2(Number(p.base_price) * factor)
        const { error: upErr } = await service.from("products").update({ base_price: newPrice }).eq("id", p.id)
        if (!upErr) updated += 1
      })
    )
  }

  return {
    ok: true,
    data: {
      dryRun: false,
      filterType: args.filterType,
      filterValue,
      percent,
      matchedProducts: products.length,
      updated,
      samples,
      message: `${updated} ürünün fiyatı güncellendi (%${percent}).`,
    },
  }
}

async function createCampaign(
  service: SupabaseClient,
  args: {
    name: string
    description?: string
    discountRate: number
    durationDays: number
    categories?: string[]
    brands?: string[]
    dryRun?: boolean
  }
): Promise<ToolResult> {
  const name = String(args.name ?? "").trim()
  const discountRate = Number(args.discountRate)
  const durationDays = Math.round(Number(args.durationDays))
  const dryRun = args.dryRun !== false
  if (!name) return { ok: false, error: "Kampanya adı gerekli" }
  if (!Number.isFinite(discountRate) || discountRate <= 0 || discountRate > 90) {
    return { ok: false, error: "İndirim oranı 0–90 arasında olmalı" }
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
    return { ok: false, error: "Süre 1–365 gün arasında olmalı" }
  }

  const start = new Date()
  const end = addDays(durationDays, start)
  const payload = {
    name,
    description: String(args.description ?? "").trim() || `${durationDays} günlük %${discountRate} indirim kampanyası`,
    type: "discount" as const,
    discount_rate: discountRate,
    conditions: [] as unknown[],
    products: [] as string[],
    brands: Array.isArray(args.brands) ? args.brands : [],
    categories: Array.isArray(args.categories) ? args.categories : [],
    start_date: toIsoDate(start),
    end_date: toIsoDate(end),
    is_active: true,
  }

  if (dryRun) {
    return {
      ok: true,
      data: {
        dryRun: true,
        preview: {
          name: payload.name,
          description: payload.description,
          discountRate,
          durationDays,
          startDate: payload.start_date,
          endDate: payload.end_date,
          categories: payload.categories,
          brands: payload.brands,
        },
        message: "Kampanya önizlemesi hazır. Onay için dry_run=false ile tekrar çağırın.",
      },
    }
  }

  const { data, error } = await service.from("campaigns").insert(payload).select().single()
  if (error || !data) return { ok: false, error: error?.message ?? "Kampanya oluşturulamadı" }
  return {
    ok: true,
    data: {
      dryRun: false,
      campaign: {
        id: data.id,
        name: data.name,
        discountRate: Number(data.discount_rate),
        startDate: data.start_date,
        endDate: data.end_date,
        categories: data.categories,
        brands: data.brands,
      },
      message: `"${data.name}" kampanyası oluşturuldu (${durationDays} gün, %${discountRate}).`,
    },
  }
}

async function listCampaigns(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("campaigns")
    .select("id, name, description, discount_rate, start_date, end_date, is_active, categories, brands")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      campaigns: (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        discountRate: Number(c.discount_rate),
        startDate: c.start_date,
        endDate: c.end_date,
        isActive: c.is_active,
        categories: c.categories,
        brands: c.brands,
      })),
    },
  }
}

async function setCampaignActive(
  service: SupabaseClient,
  args: { campaignId: string; isActive: boolean }
): Promise<ToolResult> {
  const id = String(args.campaignId ?? "").trim()
  if (!id) return { ok: false, error: "Kampanya id gerekli" }
  const { error } = await service.from("campaigns").update({ is_active: Boolean(args.isActive) }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { campaignId: id, isActive: Boolean(args.isActive) } }
}

async function setMaintenance(
  service: SupabaseClient,
  args: { enabled: boolean; message?: string },
  callerId: string
): Promise<ToolResult> {
  const patch: Record<string, unknown> = {
    maintenance_enabled: Boolean(args.enabled),
    updated_at: new Date().toISOString(),
    updated_by: callerId,
  }
  if (args.message !== undefined) patch.maintenance_message = String(args.message)
  const { data, error } = await service.from("site_settings").update(patch).eq("id", 1).select().single()
  if (error || !data) return { ok: false, error: error?.message ?? "Ayar güncellenemedi" }
  return {
    ok: true,
    data: {
      maintenanceEnabled: data.maintenance_enabled,
      maintenanceMessage: data.maintenance_message,
    },
  }
}

async function setPriceUpdateNotice(
  service: SupabaseClient,
  args: { enabled: boolean; date?: string; message?: string },
  callerId: string
): Promise<ToolResult> {
  const patch: Record<string, unknown> = {
    price_update_enabled: Boolean(args.enabled),
    updated_at: new Date().toISOString(),
    updated_by: callerId,
  }
  if (args.date !== undefined) patch.price_update_date = args.date || null
  if (args.message !== undefined) patch.price_update_message = String(args.message)
  const { data, error } = await service.from("site_settings").update(patch).eq("id", 1).select().single()
  if (error || !data) return { ok: false, error: error?.message ?? "Ayar güncellenemedi" }
  return {
    ok: true,
    data: {
      priceUpdateEnabled: data.price_update_enabled,
      priceUpdateDate: data.price_update_date,
      priceUpdateMessage: data.price_update_message,
    },
  }
}

async function getBusinessSummary(service: SupabaseClient): Promise<ToolResult> {
  const [{ count: productCount }, { count: companyCount }, { data: orders }] = await Promise.all([
    service.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    service.from("companies").select("*", { count: "exact", head: true }),
    service.from("orders").select("status, pricing").limit(2000),
  ])
  let revenue = 0
  let pendingApproval = 0
  for (const o of orders ?? []) {
    if (o.status === "pending_approval") pendingApproval += 1
    if (["confirmed", "processing", "shipped", "delivered"].includes(String(o.status))) {
      revenue += Number((o.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0)
    }
  }
  return {
    ok: true,
    data: {
      activeProducts: productCount ?? 0,
      companies: companyCount ?? 0,
      ordersLoaded: orders?.length ?? 0,
      pendingApproval,
      paidRevenueApprox: round2(revenue),
    },
  }
}

export type PendingAction = {
  tool: string
  args: Record<string, unknown>
}

export async function runAssistantTool(
  service: SupabaseClient,
  callerId: string,
  name: string,
  rawArgs: unknown
): Promise<ToolResult> {
  const args = (typeof rawArgs === "object" && rawArgs !== null ? rawArgs : {}) as Record<string, unknown>
  switch (name) {
    case "list_categories":
      return listCategories(service)
    case "list_brands":
      return listBrands(service)
    case "search_products":
      return searchProducts(service, args as { query: string; limit?: number })
    case "adjust_prices":
      return adjustPrices(service, args as {
        filterType: "category" | "brand"
        filterValue: string
        percent: number
        dryRun?: boolean
      })
    case "create_campaign":
      return createCampaign(service, args as {
        name: string
        description?: string
        discountRate: number
        durationDays: number
        categories?: string[]
        brands?: string[]
        dryRun?: boolean
      })
    case "list_campaigns":
      return listCampaigns(service)
    case "set_campaign_active":
      return setCampaignActive(service, args as { campaignId: string; isActive: boolean })
    case "set_maintenance":
      return setMaintenance(service, args as { enabled: boolean; message?: string }, callerId)
    case "set_price_update_notice":
      return setPriceUpdateNotice(service, args as { enabled: boolean; date?: string; message?: string }, callerId)
    case "get_business_summary":
      return getBusinessSummary(service)
    default:
      return { ok: false, error: `Bilinmeyen araç: ${name}` }
  }
}

function norm(s: string) {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim()
}

function isConfirm(text: string) {
  return /^(onayla|uygula|evet|tamam|ok|olur|yap)\b/i.test(text.trim())
}

function isCancel(text: string) {
  return /^(iptal|vazgec|vazgeç|hayir|hayır|no)\b/i.test(norm(text))
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n)
}

function formatToolResult(tool: string, result: ToolResult): { reply: string; pending: PendingAction | null } {
  if (!result.ok) return { reply: `Hata: ${result.error}`, pending: null }
  const data = result.data as Record<string, unknown>

  if (tool === "list_categories") {
    const cats = (data.categories as { name: string; productCount: number }[]) ?? []
    const lines = cats.slice(0, 30).map((c) => `• ${c.name} (${c.productCount})`)
    return {
      reply: `Kategoriler (${data.totalCategories}):\n${lines.join("\n")}${cats.length > 30 ? "\n…" : ""}`,
      pending: null,
    }
  }

  if (tool === "list_brands") {
    const brands = (data.brands as { name: string; productCount: number }[]) ?? []
    const lines = brands.map((b) => `• ${b.name} (${b.productCount})`)
    return { reply: `Markalar:\n${lines.join("\n")}`, pending: null }
  }

  if (tool === "search_products") {
    const products = (data.products as { sku: string; name: string; basePrice: number; category: string }[]) ?? []
    if (!products.length) return { reply: "Ürün bulunamadı.", pending: null }
    const lines = products.map((p) => `• ${p.sku} — ${p.name} (${p.category}) ${formatMoney(p.basePrice)}`)
    return { reply: `Bulunan ürünler:\n${lines.join("\n")}`, pending: null }
  }

  if (tool === "adjust_prices") {
    const samples = (data.samples as { sku: string; name: string; oldPrice: number; newPrice: number }[]) ?? []
    const sampleLines = samples
      .map((s) => `• ${s.sku}: ${formatMoney(s.oldPrice)} → ${formatMoney(s.newPrice)}`)
      .join("\n")
    if (data.dryRun) {
      return {
        reply: `Önizleme: ${data.matchedProducts} ürüne %${data.percent} uygulanacak (${data.filterType}: ${data.filterValue}).\n${sampleLines}\n\nUygulamak için “onayla” yazın. İptal için “iptal”.`,
        pending: {
          tool: "adjust_prices",
          args: {
            filterType: data.filterType,
            filterValue: data.filterValue,
            percent: data.percent,
            dryRun: false,
          },
        },
      }
    }
    return {
      reply: `Tamam. ${data.updated} ürün güncellendi (%${data.percent}).\n${sampleLines}`,
      pending: null,
    }
  }

  if (tool === "create_campaign") {
    const preview = (data.preview ?? data.campaign) as Record<string, unknown>
    if (data.dryRun) {
      return {
        reply: `Kampanya önizlemesi:\n• Ad: ${preview.name}\n• İndirim: %${preview.discountRate}\n• Süre: ${preview.durationDays ?? "—"} gün\n• Başlangıç: ${String(preview.startDate).slice(0, 10)}\n• Bitiş: ${String(preview.endDate).slice(0, 10)}\n\nOluşturmak için “onayla” yazın.`,
        pending: {
          tool: "create_campaign",
          args: {
            name: preview.name,
            description: preview.description,
            discountRate: preview.discountRate,
            durationDays: preview.durationDays,
            categories: preview.categories,
            brands: preview.brands,
            dryRun: false,
          },
        },
      }
    }
    return {
      reply: `Kampanya oluşturuldu: “${preview.name}” (%${preview.discountRate}, ${String(preview.startDate).slice(0, 10)} → ${String(preview.endDate).slice(0, 10)}).`,
      pending: null,
    }
  }

  if (tool === "list_campaigns") {
    const campaigns = (data.campaigns as { name: string; discountRate: number; isActive: boolean; endDate: string }[]) ?? []
    if (!campaigns.length) return { reply: "Kampanya yok.", pending: null }
    const lines = campaigns.map(
      (c) => `• ${c.name} — %${c.discountRate} — ${c.isActive ? "aktif" : "pasif"} — bitiş ${String(c.endDate).slice(0, 10)}`
    )
    return { reply: `Kampanyalar:\n${lines.join("\n")}`, pending: null }
  }

  if (tool === "set_maintenance") {
    return {
      reply: data.maintenanceEnabled
        ? `Bakım modu açıldı.\nMesaj: ${data.maintenanceMessage}`
        : "Bakım modu kapatıldı.",
      pending: null,
    }
  }

  if (tool === "set_price_update_notice") {
    if (!data.priceUpdateEnabled) return { reply: "Fiyat güncelleme bildirimi kapatıldı.", pending: null }
    return {
      reply: `Fiyat güncelleme bildirimi açıldı${data.priceUpdateDate ? ` (${data.priceUpdateDate})` : ""}.`,
      pending: null,
    }
  }

  if (tool === "get_business_summary") {
    return {
      reply: `Özet:\n• Aktif ürün: ${data.activeProducts}\n• Firma: ${data.companies}\n• Onay bekleyen: ${data.pendingApproval}\n• Tahmini ciro: ${formatMoney(Number(data.paidRevenueApprox ?? 0))}`,
      pending: null,
    }
  }

  return { reply: JSON.stringify(data, null, 2), pending: null }
}

type ParsedIntent =
  | { kind: "tool"; tool: string; args: Record<string, unknown> }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "help" }
  | { kind: "unknown" }

function parseIntent(raw: string): ParsedIntent {
  const text = raw.trim()
  const n = norm(text)

  if (isConfirm(text)) return { kind: "confirm" }
  if (isCancel(text)) return { kind: "cancel" }

  if (
    /yardim|help|ne yapabilir|komut/.test(n) ||
    n === "?"
  ) {
    return { kind: "help" }
  }

  if (/kategori.*(liste|goster|neler)|^kategorileri?\b/.test(n)) {
    return { kind: "tool", tool: "list_categories", args: {} }
  }
  if (/marka.*(liste|goster|neler)|^markalari?\b/.test(n)) {
    return { kind: "tool", tool: "list_brands", args: {} }
  }
  if (/kampanya.*(liste|goster|neler)|^kampanyalari?\b/.test(n)) {
    return { kind: "tool", tool: "list_campaigns", args: {} }
  }
  if (/(is\s*ozeti|ozet\s*ver|dashboard|rapor\s*ozet|genel\s*durum)/.test(n)) {
    return { kind: "tool", tool: "get_business_summary", args: {} }
  }

  const search = text.match(/(?:ürün\s*)?(?:ara|bul)\s*[:\-]?\s*(.+)/i)
  if (search?.[1]) {
    return { kind: "tool", tool: "search_products", args: { query: search[1].trim(), limit: 15 } }
  }

  // Bakım
  if (/bakim/.test(n) && /(ac|aktif|baslat|et)/.test(n) && !/kapat|kapa|pasif|bitir/.test(n)) {
    return { kind: "tool", tool: "set_maintenance", args: { enabled: true } }
  }
  if (/bakim/.test(n) && /(kapat|kapa|pasif|bitir|iptal)/.test(n)) {
    return { kind: "tool", tool: "set_maintenance", args: { enabled: false } }
  }

  // Fiyat güncelleme bildirimi
  if (/fiyat.*(guncelle|bildirim|duyuru)/.test(n) || /guncelleme\s*bildirim/.test(n)) {
    if (/(kapat|kapa|pasif|bitir)/.test(n)) {
      return { kind: "tool", tool: "set_price_update_notice", args: { enabled: false } }
    }
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/)
    const dmy = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/)
    let date: string | undefined
    if (iso) date = iso[1]
    else if (dmy) {
      const dd = dmy[1].padStart(2, "0")
      const mm = dmy[2].padStart(2, "0")
      let yyyy = dmy[3] ?? String(new Date().getFullYear())
      if (yyyy.length === 2) yyyy = `20${yyyy}`
      date = `${yyyy}-${mm}-${dd}`
    } else {
      // "20 Temmuz" tarzı
      const months: Record<string, string> = {
        ocak: "01", subat: "02", mart: "03", nisan: "04", mayis: "05", haziran: "06",
        temmuz: "07", agustos: "08", eylul: "09", ekim: "10", kasim: "11", aralik: "12",
      }
      const m = n.match(/(\d{1,2})\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)/)
      if (m) {
        const y = new Date().getFullYear()
        date = `${y}-${months[m[2]]}-${m[1].padStart(2, "0")}`
      }
    }
    return {
      kind: "tool",
      tool: "set_price_update_notice",
      args: { enabled: true, ...(date ? { date } : {}) },
    }
  }

  // Fiyat zammı / indirim
  // "Fren kategorisine %15 zam" | "Bosch markasına %10 indirim" | "%15 zam fren"
  const pricePatterns = [
    /(.+?)\s+(kategori(?:sine|ye|si)?|marka(?:sina|ya|si)?)\s+%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim|artir|dusur|indir)/i,
    /%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim)\s+(.+?)\s+(kategori|marka)/i,
    /(.+?)\s+(?:icin|için)?\s*%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim)/i,
  ]

  for (const re of pricePatterns) {
    const m = text.match(re)
    if (!m) continue
    let filterValue = ""
    let filterType: "category" | "brand" = "category"
    let percent = 0
    let action = "zam"

    if (re === pricePatterns[0]) {
      filterValue = m[1].replace(/^(?:yeni\s+)?/i, "").trim()
      filterType = norm(m[2]).startsWith("marka") ? "brand" : "category"
      percent = Number(String(m[3]).replace(",", "."))
      action = norm(m[4])
    } else if (re === pricePatterns[1]) {
      percent = Number(String(m[1]).replace(",", "."))
      action = norm(m[2])
      filterValue = m[3].trim()
      filterType = norm(m[4]).startsWith("marka") ? "brand" : "category"
    } else {
      filterValue = m[1].replace(/\b(kategori|marka)\b/gi, "").trim()
      percent = Number(String(m[2]).replace(",", "."))
      action = norm(m[3])
      if (/marka/.test(n)) filterType = "brand"
    }

    if (!filterValue || !Number.isFinite(percent) || percent === 0) continue
    if (/indirim|dusur|indir/.test(action) && percent > 0) percent = -percent
    // strip trailing noise words
    filterValue = filterValue
      .replace(/\b(kategorisine|kategoriye|kategorisi|markasina|markaya|markasi|icin|için)\b/gi, "")
      .trim()

    return {
      kind: "tool",
      tool: "adjust_prices",
      args: { filterType, filterValue, percent, dryRun: true },
    }
  }

  // Kampanya: "15 günlük %10 kampanya" | "kampanya oluştur %10 15 gün"
  if (/kampanya/.test(n) && /(olustur|ac|yap|yeni)/.test(n)) {
    const pct = text.match(/%\s*(-?\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*%\s*(?:indirim)?/i)
    const days = text.match(/(\d+)\s*g[uü]n/i)
    const discountRate = pct ? Number(String(pct[1] ?? pct[2]).replace(",", ".")) : NaN
    const durationDays = days ? Number(days[1]) : NaN
    if (Number.isFinite(discountRate) && Number.isFinite(durationDays)) {
      const nameMatch = text.match(/["“](.+?)["”]/) || text.match(/ad[ıi]\s*[:\-]?\s*(.+)$/i)
      const name = nameMatch?.[1]?.trim() || `%${discountRate} İndirim — ${durationDays} Gün`
      return {
        kind: "tool",
        tool: "create_campaign",
        args: { name, discountRate: Math.abs(discountRate), durationDays, dryRun: true },
      }
    }
  }

  // Shorter campaign without "oluştur"
  if (/kampanya/.test(n) && /%?\s*\d+/.test(n) && /\d+\s*g[uü]n/.test(n)) {
    const pct = text.match(/%\s*(-?\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*%/i)
    const days = text.match(/(\d+)\s*g[uü]n/i)
    const discountRate = pct ? Math.abs(Number(String(pct[1] ?? pct[2]).replace(",", "."))) : NaN
    const durationDays = days ? Number(days[1]) : NaN
    if (Number.isFinite(discountRate) && Number.isFinite(durationDays)) {
      return {
        kind: "tool",
        tool: "create_campaign",
        args: {
          name: `%${discountRate} İndirim — ${durationDays} Gün`,
          discountRate,
          durationDays,
          dryRun: true,
        },
      }
    }
  }

  return { kind: "unknown" }
}

const HELP_TEXT = `Ücretsiz yerel asistan — örnek komutlar:

• Kategorileri listele
• Markaları listele
• Fren kategorisine %15 zam yap
• Bosch markasına %10 indirim
• Yeni kampanya: %10 indirim, 15 gün
• Bakım modunu aç / kapat
• Fiyat güncelleme bildirimini 20.07.2026 için aç
• Ürün ara: balata
• İş özeti ver

Fiyat ve kampanyada önce önizleme gelir; “onayla” ile uygulanır.`

export async function runAdminAssistantChat(opts: {
  service: SupabaseClient
  callerId: string
  messages: { role: "user" | "assistant"; content: string }[]
  pendingAction?: PendingAction | null
}): Promise<{ reply: string; actions: string[]; pendingAction: PendingAction | null }> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")
  if (!lastUser) {
    return { reply: HELP_TEXT, actions: [], pendingAction: opts.pendingAction ?? null }
  }

  const intent = parseIntent(lastUser.content)
  const actions: string[] = []

  if (intent.kind === "help") {
    return { reply: HELP_TEXT, actions, pendingAction: null }
  }

  if (intent.kind === "cancel") {
    return { reply: "Tamam, bekleyen işlem iptal edildi.", actions, pendingAction: null }
  }

  if (intent.kind === "confirm") {
    if (!opts.pendingAction) {
      return {
        reply: "Onaylanacak bekleyen bir işlem yok. Önce bir komut yazın (ör. kategori zammı).",
        actions,
        pendingAction: null,
      }
    }
    const result = await runAssistantTool(
      opts.service,
      opts.callerId,
      opts.pendingAction.tool,
      opts.pendingAction.args
    )
    actions.push(opts.pendingAction.tool)
    const formatted = formatToolResult(opts.pendingAction.tool, result)
    return { reply: formatted.reply, actions, pendingAction: formatted.pending }
  }

  if (intent.kind === "tool") {
    const result = await runAssistantTool(opts.service, opts.callerId, intent.tool, intent.args)
    actions.push(intent.tool)
    const formatted = formatToolResult(intent.tool, result)
    return { reply: formatted.reply, actions, pendingAction: formatted.pending }
  }

  return {
    reply: `Komutu anlayamadım.\n\n${HELP_TEXT}`,
    actions,
    pendingAction: opts.pendingAction ?? null,
  }
}

