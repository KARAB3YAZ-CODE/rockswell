import type { SupabaseClient } from "@supabase/supabase-js"
import { createInvoiceForOrder } from "@/lib/invoices"
import { applyStockMovement, orderItemsToStockLines } from "@/lib/inventory"

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string }

export type PendingAction = {
  tool: string
  args: Record<string, unknown>
}

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

function formatMoney(n: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n)
}

/** Simple edit distance for fuzzy Turkish matching */
function distance(a: string, b: string) {
  const s = norm(a)
  const t = norm(b)
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  const row = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s.length; i++) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cur = row[j]
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = cur
    }
  }
  return row[t.length]
}

function scoreMatch(query: string, candidate: string) {
  const q = norm(query)
  const c = norm(candidate)
  if (!q || !c) return 0
  if (c === q) return 100
  if (c.startsWith(q)) return 90
  if (c.includes(q)) return 80
  if (q.includes(c) && c.length >= 3) return 70
  const d = distance(q, c)
  const maxLen = Math.max(q.length, c.length)
  if (d <= 2 && maxLen >= 4) return 60 - d * 5
  // token overlap
  const qt = q.split(/\s+/).filter(Boolean)
  const ct = c.split(/\s+/).filter(Boolean)
  const hit = qt.filter((t) => ct.some((x) => x.includes(t) || t.includes(x))).length
  if (hit) return 40 + hit * 10
  return 0
}

async function loadDistinct(service: SupabaseClient, column: "category" | "brand") {
  const { data, error } = await service.from("products").select(column).eq("is_active", true)
  if (error) throw new Error(error.message)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const name = String((row as Record<string, unknown>)[column] ?? "").trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, productCount]) => ({ name, productCount }))
    .sort((a, b) => b.productCount - a.productCount)
}

function rankNames(query: string, names: { name: string; productCount: number }[]) {
  return names
    .map((n) => ({ ...n, score: scoreMatch(query, n.name) }))
    .filter((n) => n.score >= 40)
    .sort((a, b) => b.score - a.score || b.productCount - a.productCount)
}

async function resolveName(
  service: SupabaseClient,
  filterType: "category" | "brand",
  query: string
): Promise<
  | { status: "exact"; value: string }
  | { status: "ambiguous"; options: string[] }
  | { status: "none" }
> {
  const list = await loadDistinct(service, filterType)
  const ranked = rankNames(query, list)
  if (!ranked.length) return { status: "none" }
  if (ranked[0].score >= 90 || (ranked.length === 1 && ranked[0].score >= 60)) {
    return { status: "exact", value: ranked[0].name }
  }
  if (ranked[0].score >= 70 && (!ranked[1] || ranked[0].score - ranked[1].score >= 15)) {
    return { status: "exact", value: ranked[0].name }
  }
  return { status: "ambiguous", options: ranked.slice(0, 6).map((r) => r.name) }
}

async function listCategories(service: SupabaseClient): Promise<ToolResult> {
  try {
    const categories = await loadDistinct(service, "category")
    return { ok: true, data: { categories, totalCategories: categories.length } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Hata" }
  }
}

async function listBrands(service: SupabaseClient): Promise<ToolResult> {
  try {
    const brands = (await loadDistinct(service, "brand")).slice(0, 60)
    return { ok: true, data: { brands } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Hata" }
  }
}

async function searchProducts(service: SupabaseClient, args: { query: string; limit?: number }): Promise<ToolResult> {
  const q = String(args.query ?? "").trim().replace(/[%_,]/g, " ").slice(0, 80)
  if (!q) return { ok: false, error: "Arama metni gerekli" }
  const limit = Math.min(30, Math.max(1, Number(args.limit) || 12))
  const { data, error } = await service
    .from("products")
    .select("id, sku, name, brand, category, base_price, is_active, images")
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
        image: Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : "",
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
    resolved?: boolean
  }
): Promise<ToolResult> {
  let filterValue = String(args.filterValue ?? "").trim()
  const percent = Number(args.percent)
  const dryRun = args.dryRun !== false
  if (!filterValue) return { ok: false, error: "Filtre değeri gerekli" }
  if (!Number.isFinite(percent) || percent === 0) return { ok: false, error: "Geçerli bir yüzde girin (0 olamaz)" }
  if (Math.abs(percent) > 100) return { ok: false, error: "Yüzde en fazla ±100 olabilir" }

  if (!args.resolved) {
    const resolved = await resolveName(service, args.filterType, filterValue)
    if (resolved.status === "none") {
      return {
        ok: false,
        error: `"${filterValue}" ile eşleşen ${args.filterType === "brand" ? "marka" : "kategori"} yok. “Kategorileri listele” yazın.`,
      }
    }
    if (resolved.status === "ambiguous") {
      return {
        ok: true,
        data: {
          needsPick: true,
          filterType: args.filterType,
          percent,
          options: resolved.options,
          message: "Birden fazla eşleşme var",
        },
      }
    }
    filterValue = resolved.value
  }

  const column = args.filterType === "brand" ? "brand" : "category"
  const { data, error } = await service
    .from("products")
    .select("id, sku, name, base_price, category, brand")
    .ilike(column, filterValue)
    .eq("is_active", true)

  if (error) return { ok: false, error: error.message }
  const products = data ?? []
  if (!products.length) {
    return { ok: false, error: `"${filterValue}" altında aktif ürün yok.` }
  }

  const factor = 1 + percent / 100
  const snapshot = products.map((p) => ({ id: String(p.id), base_price: Number(p.base_price) }))
  const samples = products.slice(0, 5).map((p) => ({
    sku: p.sku,
    name: p.name,
    oldPrice: Number(p.base_price),
    newPrice: round2(Number(p.base_price) * factor),
  }))
  const avgOld = products.reduce((s, p) => s + Number(p.base_price), 0) / products.length

  if (dryRun) {
    return {
      ok: true,
      data: {
        dryRun: true,
        filterType: args.filterType,
        filterValue,
        percent,
        matchedProducts: products.length,
        avgOld: round2(avgOld),
        avgNew: round2(avgOld * factor),
        samples,
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
      snapshot,
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
    },
  }
}

async function listCampaigns(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("campaigns")
    .select("id, name, description, discount_rate, start_date, end_date, is_active, categories, brands")
    .order("created_at", { ascending: false })
    .limit(25)
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

async function toggleCampaignByName(
  service: SupabaseClient,
  args: { query: string; isActive: boolean; dryRun?: boolean }
): Promise<ToolResult> {
  const query = String(args.query ?? "").trim()
  if (!query) return { ok: false, error: "Kampanya adı gerekli" }
  const { data, error } = await service
    .from("campaigns")
    .select("id, name, is_active, discount_rate, end_date")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) return { ok: false, error: error.message }
  const ranked = (data ?? [])
    .map((c) => ({ ...c, score: scoreMatch(query, String(c.name)) }))
    .filter((c) => c.score >= 40)
    .sort((a, b) => b.score - a.score)
  if (!ranked.length) return { ok: false, error: `"${query}" kampanyası bulunamadı` }
  if (ranked.length > 1 && ranked[0].score - (ranked[1]?.score ?? 0) < 15) {
    return {
      ok: true,
      data: {
        needsPick: true,
        options: ranked.slice(0, 6).map((c) => c.name),
        isActive: args.isActive,
        pickKind: "campaign_toggle",
      },
    }
  }
  const camp = ranked[0]
  if (args.dryRun !== false) {
    return {
      ok: true,
      data: {
        dryRun: true,
        campaignId: camp.id,
        name: camp.name,
        isActive: args.isActive,
        currentActive: camp.is_active,
      },
    }
  }
  const { error: upErr } = await service
    .from("campaigns")
    .update({ is_active: Boolean(args.isActive) })
    .eq("id", camp.id)
  if (upErr) return { ok: false, error: upErr.message }
  return {
    ok: true,
    data: { dryRun: false, campaignId: camp.id, name: camp.name, isActive: args.isActive },
  }
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

async function getSiteStatus(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service.from("site_settings").select("*").eq("id", 1).maybeSingle()
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      maintenanceEnabled: Boolean(data?.maintenance_enabled),
      maintenanceMessage: data?.maintenance_message ?? "",
      priceUpdateEnabled: Boolean(data?.price_update_enabled),
      priceUpdateDate: data?.price_update_date ?? null,
      priceUpdateMessage: data?.price_update_message ?? "",
    },
  }
}

async function getBusinessSummary(service: SupabaseClient): Promise<ToolResult> {
  const [{ count: productCount }, { count: companyCount }, { data: orders }, { count: userCount }] =
    await Promise.all([
      service.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
      service.from("companies").select("*", { count: "exact", head: true }),
      service.from("orders").select("status, pricing, created_at").limit(3000),
      service.from("profiles").select("*", { count: "exact", head: true }),
    ])
  let revenue = 0
  let pendingApproval = 0
  let cancelled = 0
  let last7 = 0
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const o of orders ?? []) {
    if (o.status === "pending_approval") pendingApproval += 1
    if (o.status === "cancelled") cancelled += 1
    if (["confirmed", "processing", "shipped", "delivered"].includes(String(o.status))) {
      revenue += Number((o.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0)
    }
    if (new Date(String(o.created_at)).getTime() >= weekAgo) last7 += 1
  }
  return {
    ok: true,
    data: {
      activeProducts: productCount ?? 0,
      companies: companyCount ?? 0,
      users: userCount ?? 0,
      ordersLoaded: orders?.length ?? 0,
      pendingApproval,
      cancelled,
      last7DaysOrders: last7,
      paidRevenueApprox: round2(revenue),
    },
  }
}

async function listPendingOrders(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("orders")
    .select("id, order_number, status, pricing, created_at, companies(name)")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      orders: (data ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        companyName: (o.companies as { name?: string } | null)?.name ?? "—",
        total: Number((o.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0),
        createdAt: o.created_at,
      })),
    },
  }
}

