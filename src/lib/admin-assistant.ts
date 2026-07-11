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

export const ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_categories",
      description: "Aktif ürün kategorilerini ve ürün sayılarını listeler",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_brands",
      description: "En çok ürünü olan markaları listeler",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "Ürün ara (ad, sku, marka, kategori)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "adjust_prices",
      description:
        "Kategori veya markaya göre fiyatları yüzde olarak artır/azalt. ÖNCE dry_run=true ile önizleme yap, kullanıcı onayladıktan sonra dry_run=false ile uygula.",
      parameters: {
        type: "object",
        properties: {
          filterType: { type: "string", enum: ["category", "brand"] },
          filterValue: { type: "string", description: "Kategori veya marka adı (tam eşleşme tercih edilir)" },
          percent: { type: "number", description: "Pozitif=zam, negatif=indirim. Örn: 15 veya -10" },
          dryRun: { type: "boolean", description: "true=önizleme, false=uygula. Varsayılan true." },
        },
        required: ["filterType", "filterValue", "percent"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_campaign",
      description:
        "Yeni indirim kampanyası oluştur. ÖNCE dry_run=true ile önizle, onaydan sonra dry_run=false.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          discountRate: { type: "number" },
          durationDays: { type: "number" },
          categories: { type: "array", items: { type: "string" } },
          brands: { type: "array", items: { type: "string" } },
          dryRun: { type: "boolean" },
        },
        required: ["name", "discountRate", "durationDays"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_campaigns",
      description: "Mevcut kampanyaları listeler",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_campaign_active",
      description: "Kampanyayı aç/kapat",
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          isActive: { type: "boolean" },
        },
        required: ["campaignId", "isActive"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_maintenance",
      description: "Mağaza bakım modunu aç/kapat",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_price_update_notice",
      description: "Firma ekranında fiyat güncelleme bildirimi bandını aç/kapat",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          date: { type: "string", description: "YYYY-MM-DD" },
          message: { type: "string" },
        },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_summary",
      description: "Ürün, firma, sipariş ve ciro özeti",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
]

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

export const SYSTEM_PROMPT = `Sen ROCKSWELL B2B otomotiv yedek parça platformunun admin asistanısın.
Türkçe konuş. Kısa, net ve aksiyon odaklı ol.

Yetkilerin:
- Kategori/marka bazlı fiyat zammı veya indirimi
- Kampanya oluşturma / aç-kapa
- Bakım modu ve fiyat güncelleme bildirimi
- Ürün arama, kategori/marka listesi, özet rapor

Kurallar:
1. Fiyat değişimi ve kampanya oluşturmada ÖNCE dry_run=true ile önizleme yap.
2. Önizlemeyi kullanıcıya özetle (kaç ürün, örnek fiyatlar) ve onay iste.
3. Kullanıcı "onayla", "uygula", "evet" derse dry_run=false ile uygula.
4. Kategori/marka adını bilmiyorsan önce list_categories / list_brands çağır.
5. Tehlikeli işlemlerde abartma; yüzde sınırlarını aşma.
6. Sonuçları Türkçe ve anlaşılır yaz.`

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export async function runAdminAssistantChat(opts: {
  service: SupabaseClient
  callerId: string
  messages: { role: "user" | "assistant"; content: string }[]
}): Promise<{ reply: string; actions: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      reply:
        "OpenAI API anahtarı tanımlı değil. Vercel/ortam değişkenlerine OPENAI_API_KEY ekleyin, sonra tekrar deneyin.",
      actions: [],
    }
  }

  const actions: string[] = []
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...opts.messages.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
  ]

  for (let step = 0; step < 6; step++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        tools: ASSISTANT_TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    })

    const json = (await res.json()) as {
      error?: { message?: string }
      choices?: Array<{
        message?: ChatMessage
        finish_reason?: string
      }>
    }

    if (!res.ok) {
      return {
        reply: json.error?.message ?? "OpenAI isteği başarısız oldu",
        actions,
      }
    }

    const msg = json.choices?.[0]?.message
    if (!msg) return { reply: "Yanıt alınamadı", actions }

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { reply: msg.content?.trim() || "Tamam.", actions }
    }

    messages.push({
      role: "assistant",
      content: msg.content,
      tool_calls: toolCalls,
    })

    for (const call of toolCalls) {
      let parsed: unknown = {}
      try {
        parsed = JSON.parse(call.function.arguments || "{}")
      } catch {
        parsed = {}
      }
      const result = await runAssistantTool(opts.service, opts.callerId, call.function.name, parsed)
      actions.push(call.function.name)
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    reply: "İşlem tamamlandı ama son özet üretilemedi. Lütfen sonucu panellerden kontrol edin.",
    actions,
  }
}