async function approvePendingOrders(
  service: SupabaseClient,
  args: { dryRun?: boolean }
): Promise<ToolResult> {
  const { data, error } = await service
    .from("orders")
    .select("id, order_number, pricing, companies(name)")
    .eq("status", "pending_approval")
    .limit(50)
  if (error) return { ok: false, error: error.message }
  const orders = data ?? []
  if (!orders.length) return { ok: true, data: { dryRun: true, count: 0, message: "Onay bekleyen sipariş yok" } }

  if (args.dryRun !== false) {
    return {
      ok: true,
      data: {
        dryRun: true,
        count: orders.length,
        samples: orders.slice(0, 5).map((o) => ({
          orderNumber: o.order_number,
          companyName: (o.companies as { name?: string } | null)?.name ?? "—",
          total: Number((o.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0),
        })),
      },
    }
  }

  let updated = 0
  for (const o of orders) {
    const { data: row, error: upErr } = await service
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", o.id)
      .select("id, order_number, company_id, items, pricing")
      .single()
    if (!upErr && row) {
      updated += 1
      try {
        await applyStockMovement(
          service,
          orderItemsToStockLines(
            (Array.isArray(row.items) ? row.items : []) as Array<{
              productId: string
              warehouseId: string
              quantity: number
              productName?: string
            }>
          ),
          "commit"
        )
      } catch {
        /* best-effort */
      }
      try {
        await createInvoiceForOrder(service, row)
      } catch {
        /* best-effort */
      }
    }
  }
  return { ok: true, data: { dryRun: false, updated, count: orders.length } }
}

async function listCompanies(service: SupabaseClient, args: { query?: string }): Promise<ToolResult> {
  let q = service.from("companies").select("id, name, discount_rate, credit_limit, email, phone").order("name").limit(40)
  const query = String(args.query ?? "").trim()
  if (query) q = q.ilike("name", `%${query}%`)
  const { data, error } = await q
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      companies: (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        discountRate: Number(c.discount_rate ?? 25),
        creditLimit: Number(c.credit_limit ?? 0),
        email: c.email,
        phone: c.phone,
      })),
    },
  }
}

async function setCompanyDiscount(
  service: SupabaseClient,
  args: { companyQuery: string; discountRate: number; dryRun?: boolean; resolvedId?: string }
): Promise<ToolResult> {
  const discountRate = Number(args.discountRate)
  if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 80) {
    return { ok: false, error: "İskonto 0–80 arasında olmalı" }
  }

  let company: { id: string; name: string; discount_rate: number } | null = null
  if (args.resolvedId) {
    const { data, error } = await service
      .from("companies")
      .select("id, name, discount_rate")
      .eq("id", args.resolvedId)
      .maybeSingle()
    if (error || !data) return { ok: false, error: error?.message ?? "Firma bulunamadı" }
    company = data as { id: string; name: string; discount_rate: number }
  } else {
    const query = String(args.companyQuery ?? "").trim()
    if (!query) return { ok: false, error: "Firma adı gerekli" }
    const { data, error } = await service.from("companies").select("id, name, discount_rate").limit(100)
    if (error) return { ok: false, error: error.message }
    const ranked = (data ?? [])
      .map((c) => ({ ...c, score: scoreMatch(query, String(c.name)) }))
      .filter((c) => c.score >= 40)
      .sort((a, b) => b.score - a.score)
    if (!ranked.length) return { ok: false, error: `"${query}" firması bulunamadı` }
    if (ranked.length > 1 && ranked[0].score - (ranked[1]?.score ?? 0) < 15) {
      return {
        ok: true,
        data: {
          needsPick: true,
          options: ranked.slice(0, 6).map((c) => c.name),
          discountRate,
          pickKind: "company_discount",
          optionIds: ranked.slice(0, 6).map((c) => c.id),
        },
      }
    }
    company = ranked[0] as { id: string; name: string; discount_rate: number }
  }

  if (args.dryRun !== false) {
    return {
      ok: true,
      data: {
        dryRun: true,
        companyId: company.id,
        companyName: company.name,
        oldRate: Number(company.discount_rate ?? 25),
        newRate: discountRate,
      },
    }
  }

  const { error: upErr } = await service
    .from("companies")
    .update({ discount_rate: discountRate })
    .eq("id", company.id)
  if (upErr) return { ok: false, error: upErr.message }
  return {
    ok: true,
    data: {
      dryRun: false,
      companyId: company.id,
      companyName: company.name,
      oldRate: Number(company.discount_rate ?? 25),
      newRate: discountRate,
    },
  }
}

async function listLowStock(service: SupabaseClient, args: { threshold?: number }): Promise<ToolResult> {
  const threshold = Math.max(1, Number(args.threshold) || 5)
  const { data, error } = await service
    .from("products")
    .select("id, sku, name, brand, category, stock, base_price, is_active, images")
    .eq("is_active", true)
    .limit(500)
  if (error) return { ok: false, error: error.message }

  const low = (data ?? [])
    .map((p) => {
      const stock = Array.isArray(p.stock)
        ? (p.stock as { available?: number; quantity?: number }[]).reduce(
            (s, x) => s + Number(x.available ?? x.quantity ?? 0),
            0
          )
        : 0
      return {
        id: String(p.id),
        sku: String(p.sku),
        name: String(p.name),
        brand: String(p.brand ?? ""),
        category: String(p.category ?? ""),
        stock,
        basePrice: Number(p.base_price),
        image: Array.isArray(p.images) && p.images[0] ? String(p.images[0]) : "",
      }
    })
    .filter((p) => p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 25)

  return { ok: true, data: { threshold, products: low, count: low.length } }
}

async function restorePrices(
  service: SupabaseClient,
  args: { items: { id: string; base_price: number }[] }
): Promise<ToolResult> {
  const items = Array.isArray(args.items) ? args.items : []
  if (!items.length) return { ok: false, error: "Geri alınacak fiyat kaydı yok" }
  let restored = 0
  const chunkSize = 40
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (item) => {
        const { error } = await service
          .from("products")
          .update({ base_price: Number(item.base_price) })
          .eq("id", item.id)
        if (!error) restored += 1
      })
    )
  }
  return { ok: true, data: { restored, total: items.length } }
}

async function listWarehouses(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("warehouses")
    .select("id, name, code, address, is_active, capacity, used_capacity")
    .order("name")
    .limit(40)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      warehouses: (data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        city: String((w.address as { city?: string } | null)?.city ?? "—"),
        isActive: w.is_active,
        capacity: w.capacity,
        used: w.used_capacity,
      })),
    },
  }
}

async function listRecentOrders(service: SupabaseClient, args: { limit?: number }): Promise<ToolResult> {
  const limit = Math.min(30, Math.max(1, Number(args.limit) || 12))
  const { data, error } = await service
    .from("orders")
    .select("id, order_number, status, pricing, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      orders: (data ?? []).map((o) => ({
        orderNumber: o.order_number,
        status: o.status,
        companyName: (o.companies as { name?: string } | null)?.name ?? "—",
        total: Number((o.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0),
        createdAt: o.created_at,
      })),
    },
  }
}

async function listUsers(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("profiles")
    .select("id, name, surname, role, is_active, company_id, companies(name)")
    .order("created_at", { ascending: false })
    .limit(30)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      users: (data ?? []).map((u) => ({
        name: `${u.name ?? ""} ${u.surname ?? ""}`.trim(),
        role: u.role,
        isActive: u.is_active,
        companyName: (u.companies as { name?: string } | null)?.name ?? "—",
      })),
    },
  }
}

async function listInvoices(service: SupabaseClient): Promise<ToolResult> {
  const { data, error } = await service
    .from("invoices")
    .select("id, invoice_number, status, grand_total, created_at, companies(name)")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: {
      invoices: (data ?? []).map((inv) => ({
        invoiceNumber: inv.invoice_number,
        status: inv.status,
        total: Number(inv.grand_total ?? 0),
        companyName: (inv.companies as { name?: string } | null)?.name ?? "—",
        createdAt: inv.created_at,
      })),
    },
  }
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
        resolved?: boolean
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
    case "toggle_campaign":
      return toggleCampaignByName(service, args as { query: string; isActive: boolean; dryRun?: boolean })
    case "set_maintenance":
      return setMaintenance(service, args as { enabled: boolean; message?: string }, callerId)
    case "set_price_update_notice":
      return setPriceUpdateNotice(service, args as { enabled: boolean; date?: string; message?: string }, callerId)
    case "get_site_status":
      return getSiteStatus(service)
    case "get_business_summary":
      return getBusinessSummary(service)
    case "list_pending_orders":
      return listPendingOrders(service)
    case "approve_pending_orders":
      return approvePendingOrders(service, args as { dryRun?: boolean })
    case "list_companies":
      return listCompanies(service, args as { query?: string })
    case "set_company_discount":
      return setCompanyDiscount(service, args as {
        companyQuery: string
        discountRate: number
        dryRun?: boolean
        resolvedId?: string
      })
    case "list_low_stock":
      return listLowStock(service, args as { threshold?: number })
    case "restore_prices":
      return restorePrices(service, args as { items: { id: string; base_price: number }[] })
    case "list_warehouses":
      return listWarehouses(service)
    case "list_recent_orders":
      return listRecentOrders(service, args as { limit?: number })
    case "list_users":
      return listUsers(service)
    case "list_invoices":
      return listInvoices(service)
    default:
      return { ok: false, error: `Bilinmeyen araç: ${name}` }
  }
}

function isConfirm(text: string) {
  return /^(onayla|uygula|evet|tamam|ok|olur|yap|onay)\b/i.test(text.trim())
}

function isCancel(text: string) {
  return /^(iptal|vazgec|vazgeç|hayir|hayır|no)\b/i.test(norm(text))
}

function isUndo(text: string) {
  return /^(geri\s*al|undo|geri)\b/i.test(norm(text))
}

export type AssistantChoice = { id: string; label: string }

export type AssistantCard = {
  type: "product"
  id?: string
  title: string
  subtitle?: string
  image?: string
  sku?: string
  price?: number
  stock?: number
  badges?: { label: string; tone?: "warning" | "danger" | "accent" | "muted" | "success" }[]
}

export type FormattedResult = {
  reply: string
  pending: PendingAction | null
  choices?: AssistantChoice[]
  undoAction?: PendingAction | null
  cards?: AssistantCard[]
}

function fmt(
  reply: string,
  pending: PendingAction | null = null,
  extra?: {
    choices?: AssistantChoice[]
    undoAction?: PendingAction | null
    cards?: AssistantCard[]
  }
): FormattedResult {
  return {
    reply,
    pending,
    choices: extra?.choices,
    undoAction: extra?.undoAction ?? null,
    cards: extra?.cards,
  }
}

function pickChoices(options: string[]): AssistantChoice[] {
  return options.map((o, i) => ({ id: String(i + 1), label: o }))
}

function formatToolResult(tool: string, result: ToolResult): FormattedResult {
  if (!result.ok) return fmt(`Hata: ${result.error}`)
  const data = result.data as Record<string, unknown>

  // Ambiguous pick flows
  if (data.needsPick && Array.isArray(data.options)) {
    const options = data.options as string[]
    const choices = pickChoices(options)
    if (data.pickKind === "company_discount") {
      return fmt(`Bunu mu demek istediniz? Aşağıdan firmayı seçin:`, {
        tool: "_pick",
        args: {
          pickKind: "company_discount",
          options,
          optionIds: data.optionIds,
          discountRate: data.discountRate,
        },
      }, { choices })
    }
    if (data.pickKind === "campaign_toggle") {
      return fmt(`Bunu mu demek istediniz? Kampanyayı seçin:`, {
        tool: "_pick",
        args: {
          pickKind: "campaign_toggle",
          options,
          isActive: data.isActive,
        },
      }, { choices })
    }
    return fmt(`Bunu mu demek istediniz? Aşağıdan seçin:`, {
      tool: "_pick",
      args: {
        pickKind: "adjust_prices",
        options,
        filterType: data.filterType,
        percent: data.percent,
      },
    }, { choices })
  }

  if (tool === "list_categories") {
    const cats = (data.categories as { name: string; productCount: number }[]) ?? []
    const lines = cats.slice(0, 35).map((c) => `• ${c.name} (${c.productCount})`)
    const choices = cats.slice(0, 12).map((c) => ({
      id: c.name,
      label: `${c.name} (%15 zam)`,
    }))
    return fmt(
      `Kategoriler (${data.totalCategories}):\n${lines.join("\n")}${cats.length > 35 ? "\n…" : ""}\n\nHızlı işlem için bir kategoriye tıklayabilirsiniz.`,
      null,
      { choices }
    )
  }

  if (tool === "list_brands") {
    const brands = (data.brands as { name: string; productCount: number }[]) ?? []
    return fmt(
      `Markalar:\n${brands.map((b) => `• ${b.name} (${b.productCount})`).join("\n")}`,
      null,
      {
        choices: brands.slice(0, 12).map((b) => ({
          id: b.name,
          label: `${b.name} (%10 indirim)`,
        })),
      }
    )
  }

  if (tool === "search_products") {
    const products = (data.products as {
      id?: string
      sku: string
      name: string
      basePrice: number
      category: string
      brand?: string
      image?: string
    }[]) ?? []
    if (!products.length) return fmt("Ürün bulunamadı.")
    return fmt(`“Arama” için ${products.length} ürün bulundu.`, null, {
      cards: products.map((p) => ({
        type: "product" as const,
        id: p.id,
        title: p.name,
        subtitle: [p.brand, p.category].filter(Boolean).join(" · "),
        sku: p.sku,
        image: p.image,
        price: p.basePrice,
        badges: [{ label: p.sku, tone: "muted" as const }],
      })),
    })
  }

  if (tool === "adjust_prices") {
    const samples = (data.samples as { sku: string; name: string; oldPrice: number; newPrice: number }[]) ?? []
    const sampleLines = samples
      .map((s) => `• ${s.sku}: ${formatMoney(s.oldPrice)} → ${formatMoney(s.newPrice)}`)
      .join("\n")
    if (data.dryRun) {
      return fmt(
        `Önizleme — ${data.filterType === "brand" ? "marka" : "kategori"}: ${data.filterValue}\n• ${data.matchedProducts} ürün\n• %${data.percent} ${Number(data.percent) > 0 ? "zam" : "indirim"}\n• Ort. ${formatMoney(Number(data.avgOld))} → ${formatMoney(Number(data.avgNew))}\n${sampleLines}\n\nOnaylıyor musunuz?`,
        {
          tool: "adjust_prices",
          args: {
            filterType: data.filterType,
            filterValue: data.filterValue,
            percent: data.percent,
            dryRun: false,
            resolved: true,
          },
        }
      )
    }
    return fmt(
      `Güncellendi: ${data.updated} ürün (%${data.percent}, ${data.filterValue}).\n${sampleLines}\n\nYanlış olduysa “Geri al”a basın.`,
      null,
      {
        undoAction: {
          tool: "restore_prices",
          args: { items: data.snapshot },
        },
      }
    )
  }

  if (tool === "restore_prices") {
    return fmt(`${data.restored}/${data.total} ürün fiyatı eski haline alındı.`)
  }

  if (tool === "create_campaign") {
    const preview = (data.preview ?? data.campaign) as Record<string, unknown>
    if (data.dryRun) {
      return fmt(
        `Kampanya önizlemesi:\n• ${preview.name}\n• %${preview.discountRate} indirim\n• ${preview.durationDays} gün\n• ${String(preview.startDate).slice(0, 10)} → ${String(preview.endDate).slice(0, 10)}\n\nOluşturulsun mu?`,
        {
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
        }
      )
    }
    return fmt(`Kampanya hazır: “${preview.name}” (%${preview.discountRate}).`, null, {
      undoAction: preview.id
        ? { tool: "toggle_campaign", args: { query: preview.name, isActive: false, dryRun: false } }
        : null,
    })
  }

  if (tool === "list_campaigns") {
    const campaigns = (data.campaigns as {
      name: string
      discountRate: number
      isActive: boolean
      endDate: string
    }[]) ?? []
    if (!campaigns.length) return fmt("Kampanya yok.")
    return fmt(
      `Kampanyalar:\n${campaigns
        .map((c) => `• ${c.name} — %${c.discountRate} — ${c.isActive ? "aktif" : "pasif"} — bitiş ${String(c.endDate).slice(0, 10)}`)
        .join("\n")}`,
      null,
      {
        choices: campaigns.slice(0, 8).map((c) => ({
          id: c.name,
          label: c.isActive ? `${c.name} — kapat` : `${c.name} — aç`,
        })),
      }
    )
  }

  if (tool === "toggle_campaign") {
    if (data.dryRun) {
      return fmt(
        `Kampanya “${data.name}” ${data.isActive ? "açılacak" : "kapatılacak"} (şu an: ${data.currentActive ? "aktif" : "pasif"}).\nOnaylıyor musunuz?`,
        {
          tool: "toggle_campaign",
          args: { query: data.name, isActive: data.isActive, dryRun: false },
        }
      )
    }
    return fmt(`“${data.name}” kampanyası ${data.isActive ? "açıldı" : "kapatıldı"}.`, null, {
      undoAction: {
        tool: "toggle_campaign",
        args: { query: data.name, isActive: !data.isActive, dryRun: false },
      },
    })
  }

  if (tool === "set_maintenance") {
    return fmt(
      data.maintenanceEnabled
        ? `Bakım modu açıldı.\n${data.maintenanceMessage}`
        : "Bakım modu kapatıldı.",
      null,
      {
        undoAction: {
          tool: "set_maintenance",
          args: { enabled: !data.maintenanceEnabled },
        },
      }
    )
  }

  if (tool === "set_price_update_notice") {
    if (!data.priceUpdateEnabled) {
      return fmt("Fiyat güncelleme bildirimi kapatıldı.", null, {
        undoAction: {
          tool: "set_price_update_notice",
          args: { enabled: true, date: data.priceUpdateDate, message: data.priceUpdateMessage },
        },
      })
    }
    return fmt(
      `Fiyat güncelleme bildirimi açıldı${data.priceUpdateDate ? ` (${data.priceUpdateDate})` : ""}.`,
      null,
      {
        undoAction: { tool: "set_price_update_notice", args: { enabled: false } },
      }
    )
  }

  if (tool === "get_site_status") {
    return fmt(
      `Sistem durumu:\n• Bakım: ${data.maintenanceEnabled ? "AÇIK" : "kapalı"}\n• Fiyat bildirimi: ${data.priceUpdateEnabled ? `AÇIK${data.priceUpdateDate ? ` (${data.priceUpdateDate})` : ""}` : "kapalı"}`
    )
  }

  if (tool === "get_business_summary") {
    return fmt(
      `Özet:\n• Aktif ürün: ${data.activeProducts}\n• Firma: ${data.companies}\n• Kullanıcı: ${data.users}\n• Onay bekleyen: ${data.pendingApproval}\n• İptal: ${data.cancelled}\n• Son 7 gün sipariş: ${data.last7DaysOrders}\n• Tahmini ciro: ${formatMoney(Number(data.paidRevenueApprox ?? 0))}`
    )
  }

  if (tool === "list_pending_orders") {
    const orders = (data.orders as { orderNumber: string; companyName: string; total: number }[]) ?? []
    if (!orders.length) return fmt("Onay bekleyen sipariş yok.")
    return fmt(
      `Onay bekleyen (${orders.length}):\n${orders
        .map((o) => `• ${o.orderNumber} — ${o.companyName} — ${formatMoney(o.total)}`)
        .join("\n")}`,
      null,
      {
        choices: [{ id: "approve_all", label: "Hepsini onayla (önizle)" }],
      }
    )
  }

  if (tool === "approve_pending_orders") {
    if (data.count === 0) return fmt("Onay bekleyen sipariş yok.")
    if (data.dryRun) {
      const samples = (data.samples as { orderNumber: string; companyName: string; total: number }[]) ?? []
      return fmt(
        `${data.count} sipariş onaylanacak:\n${samples
          .map((o) => `• ${o.orderNumber} — ${o.companyName} — ${formatMoney(o.total)}`)
          .join("\n")}\n\nOnaylıyor musunuz?`,
        { tool: "approve_pending_orders", args: { dryRun: false } }
      )
    }
    return fmt(`${data.updated} sipariş onaylandı (confirmed).`)
  }

  if (tool === "list_companies") {
    const companies = (data.companies as { name: string; discountRate: number; creditLimit: number }[]) ?? []
    if (!companies.length) return fmt("Firma bulunamadı.")
    return fmt(
      `Firmalar:\n${companies
        .map((c) => `• ${c.name} — %${c.discountRate} iskonto — limit ${formatMoney(c.creditLimit)}`)
        .join("\n")}`,
      null,
      {
        choices: companies.slice(0, 10).map((c) => ({
          id: c.name,
          label: `${c.name} — %30 iskonto yap`,
        })),
      }
    )
  }

  if (tool === "set_company_discount") {
    if (data.dryRun) {
      return fmt(
        `Firma iskontosu önizleme:\n• ${data.companyName}\n• %${data.oldRate} → %${data.newRate}\n\nKaydedilsin mi?`,
        {
          tool: "set_company_discount",
          args: {
            companyQuery: data.companyName,
            discountRate: data.newRate,
            resolvedId: data.companyId,
            dryRun: false,
          },
        }
      )
    }
    return fmt(`${data.companyName} iskontosu %${data.newRate} olarak güncellendi.`, null, {
      undoAction: {
        tool: "set_company_discount",
        args: {
          companyQuery: data.companyName,
          discountRate: data.oldRate ?? 25,
          resolvedId: data.companyId,
          dryRun: false,
        },
      },
    })
  }

  if (tool === "list_low_stock") {
    const products = (data.products as {
      id?: string
      sku: string
      name: string
      stock: number
      brand?: string
      category?: string
      basePrice?: number
      image?: string
    }[]) ?? []
    if (!products.length) return fmt(`Stok ≤ ${data.threshold} olan ürün yok.`)
    return fmt(
      `Düşük stok uyarısı — eşik ≤${data.threshold}, ${data.count} ürün`,
      null,
      {
        cards: products.map((p) => ({
          type: "product" as const,
          id: p.id,
          title: p.name,
          subtitle: [p.brand, p.category].filter(Boolean).join(" · "),
          sku: p.sku,
          image: p.image,
          price: p.basePrice,
          stock: p.stock,
          badges: [
            {
              label: p.stock <= 0 ? "Tükendi" : `Stok ${p.stock}`,
              tone: (p.stock <= 0 ? "danger" : "warning") as "danger" | "warning",
            },
            { label: p.sku, tone: "muted" as const },
          ],
        })),
      }
    )
  }

  if (tool === "list_warehouses") {
    const warehouses = (data.warehouses as { name: string; code: string; city: string; isActive: boolean }[]) ?? []
    if (!warehouses.length) return fmt("Depo yok.")
    return fmt(
      `Depolar:\n${warehouses
        .map((w) => `• ${w.name} (${w.code}) — ${w.city} — ${w.isActive ? "aktif" : "pasif"}`)
        .join("\n")}`
    )
  }

  if (tool === "list_recent_orders") {
    const orders = (data.orders as { orderNumber: string; status: string; companyName: string; total: number }[]) ?? []
    if (!orders.length) return fmt("Sipariş yok.")
    return fmt(
      `Son siparişler:\n${orders
        .map((o) => `• ${o.orderNumber} — ${o.companyName} — ${o.status} — ${formatMoney(o.total)}`)
        .join("\n")}`
    )
  }

  if (tool === "list_users") {
    const users = (data.users as { name: string; role: string; companyName: string; isActive: boolean }[]) ?? []
    if (!users.length) return fmt("Kullanıcı yok.")
    return fmt(
      `Kullanıcılar:\n${users
        .map((u) => `• ${u.name || "—"} — ${u.role} — ${u.companyName} — ${u.isActive ? "aktif" : "pasif"}`)
        .join("\n")}`
    )
  }

  if (tool === "list_invoices") {
    const invoices = (data.invoices as { invoiceNumber: string; status: string; companyName: string; total: number }[]) ?? []
    if (!invoices.length) return fmt("Fatura yok.")
    return fmt(
      `Faturalar:\n${invoices
        .map((i) => `• ${i.invoiceNumber} — ${i.companyName} — ${i.status} — ${formatMoney(i.total)}`)
        .join("\n")}`
    )
  }

  return fmt(JSON.stringify(data, null, 2))
}

type ParsedIntent =
  | { kind: "tool"; tool: string; args: Record<string, unknown> }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "help" }
  | { kind: "pick"; value: string }
  | { kind: "unknown" }

function parseDateFromText(text: string, n: string): string | undefined {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const dmy = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/)
  if (dmy) {
    const dd = dmy[1].padStart(2, "0")
    const mm = dmy[2].padStart(2, "0")
    let yyyy = dmy[3] ?? String(new Date().getFullYear())
    if (yyyy.length === 2) yyyy = `20${yyyy}`
    return `${yyyy}-${mm}-${dd}`
  }
  const months: Record<string, string> = {
    ocak: "01",
    subat: "02",
    mart: "03",
    nisan: "04",
    mayis: "05",
    haziran: "06",
    temmuz: "07",
    agustos: "08",
    eylul: "09",
    ekim: "10",
    kasim: "11",
    aralik: "12",
  }
  const m = n.match(/(\d{1,2})\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)/)
  if (m) {
    return `${new Date().getFullYear()}-${months[m[2]]}-${m[1].padStart(2, "0")}`
  }
  return undefined
}

function parseIntent(raw: string): ParsedIntent {
  const text = raw.trim()
  const n = norm(text)

  if (isConfirm(text)) return { kind: "confirm" }
  if (isCancel(text)) return { kind: "cancel" }
  if (/yardim|help|ne yapabilir|komutlar?|ornek/.test(n) || n === "?") return { kind: "help" }

  // Choice-chip shortcuts from UI
  if (/^hepsini onayla/i.test(text)) {
    return { kind: "tool", tool: "approve_pending_orders", args: { dryRun: true } }
  }
  const chipZam = text.match(/^(.+?)\s*\(%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*zam\)\s*$/i)
  if (chipZam) {
    return {
      kind: "tool",
      tool: "adjust_prices",
      args: {
        filterType: "category",
        filterValue: chipZam[1].trim(),
        percent: Number(String(chipZam[2]).replace(",", ".")),
        dryRun: true,
      },
    }
  }
  const chipIndirim = text.match(/^(.+?)\s*\(%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*indirim\)\s*$/i)
  if (chipIndirim) {
    return {
      kind: "tool",
      tool: "adjust_prices",
      args: {
        filterType: "brand",
        filterValue: chipIndirim[1].trim(),
        percent: -Math.abs(Number(String(chipIndirim[2]).replace(",", "."))),
        dryRun: true,
      },
    }
  }
  const chipCampClose = text.match(/^(.+?)\s*[—\-]\s*kapat\s*$/i)
  if (chipCampClose) {
    return {
      kind: "tool",
      tool: "toggle_campaign",
      args: { query: chipCampClose[1].trim(), isActive: false, dryRun: true },
    }
  }
  const chipCampOpen = text.match(/^(.+?)\s*[—\-]\s*aç\s*$/i)
  if (chipCampOpen) {
    return {
      kind: "tool",
      tool: "toggle_campaign",
      args: { query: chipCampOpen[1].trim(), isActive: true, dryRun: true },
    }
  }
  const chipCompany = text.match(/^(.+?)\s*[—\-]\s*%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*iskonto/i)
  if (chipCompany) {
    return {
      kind: "tool",
      tool: "set_company_discount",
      args: {
        companyQuery: chipCompany[1].trim(),
        discountRate: Number(String(chipCompany[2]).replace(",", ".")),
        dryRun: true,
      },
    }
  }

  // bare number for pick
  if (/^\d{1,2}$/.test(text.trim())) return { kind: "pick", value: text.trim() }

  if (/kategori.*(liste|goster|neler)|^kategorileri?\b/.test(n)) {
    return { kind: "tool", tool: "list_categories", args: {} }
  }
  if (/marka.*(liste|goster|neler)|^markalari?\b/.test(n)) {
    return { kind: "tool", tool: "list_brands", args: {} }
  }
  if (/kampanya.*(liste|goster|neler)|^kampanyalari?\b/.test(n)) {
    return { kind: "tool", tool: "list_campaigns", args: {} }
  }
  if (/depo.*(liste|goster)|^depolar?\b/.test(n)) {
    return { kind: "tool", tool: "list_warehouses", args: {} }
  }
  if (/kullanici.*(liste|goster)|^kullanicilari?\b/.test(n)) {
    return { kind: "tool", tool: "list_users", args: {} }
  }
  if (/fatura.*(liste|goster)|^faturalari?\b/.test(n)) {
    return { kind: "tool", tool: "list_invoices", args: {} }
  }
  if (/son\s*siparis|siparisleri?\s*(liste|goster)|^siparisler?\b/.test(n) && !/bekleyen|onay/.test(n)) {
    return { kind: "tool", tool: "list_recent_orders", args: { limit: 15 } }
  }
  if (/(is\s*ozeti|ozet\s*ver|dashboard|rapor\s*ozet|genel\s*durum|ozet)/.test(n) && !/fiyat/.test(n)) {
    return { kind: "tool", tool: "get_business_summary", args: {} }
  }
  if (/sistem\s*durum|bakim\s*durum|site\s*durum/.test(n)) {
    return { kind: "tool", tool: "get_site_status", args: {} }
  }
  if (/dusuk\s*stok|stok.*(az|dusuk|bit|kritik)|kritik\s*stok/.test(n)) {
    const th = text.match(/(\d+)/)
    return { kind: "tool", tool: "list_low_stock", args: { threshold: th ? Number(th[1]) : 5 } }
  }
  if (/bekleyen\s*siparis|onay\s*bekleyen|pending/.test(n) && !/onayla|onay\s*et/.test(n)) {
    return { kind: "tool", tool: "list_pending_orders", args: {} }
  }
  if (/(bekleyen\s*)?siparis.*(onayla|onay\s*et)|onay\s*bekleyen.*(onayla|hepsini)/.test(n)) {
    return { kind: "tool", tool: "approve_pending_orders", args: { dryRun: true } }
  }
  if (/firmalari?\s*(liste|goster)|firma\s*liste/.test(n)) {
    const q = text.match(/firma(?:lar)?(?:ı|i)?\s*(?:listele|göster)?\s*[:\-]?\s*(.+)/i)
    return { kind: "tool", tool: "list_companies", args: { query: q?.[1]?.trim() || undefined } }
  }

  const search = text.match(/(?:ürün\s*)?(?:ara|bul)\s*[:\-]?\s*(.+)/i)
  if (search?.[1]) {
    return { kind: "tool", tool: "search_products", args: { query: search[1].trim(), limit: 15 } }
  }

  // Company discount: "Otoparç firmasına %30 iskonto"
  const companyDisc = text.match(
    /(.+?)\s+firma(?:sina|ya|si)?\s+%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*(?:iskonto|indirim)/i
  ) || text.match(
    /(.+?)\s+(?:icin|için)\s+%?\s*(\d+(?:[.,]\d+)?)\s*%?\s*iskonto/i
  )
  if (companyDisc) {
    return {
      kind: "tool",
      tool: "set_company_discount",
      args: {
        companyQuery: companyDisc[1].replace(/\bfirma\b/gi, "").trim(),
        discountRate: Number(String(companyDisc[2]).replace(",", ".")),
        dryRun: true,
      },
    }
  }

  // Campaign toggle
  if (/kampanya/.test(n) && /(kapat|pasif|durdur)/.test(n)) {
    const name = text
      .replace(/kampanya(yı|yi|yı)?/gi, "")
      .replace(/kapat|pasif|durdur|et/gi, "")
      .trim()
    if (name) return { kind: "tool", tool: "toggle_campaign", args: { query: name, isActive: false, dryRun: true } }
  }
  if (/kampanya/.test(n) && /(ac|aktif\s*et|baslat)/.test(n) && !/(olustur|yeni|yap)/.test(n)) {
    const name = text
      .replace(/kampanya(yı|yi)?/gi, "")
      .replace(/aç|ac|aktif\s*et|başlat|baslat/gi, "")
      .trim()
    if (name) return { kind: "tool", tool: "toggle_campaign", args: { query: name, isActive: true, dryRun: true } }
  }

  // Maintenance
  if (/bakim/.test(n) && /(ac|aktif|baslat)/.test(n) && !/kapat|kapa|pasif|bitir/.test(n)) {
    const msg = text.match(/mesaj\s*[:\-]?\s*(.+)$/i)
    return {
      kind: "tool",
      tool: "set_maintenance",
      args: { enabled: true, ...(msg ? { message: msg[1].trim() } : {}) },
    }
  }
  if (/bakim/.test(n) && /(kapat|kapa|pasif|bitir)/.test(n)) {
    return { kind: "tool", tool: "set_maintenance", args: { enabled: false } }
  }

  // Price update notice
  if (/fiyat.*(guncelle|bildirim|duyuru)/.test(n) || /guncelleme\s*bildirim/.test(n)) {
    if (/(kapat|kapa|pasif|bitir)/.test(n)) {
      return { kind: "tool", tool: "set_price_update_notice", args: { enabled: false } }
    }
    const date = parseDateFromText(text, n)
    return {
      kind: "tool",
      tool: "set_price_update_notice",
      args: { enabled: true, ...(date ? { date } : {}) },
    }
  }

  // Price adjust
  const pricePatterns = [
    /(.+?)\s+(kategori(?:sine|ye|si)?|marka(?:sina|ya|si)?)\s+%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim|artir|dusur|indir)/i,
    /%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim)\s+(.+?)\s+(kategori|marka)/i,
    /(.+?)\s+(?:icin|için)?\s*%?\s*(-?\d+(?:[.,]\d+)?)\s*%?\s*(zam|indirim)/i,
  ]
  for (let i = 0; i < pricePatterns.length; i++) {
    const m = text.match(pricePatterns[i])
    if (!m) continue
    let filterValue = ""
    let filterType: "category" | "brand" = "category"
    let percent = 0
    let action = "zam"
    if (i === 0) {
      filterValue = m[1].trim()
      filterType = norm(m[2]).startsWith("marka") ? "brand" : "category"
      percent = Number(String(m[3]).replace(",", "."))
      action = norm(m[4])
    } else if (i === 1) {
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
    filterValue = filterValue
      .replace(/\b(kategorisine|kategoriye|kategorisi|markasina|markaya|markasi|icin|için|yeni)\b/gi, "")
      .trim()
    return {
      kind: "tool",
      tool: "adjust_prices",
      args: { filterType, filterValue, percent, dryRun: true },
    }
  }

  // Campaign create
  if (/kampanya/.test(n) && (/(olustur|yeni|yap)/.test(n) || (/%?\s*\d+/.test(n) && /\d+\s*g[uü]n/.test(n)))) {
    const pct = text.match(/%\s*(-?\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*%\s*(?:indirim)?/i)
    const days = text.match(/(\d+)\s*g[uü]n/i)
    const discountRate = pct ? Math.abs(Number(String(pct[1] ?? pct[2]).replace(",", "."))) : NaN
    const durationDays = days ? Number(days[1]) : NaN
    if (Number.isFinite(discountRate) && Number.isFinite(durationDays)) {
      const nameMatch = text.match(/["“](.+?)["”]/)
      return {
        kind: "tool",
        tool: "create_campaign",
        args: {
          name: nameMatch?.[1]?.trim() || `%${discountRate} İndirim — ${durationDays} Gün`,
          discountRate,
          durationDays,
          dryRun: true,
        },
      }
    }
  }

  // Free-text pick candidate (category name etc.) when pending exists — handled in runner
  if (text.length >= 2 && text.length <= 80 && !/[?]/.test(text)) {
    return { kind: "pick", value: text }
  }

  return { kind: "unknown" }
}

const HELP_TEXT = `Ücretsiz asistan — anlayabildiğim komutlar:

Fiyat
• Fren kategorisine %15 zam yap
• Bosch markasına %10 indirim

Kampanya
• Yeni kampanya: %10 indirim, 15 gün
• Kampanyaları listele
• Yaz kampanyasını kapat

Firma / sipariş
• Firmaları listele
• Otoparç firmasına %30 iskonto
• Onay bekleyen siparişler
• Bekleyen siparişleri onayla

Sistem
• Bakım modunu aç / kapat
• Fiyat güncelleme bildirimini 20.07.2026 için aç
• Sistem durumu
• İş özeti ver
• Düşük stok
• Ürün ara: balata
• Kategorileri / markaları listele

Belirsiz isimlerde seçenek butonları çıkar. Fiyat/kampanya/iskonto önce önizlenir → Onayla / İptal. Uygulanan işlemlerde Geri al butonu olur.`

type ChatResult = {
  reply: string
  actions: string[]
  pendingAction: PendingAction | null
  choices?: AssistantChoice[]
  undoAction?: PendingAction | null
  cards?: AssistantCard[]
}

function fromFormatted(formatted: FormattedResult, actions: string[]): ChatResult {
  return {
    reply: formatted.reply,
    actions,
    pendingAction: formatted.pending,
    choices: formatted.choices,
    undoAction: formatted.undoAction ?? null,
    cards: formatted.cards,
  }
}

async function handlePick(
  service: SupabaseClient,
  callerId: string,
  pending: PendingAction,
  value: string
): Promise<ChatResult | null> {
  if (pending.tool !== "_pick") return null
  const args = pending.args
  const options = (args.options as string[]) ?? []
  const optionIds = (args.optionIds as string[]) ?? []
  let chosen = value.trim()
  // "1) Name" or "1. Name" from button
  const numbered = chosen.match(/^(\d+)\s*[).:\-]?\s*(.*)$/)
  if (numbered) {
    const idx = Number(numbered[1])
    if (idx >= 1 && idx <= options.length) chosen = options[idx - 1]
    else if (numbered[2]) chosen = numbered[2]
  }
  const asNum = Number(chosen)
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= options.length) {
    chosen = options[asNum - 1]
  } else {
    const ranked = options
      .map((o) => ({ o, score: scoreMatch(chosen, o) }))
      .sort((a, b) => b.score - a.score)
    if (!ranked[0] || ranked[0].score < 40) {
      return {
        reply: `Bunu mu demek istediniz? Aşağıdan seçin:`,
        actions: [],
        pendingAction: pending,
        choices: pickChoices(options),
      }
    }
    chosen = ranked[0].o
  }

  const pickKind = String(args.pickKind)
  if (pickKind === "adjust_prices") {
    const result = await runAssistantTool(service, callerId, "adjust_prices", {
      filterType: args.filterType,
      filterValue: chosen,
      percent: args.percent,
      dryRun: true,
      resolved: true,
    })
    return fromFormatted(formatToolResult("adjust_prices", result), ["adjust_prices"])
  }
  if (pickKind === "company_discount") {
    const idx = options.indexOf(chosen)
    const result = await runAssistantTool(service, callerId, "set_company_discount", {
      companyQuery: chosen,
      discountRate: args.discountRate,
      resolvedId: optionIds[idx],
      dryRun: true,
    })
    return fromFormatted(formatToolResult("set_company_discount", result), ["set_company_discount"])
  }
  if (pickKind === "campaign_toggle") {
    const result = await runAssistantTool(service, callerId, "toggle_campaign", {
      query: chosen,
      isActive: args.isActive,
      dryRun: true,
    })
    return fromFormatted(formatToolResult("toggle_campaign", result), ["toggle_campaign"])
  }
  return null
}

export async function runAdminAssistantChat(opts: {
  service: SupabaseClient
  callerId: string
  messages: { role: "user" | "assistant"; content: string }[]
  pendingAction?: PendingAction | null
  undoAction?: PendingAction | null
}): Promise<ChatResult> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")
  if (!lastUser) {
    return { reply: HELP_TEXT, actions: [], pendingAction: opts.pendingAction ?? null }
  }

  // Undo last applied mutation
  if (isUndo(lastUser.content)) {
    if (!opts.undoAction) {
      return { reply: "Geri alınacak son işlem yok.", actions: [], pendingAction: null }
    }
    const result = await runAssistantTool(
      opts.service,
      opts.callerId,
      opts.undoAction.tool,
      opts.undoAction.args
    )
    const formatted = formatToolResult(opts.undoAction.tool, result)
    return {
      ...fromFormatted(formatted, [opts.undoAction.tool]),
      undoAction: null,
    }
  }

  const intent = parseIntent(lastUser.content)
  const actions: string[] = []

  if (intent.kind === "help") {
    return { reply: HELP_TEXT, actions, pendingAction: null }
  }

  if (intent.kind === "cancel") {
    return { reply: "Bekleyen işlem iptal edildi.", actions, pendingAction: null, choices: undefined, undoAction: opts.undoAction ?? null }
  }

  if (opts.pendingAction?.tool === "_pick") {
    const value = intent.kind === "pick" ? intent.value : lastUser.content
    const handled = await handlePick(opts.service, opts.callerId, opts.pendingAction, value)
    if (handled) return { ...handled, undoAction: handled.undoAction ?? opts.undoAction ?? null }
  }

  if (intent.kind === "confirm") {
    if (!opts.pendingAction || opts.pendingAction.tool === "_pick") {
      return {
        reply: "Onaylanacak işlem yok. Önce bir komut yazın.",
        actions,
        pendingAction: opts.pendingAction ?? null,
        undoAction: opts.undoAction ?? null,
      }
    }
    const result = await runAssistantTool(
      opts.service,
      opts.callerId,
      opts.pendingAction.tool,
      opts.pendingAction.args
    )
    actions.push(opts.pendingAction.tool)
    return fromFormatted(formatToolResult(opts.pendingAction.tool, result), actions)
  }

  if (intent.kind === "tool") {
    const result = await runAssistantTool(opts.service, opts.callerId, intent.tool, intent.args)
    actions.push(intent.tool)
    return fromFormatted(formatToolResult(intent.tool, result), actions)
  }

  return {
    reply: `Komutu tam anlayamadım. Aşağıdaki örneklerden birini deneyin veya “komutlar” yazın.\n\n${HELP_TEXT}`,
    actions,
    pendingAction: opts.pendingAction ?? null,
    undoAction: opts.undoAction ?? null,
  }
}
