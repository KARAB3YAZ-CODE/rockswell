import { supabase } from "./supabase"
import {
  buildDashboardStats,
  mapCampaign,
  mapCompany,
  mapInvoice,
  mapNotification,
  mapOrder,
  mapProduct,
  mapUser,
  mapWarehouse,
} from "./mappers"
import { DEFAULT_DISCOUNT_RATE, resolveDiscountRate, toOrderPricingFromLines, type VolumeDiscountTier } from "./pricing"
import { createInvoiceForOrder } from "./invoices"
import { applyStockMovement, assertStockAvailable, orderItemsToStockLines, syncWarehouseUsedCapacity } from "./inventory"
import { assertCreditAllowsOrder, assertOpenAccountPeriodClear, getCompanyCreditSnapshot, OPEN_ACCOUNT_METHOD } from "./credit"
import { decodeVin, looksLikeVin } from "./vin"
import { canPlaceOrder } from "./permissions"
import type {
  Product, Order, Company, User, Warehouse,
  Campaign, Notification, DashboardStats, Address, Invoice,
} from "./types"

function err(msg: string): never {
  throw new Error(msg)
}

async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!session) err("Oturum bulunamadı. Lütfen giriş yapın.")
  return session
}

/** App-layer admin gate (defense in depth alongside RLS). */
async function requireAdminUser(): Promise<User> {
  const user = await getCurrentUser()
  if (user.role !== "admin") err("Bu işlem için yönetici olmalısınız")
  return user
}

/** Calls an admin API route with the caller's access token attached. */
async function authedFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(init.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) err((json as { error?: string }).error ?? "İşlem başarısız")
  return json as T
}

export async function askAdminAssistant(
  messages: { role: "user" | "assistant"; content: string }[],
  pendingAction?: { tool: string; args: Record<string, unknown> } | null,
  undoAction?: { tool: string; args: Record<string, unknown> } | null
): Promise<{
  reply: string
  actions: string[]
  pendingAction: { tool: string; args: Record<string, unknown> } | null
  choices?: { id: string; label: string }[]
  undoAction?: { tool: string; args: Record<string, unknown> } | null
  cards?: {
    type: "product"
    id?: string
    title: string
    subtitle?: string
    image?: string
    sku?: string
    price?: number
    stock?: number
    badges?: { label: string; tone?: "warning" | "danger" | "accent" | "muted" | "success" }[]
  }[]
}> {
  return authedFetch("/api/admin/assistant", {
    method: "POST",
    body: JSON.stringify({
      messages,
      pendingAction: pendingAction ?? null,
      undoAction: undoAction ?? null,
    }),
  })
}

async function fetchProfile(userId: string, email: string): Promise<User> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (error || !data) err("Profil bulunamadı.")
  return mapUser(data, email)
}

async function fetchCompany(companyId: string): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single()

  if (error || !data) err("Şirket bilgisi bulunamadı.")
  return mapCompany(data)
}

// ─── Auth ───────────────────────────────────────────────────────────────────

let _currentUser: User | null = null
let _currentCompany: Company | null = null

export async function getCurrentUser(): Promise<User> {
  if (_currentUser) return _currentUser
  const session = await requireAuth()
  _currentUser = await fetchProfile(session.user.id, session.user.email ?? "")
  return _currentUser
}

export async function getCurrentCompany(): Promise<Company> {
  if (_currentCompany) return _currentCompany
  const user = await getCurrentUser()
  if (!user.companyId) {
    if (user.role === "admin") {
      _currentCompany = {
        id: "admin",
        name: "ROCKSWELL Yönetim",
        taxNumber: "",
        taxOffice: "Merkez",
        address: {
          street: "",
          city: "İstanbul",
          district: "",
          country: "Türkiye",
          zipCode: "",
        },
        phone: "",
        email: user.email,
        discountRate: DEFAULT_DISCOUNT_RATE,
        creditLimit: 0,
        isActive: true,
        users: [user],
      }
      return _currentCompany
    }
    err("Şirket bilgisi bulunamadı.")
  }
  _currentCompany = await fetchCompany(user.companyId)
  _currentCompany.users = [user]
  return _currentCompany
}

/** Returns the logged-in user's company discount rate (percentage), always fresh from DB. */
export async function getCustomerDiscountRate(): Promise<number> {
  try {
    const user = await getCurrentUser()
    if (!user.companyId) return DEFAULT_DISCOUNT_RATE
    const { data } = await supabase
      .from("companies")
      .select("discount_rate")
      .eq("id", user.companyId)
      .single()
    return resolveDiscountRate(data?.discount_rate != null ? Number(data.discount_rate) : DEFAULT_DISCOUNT_RATE)
  } catch {
    return DEFAULT_DISCOUNT_RATE
  }
}

async function assertAccountAllowed(user: User): Promise<Company | null> {
  if (!user.isActive) {
    await supabase.auth.signOut()
    err("Hesabınız pasife alınmış. Destek ile iletişime geçin.")
  }
  if (!user.companyId) {
    if (user.role === "admin") return null
    await supabase.auth.signOut()
    err("Şirket bilgisi bulunamadı.")
  }
  const company = await fetchCompany(user.companyId)
  if (!company.isActive && user.role !== "admin") {
    await supabase.auth.signOut()
    err("Firma başvurunuz henüz onaylanmadı. Onay sonrası giriş yapabilirsiniz.")
  }
  return company
}

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) err("E-posta veya şifre hatalı")

  const user = await fetchProfile(data.user.id, data.user.email ?? "")
  const company = await assertAccountAllowed(user)

  await supabase
    .from("profiles")
    .update({ last_login: new Date().toISOString() })
    .eq("id", user.id)

  user.lastLogin = new Date()
  _currentUser = user

  if (company) {
    _currentCompany = company
    _currentCompany.users = [user]
  }

  return user
}

export async function register(data: {
  email: string
  password: string
  name: string
  surname: string
  companyName: string
  taxNumber: string
  phone: string
}): Promise<User> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  const body = await res.json()
  if (!res.ok) err(body.error ?? "Kayıt başarısız")
  return body.user as User
}

export async function restoreSession(user: User, company: Company): Promise<void> {
  _currentUser = user
  _currentCompany = company
}

export async function initSessionFromSupabase(): Promise<{ user: User; company: Company } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const user = await fetchProfile(session.user.id, session.user.email ?? "")
  try {
    const allowedCompany = await assertAccountAllowed(user)
    _currentUser = user
    _currentCompany = null
    if (allowedCompany) {
      _currentCompany = allowedCompany
      _currentCompany.users = [user]
      return { user, company: allowedCompany }
    }
    const company = await getCurrentCompany()
    return { user, company }
  } catch {
    _currentUser = null
    _currentCompany = null
    return null
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  _currentUser = null
  _currentCompany = null
}

export interface UpdateProfileInput {
  name: string
  surname: string
  phone: string
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const user = await getCurrentUser()
  const { data, error } = await supabase
    .from("profiles")
    .update({ name: input.name, surname: input.surname, phone: input.phone })
    .eq("id", user.id)
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Profil güncellenemedi")
  const updated = mapUser(data, user.email)
  _currentUser = updated
  return updated
}

export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) err("Şifre en az 6 karakter olmalıdır")
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) err(error.message)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim()
  if (!trimmed) err("E-posta gerekli")
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo,
  })
  if (error) err(error.message)
}

export async function createSupportTicket(input: {
  subject: string
  category: string
  message: string
}): Promise<void> {
  const user = await getCurrentUser()
  const subject = input.subject.trim()
  const message = input.message.trim()
  if (!subject || !message) err("Konu ve mesaj gerekli")
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    company_id: user.companyId || null,
    subject,
    category: input.category || "genel",
    message,
    status: "open",
  })
  if (error) err(error.message)
}

export interface SupportTicket {
  id: string
  subject: string
  category: string
  message: string
  status: string
  createdAt: string
}

export async function getMySupportTickets(): Promise<SupportTicket[]> {
  const user = await getCurrentUser()
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, category, message, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) err(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    subject: String(row.subject),
    category: String(row.category ?? "genel"),
    message: String(row.message),
    status: String(row.status ?? "open"),
    createdAt: String(row.created_at),
  }))
}

export interface AdminSupportTicket extends SupportTicket {
  userId: string
  companyId?: string
  companyName?: string
  userEmail?: string
}

export async function getAllSupportTickets(): Promise<AdminSupportTicket[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, category, message, status, created_at, user_id, company_id")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) err(error.message)

  const companyIds = [...new Set((data ?? []).map((r) => r.company_id).filter(Boolean))] as string[]
  const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[]

  const [{ data: companies }, { data: profiles }] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    userIds.length
      ? supabase.from("profiles").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
  ])

  const companyMap = new Map((companies ?? []).map((c) => [String(c.id), String(c.name)]))
  const emailMap = new Map((profiles ?? []).map((p) => [String(p.id), String(p.email)]))

  return (data ?? []).map((row) => ({
    id: String(row.id),
    subject: String(row.subject),
    category: String(row.category ?? "genel"),
    message: String(row.message),
    status: String(row.status ?? "open"),
    createdAt: String(row.created_at),
    userId: String(row.user_id),
    companyId: row.company_id ? String(row.company_id) : undefined,
    companyName: row.company_id ? companyMap.get(String(row.company_id)) : undefined,
    userEmail: emailMap.get(String(row.user_id)),
  }))
}

export async function updateSupportTicketStatus(
  id: string,
  status: "open" | "in_progress" | "closed"
): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id)
  if (error) err(error.message)
}

// ─── Products ───────────────────────────────────────────────────────────────

/**
 * Applies company contract prices from customer_prices.
 * Overrides basePrice with net/dealer/campaign/contract price when a row exists.
 */
async function applyCustomerPrices(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products
  let companyId: string | undefined
  try {
    const user = await getCurrentUser()
    companyId = user.companyId || undefined
  } catch {
    return products
  }
  if (!companyId) return products

  const { data } = await supabase
    .from("customer_prices")
    .select("product_id, net_price, dealer_price, campaign_price, contract_price")
    .eq("company_id", companyId)

  if (!data?.length) return products

  const map = new Map(data.map((row) => [row.product_id as string, row]))
  return products.map((p) => {
    const cp = map.get(p.id)
    if (!cp) return p
    const price = cp.net_price ?? cp.contract_price ?? cp.campaign_price ?? cp.dealer_price
    return price != null
      ? { ...p, basePrice: Number(price), customerPriceApplied: true }
      : p
  })
}

export async function getProducts(): Promise<Product[]> {
  await requireAuth()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) err(error.message)
  return applyCustomerPrices((data ?? []).map(mapProduct))
}

/** Admin catalog: active + inactive, no customer price overlay. */
export async function getAllProductsAdmin(): Promise<Product[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name")
  if (error) err(error.message)
  return (data ?? []).map(mapProduct)
}

export async function bulkSetProductActive(ids: string[], isActive: boolean): Promise<number> {
  await requireAdminUser()
  if (!ids.length) return 0
  const { error, count } = await supabase
    .from("products")
    .update({ is_active: isActive }, { count: "exact" })
    .in("id", ids)
  if (error) err(error.message)
  return count ?? ids.length
}

export async function bulkDeleteProducts(ids: string[]): Promise<number> {
  await requireAdminUser()
  if (!ids.length) return 0
  const { error, count } = await supabase
    .from("products")
    .delete({ count: "exact" })
    .in("id", ids)
  if (error) err(error.message)
  try {
    await syncWarehouseUsedCapacity(supabase)
  } catch {
    /* best-effort */
  }
  return count ?? ids.length
}

export async function bulkAdjustProductPrices(ids: string[], percent: number): Promise<number> {
  await requireAdminUser()
  if (!ids.length) return 0
  if (!Number.isFinite(percent) || percent === 0) err("Geçerli bir yüzde girin")
  if (Math.abs(percent) > 100) err("Yüzde en fazla ±100 olabilir")

  const { data, error } = await supabase
    .from("products")
    .select("id, base_price")
    .in("id", ids)
  if (error) err(error.message)

  const factor = 1 + percent / 100
  let updated = 0
  const rows = data ?? []
  const chunkSize = 40
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (row) => {
        const next = Math.round(Number(row.base_price) * factor * 100) / 100
        const { error: upErr } = await supabase
          .from("products")
          .update({ base_price: next })
          .eq("id", row.id)
        if (!upErr) updated += 1
      })
    )
  }
  return updated
}

export async function getProductById(id: string): Promise<Product> {
  await requireAuth()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) err(`Ürün bulunamadı: ${id}`)
  const [product] = await applyCustomerPrices([mapProduct(data)])
  return product
}

export async function searchProducts(query: string): Promise<Product[]> {
  await requireAuth()
  const q = query.trim()
  if (!q) return getProducts()

  const products = await getProducts()
  const ql = q.toLocaleLowerCase("tr")

  if (looksLikeVin(q)) {
    const decoded = decodeVin(q)
    const make = decoded?.make?.toLocaleLowerCase("tr")
    const year = decoded?.year
    const matched = products.filter((p) =>
      p.compatibleVehicles.some((v) => {
        const brandOk = make
          ? v.brand.toLocaleLowerCase("tr").includes(make) || make.includes(v.brand.toLocaleLowerCase("tr"))
          : true
        if (!brandOk) return false
        if (!year) return true
        const start = v.yearStart || 0
        const end = v.yearEnd || 9999
        return year >= start && year <= end
      })
    )
    if (matched.length) return matched.slice(0, 100)
    // Unknown WMI: fall through to text search on the raw VIN string
  }

  return products
    .filter((p) => {
      if (p.name.toLocaleLowerCase("tr").includes(ql)) return true
      if (p.sku.toLocaleLowerCase("tr").includes(ql)) return true
      if (p.brand.toLocaleLowerCase("tr").includes(ql)) return true
      if (p.category.toLocaleLowerCase("tr").includes(ql)) return true
      if (p.oemNumbers.some((o) => o.toLocaleLowerCase("tr").includes(ql))) return true
      if (
        p.compatibleVehicles.some(
          (v) =>
            v.brand.toLocaleLowerCase("tr").includes(ql) ||
            v.model.toLocaleLowerCase("tr").includes(ql)
        )
      )
        return true
      return false
    })
    .slice(0, 100)
}

export async function getProductsByBrand(brand: string): Promise<Product[]> {
  await requireAuth()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("brand", brand)
    .order("name")

  if (error) err(error.message)
  return (data ?? []).map(mapProduct)
}

export async function getProductsByVehicleBrand(brand: string): Promise<Product[]> {
  const products = await getProducts()
  return products.filter((p) => p.compatibleVehicles.some((v) => v.brand === brand))
}

export async function getRelatedProducts(productId: string): Promise<Product[]> {
  const product = await getProductById(productId)
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("category", product.category)
    .neq("id", productId)
    .limit(4)

  if (error) err(error.message)
  return (data ?? []).map(mapProduct)
}

// ─── Brands & Categories ────────────────────────────────────────────────────

export interface BrandSummary {
  brand: string
  productCount: number
  categories: string[]
}

export async function getVehicleBrands(): Promise<string[]> {
  const products = await getProducts()
  const brands = new Set<string>()
  for (const p of products) {
    for (const v of p.compatibleVehicles) brands.add(v.brand)
  }
  return [...brands].sort()
}

export async function getProductBrands(): Promise<BrandSummary[]> {
  const products = await getProducts()
  const map = new Map<string, { count: number; cats: Set<string> }>()
  for (const p of products) {
    if (!map.has(p.brand)) map.set(p.brand, { count: 0, cats: new Set() })
    const entry = map.get(p.brand)!
    entry.count++
    entry.cats.add(p.category)
  }
  return [...map.entries()].map(([brand, v]) => ({
    brand,
    productCount: v.count,
    categories: [...v.cats].sort(),
  }))
}

export async function getCategories(): Promise<string[]> {
  const products = await getProducts()
  return [...new Set(products.map((p) => p.category))].sort()
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const products = await getProducts()
  const counts: Record<string, number> = {}
  for (const p of products) counts[p.category] = (counts[p.category] || 0) + 1
  return counts
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  const user = await getCurrentUser()
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false })

  if (user.role !== "admin" && user.companyId) {
    query = query.eq("company_id", user.companyId)
  }

  const { data, error } = await query
  if (error) err(error.message)
  return (data ?? []).map(mapOrder)
}

export async function getOrderById(id: string): Promise<Order> {
  await requireAuth()
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) err(`Sipariş bulunamadı: ${id}`)
  return mapOrder(data)
}

export type PaymentMethod = "havale" | "online" | "acik_hesap"

export interface CheckoutItem {
  productId: string
  productName: string
  sku: string
  brand: string
  quantity: number
  unitPrice: number
  warehouseId: string
}

export interface CreateOrderInput {
  items: CheckoutItem[]
  paymentMethod: PaymentMethod
  notes?: string
  asQuotation?: boolean
}

function generateOrderNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `SIP-${y}-${rand}`
}

/**
 * Creates an order. Bank transfer (havale) goes to approval flow;
 * online payment starts as draft and is confirmed after PayTR success.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const user = await getCurrentUser()
  const company = await getCurrentCompany()
  if (!user.companyId) err("Sipariş oluşturmak için bir şirkete bağlı olmalısınız.")
  if (!canPlaceOrder(user) && !input.asQuotation) {
    err("Sipariş oluşturma yetkiniz yok")
  }

  if (!input.items.length) err("Sepetiniz boş.")

  const discountRate = await getCustomerDiscountRate()
  const productIds = [...new Set(input.items.map((i) => i.productId))]
  const [{ data: productRows }, { data: priceRows }, campaigns, siteSettings] = await Promise.all([
    supabase
      .from("products")
      .select("id, category, brand, compatible_vehicles, stock, name")
      .in("id", productIds),
    user.companyId
      ? supabase
          .from("customer_prices")
          .select("product_id")
          .eq("company_id", user.companyId)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string }[] }),
    getCampaigns().catch(() => [] as Campaign[]),
    getSiteSettings().catch(() => null),
  ])

  const productMap = new Map(
    (productRows ?? []).map((row) => [
      String(row.id),
      {
        category: String(row.category ?? ""),
        brand: String(row.brand ?? ""),
        name: String(row.name ?? ""),
        stock: row.stock,
        vehicleBrands: ((row.compatible_vehicles as { brand?: string }[]) ?? [])
          .map((v) => String(v.brand ?? ""))
          .filter(Boolean),
      },
    ])
  )
  const lockedIds = new Set((priceRows ?? []).map((r) => String(r.product_id)))

  // Stock availability check (quotations do not reserve)
  if (!input.asQuotation) {
    for (const item of input.items) {
      const meta = productMap.get(item.productId)
      if (!meta) err(`Ürün bulunamadı: ${item.productName}`)
      assertStockAvailable(meta.stock, item.warehouseId, item.quantity, item.productName || meta.name)
    }
  }

  const orderItems: Order["items"] = input.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    brand: item.brand,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountRate: lockedIds.has(item.productId) ? 0 : discountRate,
    totalPrice: item.unitPrice * item.quantity,
    warehouseId: item.warehouseId,
    stockLocation: "",
  }))

  const pricingLines = input.items.map((item) => {
    const meta = productMap.get(item.productId)
    return {
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      priceLocked: lockedIds.has(item.productId),
      category: meta?.category,
      brand: meta?.brand ?? item.brand,
      vehicleBrands: meta?.vehicleBrands,
    }
  })
  const pricing = toOrderPricingFromLines(
    pricingLines,
    discountRate,
    input.paymentMethod,
    campaigns,
    siteSettings?.volumeDiscountTiers
  )

  const isOnline = input.paymentMethod === "online"
  const isOpenAccount = input.paymentMethod === OPEN_ACCOUNT_METHOD
  const needsApproval = !input.asQuotation && !isOnline // havale + açık hesap

  // Açık hesap: dönem borcu (ayın 15'i) + kredi limiti. Havale/EFT kredi kullanmaz.
  if (!input.asQuotation && isOpenAccount && user.companyId) {
    const snap = await getCompanyCreditSnapshot(user.companyId)
    assertOpenAccountPeriodClear(snap)
    assertCreditAllowsOrder(snap, Number(pricing.grandTotal ?? 0))
  }

  const nowIso = new Date().toISOString()
  let status: Order["status"] = input.asQuotation
    ? "quotation"
    : isOnline
      ? "draft"
      : "pending_approval"

  let approvalFlow: Order["approvalFlow"] = []
  if (needsApproval) {
    const dealerStep: Order["approvalFlow"][number] = {
      id: "dealer",
      role: "company_admin",
      status: "pending",
      createdAt: new Date(nowIso),
    }
    const adminStep: Order["approvalFlow"][number] = {
      id: "rockswell",
      role: "admin",
      status: "pending",
      createdAt: new Date(nowIso),
    }
    if (user.role === "company_admin") {
      dealerStep.status = "approved"
      dealerStep.userId = user.id
      dealerStep.updatedAt = new Date(nowIso)
      dealerStep.comment = "Siparişi açan firma yöneticisi — otomatik onay"
      status = "approved"
    }
    approvalFlow = [dealerStep, adminStep]
  }

  const payment = {
    method: input.paymentMethod,
    status: "pending" as const,
  }

  const shipping = {
    address: company.address,
    method: "standard",
    carrier: "",
    status: "pending",
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      company_id: user.companyId,
      user_id: user.id,
      status,
      items: orderItems,
      pricing,
      shipping,
      payment,
      notes: input.notes ?? "",
      approval_flow: approvalFlow.map((s) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
      })),
    })
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Sipariş oluşturulamadı")

  if (!input.asQuotation) {
    try {
      await applyStockMovement(supabase, orderItemsToStockLines(orderItems), "reserve")
    } catch (stockErr) {
      await supabase.from("orders").delete().eq("id", data.id)
      err(stockErr instanceof Error ? stockErr.message : "Stok rezerve edilemedi")
    }
  }

  const mapped = mapOrder(data)
  try {
    await createNotification({
      userId: user.id,
      type: "success",
      title: input.asQuotation ? "Teklif talebi oluşturuldu" : isOnline ? "Ödeme bekleniyor" : "Sipariş onaya gönderildi",
      message: `${mapped.orderNumber} · ${mapped.pricing.grandTotal.toLocaleString("tr-TR")} ₺`,
      link: isOnline ? `/payment/${mapped.id}` : `/orders/${mapped.id}`,
    })
  } catch {
    /* best-effort */
  }

  return mapped
}

function normalizeApprovalFlow(raw: unknown): Order["approvalFlow"] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => {
    const step = s as Record<string, unknown>
    return {
      id: String(step.id ?? ""),
      role: step.role as Order["approvalFlow"][number]["role"],
      userId: step.userId ? String(step.userId) : undefined,
      status: (step.status as "pending" | "approved" | "rejected") ?? "pending",
      comment: step.comment ? String(step.comment) : undefined,
      createdAt: new Date(String(step.createdAt ?? Date.now())),
      updatedAt: step.updatedAt ? new Date(String(step.updatedAt)) : undefined,
    }
  })
}

/** Company admin approves a pending open-account order → status approved (Rockswell next). */
export async function approveMyCompanyOrder(orderId: string, comment?: string): Promise<Order> {
  const user = await getCurrentUser()
  if (user.role !== "company_admin" && user.role !== "admin") {
    err("Bu siparişi onaylama yetkiniz yok")
  }
  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")
  if (user.role !== "admin" && String(existing.company_id) !== user.companyId) {
    err("Bu sipariş firmanıza ait değil")
  }
  if (String(existing.status) !== "pending_approval") {
    err("Sipariş bayi onayı beklemiyor")
  }

  const now = new Date()
  const flow = normalizeApprovalFlow(existing.approval_flow).map((step) =>
    step.role === "company_admin"
      ? {
          ...step,
          status: "approved" as const,
          userId: user.id,
          comment: comment || step.comment,
          updatedAt: now,
        }
      : step
  )

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "approved",
      approval_flow: flow.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt?.toISOString(),
      })),
    })
    .eq("id", orderId)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Onaylanamadı")
  return mapOrder(data)
}

export async function rejectMyCompanyOrder(orderId: string, comment?: string): Promise<Order> {
  const user = await getCurrentUser()
  if (user.role !== "company_admin" && user.role !== "admin") {
    err("Bu siparişi reddetme yetkiniz yok")
  }
  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")
  if (user.role !== "admin" && String(existing.company_id) !== user.companyId) {
    err("Bu sipariş firmanıza ait değil")
  }
  if (String(existing.status) !== "pending_approval") {
    err("Sipariş bayi onayı beklemiyor")
  }

  const now = new Date()
  const flow = normalizeApprovalFlow(existing.approval_flow).map((step) =>
    step.role === "company_admin"
      ? {
          ...step,
          status: "rejected" as const,
          userId: user.id,
          comment: comment || "Reddedildi",
          updatedAt: now,
        }
      : step
  )

  const lines = orderItemsToStockLines(
    (Array.isArray(existing.items) ? existing.items : []) as Array<{
      productId: string
      warehouseId: string
      quantity: number
      productName?: string
    }>
  )

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      approval_flow: flow.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt?.toISOString(),
      })),
    })
    .eq("id", orderId)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Reddedilemedi")

  try {
    await applyStockMovement(supabase, lines, "release")
  } catch {
    /* best-effort */
  }

  return mapOrder(data)
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  await requireAdminUser()
  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")

  const prev = String(existing.status)
  const flow = normalizeApprovalFlow(existing.approval_flow)
  const dealerPending = flow.some((s) => s.role === "company_admin" && s.status === "pending")
  if (
    dealerPending &&
    prev === "pending_approval" &&
    ["confirmed", "processing", "shipped", "delivered", "approved"].includes(status)
  ) {
    err("Önce bayi (firma yöneticisi) onayı gerekli")
  }

  const now = new Date()
  let nextFlow = flow
  if (["confirmed", "processing"].includes(status) && ["approved", "pending_approval", "quotation"].includes(prev)) {
    nextFlow = flow.map((step) =>
      step.role === "admin"
        ? { ...step, status: "approved" as const, updatedAt: now }
        : step
    )
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      approval_flow: nextFlow.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt?.toISOString(),
      })),
    })
    .eq("id", id)
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Sipariş güncellenemedi")

  const lines = orderItemsToStockLines(
    (Array.isArray(data.items) ? data.items : []) as Array<{
      productId: string
      warehouseId: string
      quantity: number
      productName?: string
    }>
  )

  try {
    if (
      ["confirmed", "processing", "shipped", "delivered"].includes(status) &&
      ["draft", "pending_approval", "approved", "quotation"].includes(prev)
    ) {
      await applyStockMovement(supabase, lines, "commit")
    } else if (status === "cancelled" && !["cancelled", "returned"].includes(prev)) {
      if (["draft", "pending_approval", "approved"].includes(prev)) {
        await applyStockMovement(supabase, lines, "release")
      } else if (["confirmed", "processing", "shipped", "delivered"].includes(prev)) {
        const items = (Array.isArray(data.items) ? data.items : []) as Array<{
          productId: string
          warehouseId: string
          quantity: number
          returnedQuantity?: number
          productName?: string
        }>
        const remaining = items
          .map((i) => ({
            productId: i.productId,
            warehouseId: i.warehouseId,
            quantity: Math.max(0, Number(i.quantity) - Number(i.returnedQuantity ?? 0)),
            productName: i.productName,
          }))
          .filter((i) => i.quantity > 0)
        if (remaining.length) {
          await applyStockMovement(supabase, orderItemsToStockLines(remaining), "restock")
        }
      }
    } else if (status === "returned" && prev !== "returned") {
      const items = (Array.isArray(data.items) ? data.items : []) as Array<{
        productId: string
        warehouseId: string
        quantity: number
        returnedQuantity?: number
        productName?: string
      }>
      const remaining = items
        .map((i) => ({
          productId: i.productId,
          warehouseId: i.warehouseId,
          quantity: Math.max(0, Number(i.quantity) - Number(i.returnedQuantity ?? 0)),
          productName: i.productName,
        }))
        .filter((i) => i.quantity > 0)
      if (remaining.length) {
        const restockedItems = items.map((i) => ({
          ...i,
          returnedQuantity: Number(i.quantity),
        }))
        await supabase.from("orders").update({ items: restockedItems }).eq("id", id)
        await applyStockMovement(supabase, orderItemsToStockLines(remaining), "restock")
      }
    }
  } catch {
    /* stock best-effort after status write */
  }

  if (["confirmed", "processing", "shipped", "delivered"].includes(status)) {
    try {
      await createInvoiceForOrder(supabase, data)
    } catch {
      /* invoice generation is best-effort */
    }
  }

  const mapped = mapOrder(data)
  const label = status === "confirmed" ? "Siparişiniz onaylandı"
    : status === "processing" ? "Siparişiniz hazırlanıyor"
    : status === "shipped" ? "Siparişiniz kargoya verildi"
    : status === "delivered" ? "Siparişiniz teslim edildi"
    : status === "cancelled" ? "Siparişiniz iptal edildi"
    : status === "returned" ? "İade kaydı oluşturuldu"
    : `Sipariş durumu: ${status}`

  try {
    await notifyOrderUser(String(data.user_id ?? ""), {
      type: status === "cancelled" ? "warning" : "success",
      title: label,
      message: `${mapped.orderNumber}`,
      link: `/orders/${mapped.id}`,
      orderId: mapped.id,
    })
  } catch {
    /* best-effort */
  }

  return mapped
}

export async function updateOrderShipping(
  id: string,
  input: { carrier: string; trackingNumber: string }
): Promise<Order> {
  await requireAdminUser()
  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")

  const prevShipping = (existing.shipping ?? {}) as Record<string, unknown>
  const shipping = {
    ...prevShipping,
    carrier: input.carrier.trim(),
    trackingNumber: input.trackingNumber.trim(),
    status: input.trackingNumber.trim() ? "shipped" : (prevShipping.status ?? "pending"),
  }

  const patch: Record<string, unknown> = { shipping }
  if (input.trackingNumber.trim() && ["confirmed", "processing", "approved"].includes(String(existing.status))) {
    patch.status = "shipped"
  }

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Kargo bilgisi güncellenemedi")

  const mapped = mapOrder(data)
  if (input.trackingNumber.trim()) {
    try {
      await notifyOrderUser(String(data.user_id ?? ""), {
        type: "info",
        title: "Kargo takip numarası",
        message: `${mapped.orderNumber} · ${input.carrier || "Kargo"} ${input.trackingNumber}`,
        link: `/orders/${mapped.id}`,
        orderId: mapped.id,
      })
    } catch {
      /* best-effort */
    }
  }
  return mapped
}

/** Dealer/admin partial or full return for a delivered order. */
export async function requestOrderReturn(
  id: string,
  reason: string,
  lines: Array<{ productId: string; quantity: number }>
): Promise<Order> {
  const user = await getCurrentUser()
  const note = reason.trim()
  if (!note) err("İade nedeni gerekli")
  if (!lines.length) err("İade edilecek ürün seçin")

  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")
  if (user.role !== "admin" && existing.user_id !== user.id && existing.company_id !== user.companyId) {
    err("Bu siparişe erişiminiz yok")
  }
  if (!["delivered", "returned"].includes(String(existing.status))) {
    err("Yalnızca teslim edilmiş siparişler iade edilebilir")
  }

  const items = (Array.isArray(existing.items) ? existing.items : []) as Array<{
    productId: string
    productName: string
    sku: string
    brand: string
    quantity: number
    returnedQuantity?: number
    warehouseId: string
    unitPrice: number
    discountRate: number
    totalPrice: number
    stockLocation: string
  }>

  const returnLines: Array<{
    productId: string
    productName: string
    sku: string
    brand: string
    quantity: number
    warehouseId: string
  }> = []

  const nextItems = items.map((item) => {
    const req = lines.find((l) => l.productId === item.productId)
    if (!req || req.quantity <= 0) return { ...item, returnedQuantity: Number(item.returnedQuantity ?? 0) }
    const already = Number(item.returnedQuantity ?? 0)
    const maxReturnable = Math.max(0, Number(item.quantity) - already)
    const qty = Math.min(Math.floor(req.quantity), maxReturnable)
    if (qty <= 0) return { ...item, returnedQuantity: already }
    returnLines.push({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      brand: item.brand,
      quantity: qty,
      warehouseId: item.warehouseId,
    })
    return { ...item, returnedQuantity: already + qty }
  })

  if (!returnLines.length) err("Seçilen ürünlerde iade edilebilir adet kalmadı")

  const prevReturns = Array.isArray(existing.returns) ? existing.returns : []
  const newReturn = {
    id: crypto.randomUUID(),
    reason: note,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    items: returnLines,
  }

  const allReturned = nextItems.every(
    (i) => Number(i.returnedQuantity ?? 0) >= Number(i.quantity)
  )
  const summary = returnLines.map((l) => `${l.productName} × ${l.quantity}`).join(", ")
  const notes = [String(existing.notes ?? "").trim(), `İade: ${summary} — ${note}`]
    .filter(Boolean)
    .join("\n")

  const patch: Record<string, unknown> = {
    items: nextItems,
    returns: [...prevReturns, newReturn],
    notes,
  }
  if (allReturned) patch.status = "returned"

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "İade talebi oluşturulamadı")

  try {
    await applyStockMovement(supabase, orderItemsToStockLines(returnLines), "restock")
  } catch {
    /* best-effort */
  }

  return mapOrder(data)
}

export async function bulkUpdateOrderStatus(
  ids: string[],
  status: Order["status"]
): Promise<number> {
  await requireAdminUser()
  let n = 0
  for (const id of ids) {
    await updateOrderStatus(id, status)
    n += 1
  }
  return n
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const user = await getCurrentUser()
  const orders = await getOrders()

  let creditLimit = 0
  let openInvoicesAmount = 0
  let openInvoicesCount = 0
  let creditUsed = 0

  if (user.companyId) {
    const snap = await getCompanyCreditSnapshot(user.companyId)
    creditLimit = snap.creditLimit
    creditUsed = snap.creditUsed
    openInvoicesAmount = snap.openInvoicesAmount

    const { count } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("company_id", user.companyId)
      .in("status", ["sent", "overdue"])
    openInvoicesCount = count ?? 0
  }

  const stats = buildDashboardStats(orders, creditLimit, creditUsed, openInvoicesCount)
  // Prefer full exposure (invoices + pending open-account) for used/balance
  return {
    ...stats,
    currentBalance: creditUsed,
    creditUsed,
    openInvoicesAmount,
  }
}

export async function getMyCreditSnapshot() {
  const user = await getCurrentUser()
  if (!user.companyId) {
    return {
      creditLimit: 0,
      creditUsed: 0,
      creditRemaining: 0,
      openInvoicesAmount: 0,
      pendingOrdersAmount: 0,
      openAccountBlocked: false,
      openAccountBlockReason: null,
      unpaidPastDueCount: 0,
      unpaidPastDueAmount: 0,
    }
  }
  return getCompanyCreditSnapshot(user.companyId)
}

export interface CreditLedgerEntry {
  id: string
  kind: "invoice_open" | "invoice_paid" | "order_pending"
  label: string
  amount: number
  date: string
  link?: string
  status: string
}

/** Simple open-account ledger: open invoices + pending havale + recent paid. */
export async function getMyCreditLedger(): Promise<{
  snapshot: Awaited<ReturnType<typeof getCompanyCreditSnapshot>>
  entries: CreditLedgerEntry[]
}> {
  const user = await getCurrentUser()
  if (!user.companyId) {
    return {
      snapshot: {
        creditLimit: 0,
        creditUsed: 0,
        creditRemaining: 0,
        openInvoicesAmount: 0,
        pendingOrdersAmount: 0,
        openAccountBlocked: false,
        openAccountBlockReason: null,
        unpaidPastDueCount: 0,
        unpaidPastDueAmount: 0,
      },
      entries: [],
    }
  }

  const snapshot = await getCompanyCreditSnapshot(user.companyId)
  const [{ data: invoices }, { data: pending }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, grand_total, status, created_at, paid_date, order_id")
      .eq("company_id", user.companyId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("orders")
      .select("id, order_number, pricing, payment, status, created_at")
      .eq("company_id", user.companyId)
      .in("status", ["pending_approval", "approved"])
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const entries: CreditLedgerEntry[] = []

  for (const inv of invoices ?? []) {
    const status = String(inv.status)
    const amount = Number(inv.grand_total ?? 0)
    if (["sent", "overdue"].includes(status)) {
      entries.push({
        id: `inv-${inv.id}`,
        kind: "invoice_open",
        label: String(inv.invoice_number),
        amount,
        date: String(inv.created_at),
        link: `/account/invoices/${inv.id}`,
        status,
      })
    } else if (status === "paid") {
      entries.push({
        id: `inv-paid-${inv.id}`,
        kind: "invoice_paid",
        label: `${inv.invoice_number} (ödendi)`,
        amount: -amount,
        date: String(inv.paid_date ?? inv.created_at),
        link: `/account/invoices/${inv.id}`,
        status,
      })
    }
  }

  for (const row of pending ?? []) {
    const payment = (row.payment ?? {}) as { method?: string; status?: string }
    if (payment.method !== OPEN_ACCOUNT_METHOD || payment.status === "paid") continue
    entries.push({
      id: `ord-${row.id}`,
      kind: "order_pending",
      label: `${row.order_number} (açık hesap · onay bekliyor)`,
      amount: Number((row.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0),
      date: String(row.created_at),
      link: `/orders/${row.id}`,
      status: String(row.status),
    })
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return { snapshot, entries: entries.slice(0, 50) }
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  await requireAuth()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now)
    .order("start_date", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map(mapCampaign)
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("start_date", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map(mapCampaign)
}

export interface CreateCampaignInput {
  name: string
  description: string
  type: Campaign["type"]
  discountRate: number
  startDate: string
  endDate: string
  categories?: string[]
  brands?: string[]
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: input.name,
      description: input.description,
      type: input.type,
      discount_rate: input.discountRate,
      conditions: [],
      products: [],
      brands: input.brands ?? [],
      categories: input.categories ?? [],
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: true,
    })
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Kampanya oluşturulamadı")
  return mapCampaign(data)
}

export async function setCampaignActive(id: string, isActive: boolean): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("campaigns").update({ is_active: isActive }).eq("id", id)
  if (error) err(error.message)
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  const user = await getCurrentUser()
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) err(error.message)
  return (data ?? []).map(mapNotification)
}

export async function markNotificationRead(id: string): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  if (error) err(error.message)
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser()
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
  if (error) err(error.message)
}

export async function createNotification(input: {
  userId: string
  type?: Notification["type"]
  title: string
  message: string
  link?: string
  /** When set, also try to email the order owner */
  orderId?: string
}): Promise<void> {
  try {
    await authedFetch("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        userId: input.userId,
        type: input.type ?? "info",
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      }),
    })
  } catch (e) {
    console.warn("notification insert failed", e instanceof Error ? e.message : e)
  }

  if (input.orderId) {
    try {
      await authedFetch("/api/email/order", {
        method: "POST",
        body: JSON.stringify({
          orderId: input.orderId,
          title: input.title,
          message: input.message,
          link: input.link,
        }),
      })
    } catch {
      /* email optional */
    }
  }
}

async function notifyOrderUser(
  orderUserId: string | null | undefined,
  input: {
    type?: Notification["type"]
    title: string
    message: string
    link?: string
    orderId?: string
  }
) {
  if (!orderUserId) return
  await createNotification({ userId: orderUserId, ...input })
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number
  companies: number
  orders: number
  revenue: number
  activeProducts: number
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdminUser()
  const [users, companies, orders, products, revenueRows] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("orders").select("pricing").in("status", ["confirmed", "processing", "shipped", "delivered"]),
  ])

  const revenue = (revenueRows.data ?? []).reduce(
    (sum, row: { pricing?: { grandTotal?: number } }) => sum + Number(row.pricing?.grandTotal ?? 0),
    0
  )

  return {
    users: users.count ?? 0,
    companies: companies.count ?? 0,
    orders: orders.count ?? 0,
    revenue,
    activeProducts: products.count ?? 0,
  }
}

export interface AdminUserRow {
  id: string
  name: string
  surname: string
  role: string
  phone: string
  isActive: boolean
  companyId: string | null
  companyName: string
}

export async function getAllUsers(): Promise<AdminUserRow[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, surname, role, phone, is_active, company_id, companies(name)")
    .order("created_at", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    surname: String(row.surname ?? ""),
    role: String(row.role ?? ""),
    phone: String(row.phone ?? ""),
    isActive: Boolean(row.is_active),
    companyId: row.company_id ? String(row.company_id) : null,
    companyName:
      (row.companies as { name?: string } | null)?.name ?? "—",
  }))
}

export async function bulkSetUsersActive(ids: string[], isActive: boolean): Promise<number> {
  await requireAdminUser()
  if (ids.length === 0) return 0
  const { error, count } = await supabase
    .from("profiles")
    .update({ is_active: isActive }, { count: "exact" })
    .in("id", ids)
  if (error) err(error.message)
  return count ?? ids.length
}

export async function getAllCompanies(): Promise<Company[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map((row) => mapCompany(row))
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id)
  if (error) err(error.message)
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

// Companies
export interface CompanyInput {
  name: string
  taxNumber: string
  taxOffice: string
  phone: string
  email: string
  address: Address
  discountRate: number
  creditLimit: number
  isActive?: boolean
}

function companyRow(input: CompanyInput) {
  return {
    name: input.name,
    tax_number: input.taxNumber,
    tax_office: input.taxOffice,
    phone: input.phone,
    email: input.email,
    address: input.address,
    discount_rate: resolveDiscountRate(input.discountRate),
    credit_limit: Math.max(0, Number(input.creditLimit) || 0),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
  }
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("companies")
    .insert({ ...companyRow(input), is_active: input.isActive !== false })
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Şirket oluşturulamadı")
  return mapCompany(data)
}

export async function setCompanyActive(id: string, isActive: boolean): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("companies").update({ is_active: isActive }).eq("id", id)
  if (error) err(error.message)
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  await requireAdminUser()
  const { data, error } = await supabase.from("companies").update(companyRow(input)).eq("id", id).select().single()
  if (error || !data) err(error?.message ?? "Şirket güncellenemedi")
  return mapCompany(data)
}

export async function deleteCompany(id: string): Promise<void> {
  await requireAdminUser()
  const [{ count: orderCount }, { count: invoiceCount }, { count: userCount }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("company_id", id),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("company_id", id),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("company_id", id),
  ])
  const orders = orderCount ?? 0
  const invoices = invoiceCount ?? 0
  if (orders > 0 || invoices > 0) {
    err(
      `Bu firmada ${orders} sipariş ve ${invoices} fatura var. Silmek veri kaybına yol açar — önce kayıtları arşivleyin veya firmayı pasife alın.`
    )
  }
  if ((userCount ?? 0) > 0) {
    err(`Bu firmaya bağlı ${userCount} kullanıcı var. Önce kullanıcıları başka firmaya taşıyın veya firmasız bırakın.`)
  }
  const { error } = await supabase.from("companies").delete().eq("id", id)
  if (error) err(error.message)
}

// ─── Company contract prices ─────────────────────────────────────────────────

export interface CompanyPriceRow {
  id: string
  companyId: string
  productId: string
  sku: string
  productName: string
  listPrice: number
  dealerPrice: number
  contractPrice: number | null
  netPrice: number | null
  discountRate: number
  discountGroup: string | null
  validFrom: string | null
  validUntil: string | null
}

export interface CompanyPriceInput {
  companyId: string
  productId: string
  listPrice?: number
  dealerPrice: number
  contractPrice?: number | null
  netPrice?: number | null
  discountRate?: number
  discountGroup?: string | null
  validFrom?: string | null
  validUntil?: string | null
}

export async function listCompanyPrices(companyId: string): Promise<CompanyPriceRow[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("customer_prices")
    .select("id, company_id, product_id, list_price, dealer_price, contract_price, net_price, discount_rate, discount_group, valid_from, valid_until, products(sku, name)")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map((row) => {
    const product = row.products as { sku?: string; name?: string } | null
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      productId: String(row.product_id),
      sku: String(product?.sku ?? ""),
      productName: String(product?.name ?? ""),
      listPrice: Number(row.list_price ?? 0),
      dealerPrice: Number(row.dealer_price ?? 0),
      contractPrice: row.contract_price != null ? Number(row.contract_price) : null,
      netPrice: row.net_price != null ? Number(row.net_price) : null,
      discountRate: Number(row.discount_rate ?? 0),
      discountGroup: row.discount_group != null ? String(row.discount_group) : null,
      validFrom: row.valid_from ? String(row.valid_from) : null,
      validUntil: row.valid_until ? String(row.valid_until) : null,
    }
  })
}

export async function upsertCompanyPrice(input: CompanyPriceInput): Promise<void> {
  await requireAdminUser()
  const dealer = Math.max(0, Number(input.dealerPrice) || 0)
  const contract = input.contractPrice != null ? Math.max(0, Number(input.contractPrice)) : dealer
  const net = input.netPrice != null ? Math.max(0, Number(input.netPrice)) : contract
  const row = {
    company_id: input.companyId,
    product_id: input.productId,
    list_price: Math.max(0, Number(input.listPrice) || dealer),
    dealer_price: dealer,
    contract_price: contract,
    net_price: net,
    discount_rate: Math.max(0, Number(input.discountRate) || 0),
    discount_group: input.discountGroup || null,
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from("customer_prices")
    .upsert(row, { onConflict: "company_id,product_id" })
  if (error) err(error.message)
}

export async function deleteCompanyPrice(id: string): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("customer_prices").delete().eq("id", id)
  if (error) err(error.message)
}

/** CSV lines: sku;price;discount (semicolon or comma). Price maps to dealer/contract/net. */
export async function importCompanyPricesCsv(companyId: string, csvText: string): Promise<{ upserted: number; skipped: string[] }> {
  await requireAdminUser()
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) err("CSV boş")

  const skipped: string[] = []
  const rows: { sku: string; price: number; discount: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
    if (i === 0 && (lower.includes("sku") || lower.includes("fiyat"))) continue
    const parts = line.split(/[;,]/).map((p) => p.trim().replace(/^"|"$/g, ""))
    const sku = parts[0]
    const price = Number(parts[1]?.replace(",", "."))
    const discount = parts[2] != null && parts[2] !== "" ? Number(parts[2].replace(",", ".")) : 0
    if (!sku || !Number.isFinite(price) || price < 0) {
      skipped.push(line)
      continue
    }
    rows.push({ sku, price, discount: Number.isFinite(discount) ? discount : 0 })
  }

  if (rows.length === 0) err("İçe aktarılacak satır yok")

  const skus = [...new Set(rows.map((r) => r.sku))]
  const { data: products, error: pErr } = await supabase.from("products").select("id, sku").in("sku", skus)
  if (pErr) err(pErr.message)
  const skuMap = new Map((products ?? []).map((p) => [String(p.sku), String(p.id)]))

  let upserted = 0
  for (const r of rows) {
    const productId = skuMap.get(r.sku)
    if (!productId) {
      skipped.push(r.sku)
      continue
    }
    await upsertCompanyPrice({
      companyId,
      productId,
      dealerPrice: r.price,
      contractPrice: r.price,
      netPrice: r.price,
      listPrice: r.price,
      discountRate: r.discount,
    })
    upserted += 1
  }
  return { upserted, skipped }
}

// Products
export interface ProductStockLineInput {
  warehouseId: string
  warehouseName: string
  quantity: number
}

export interface ProductInput {
  sku: string
  name: string
  brand: string
  category: string
  description: string
  basePrice: number
  /** Legacy single-warehouse qty (used when stockLines omitted) */
  stockQuantity: number
  /** Multi-warehouse stock; when set, overrides stockQuantity */
  stockLines?: ProductStockLineInput[]
  isActive: boolean
  images?: string[]
  compatibleVehicles?: Product["compatibleVehicles"]
}

export async function uploadProductImage(file: File, folderKey: string): Promise<string> {
  await requireAdminUser()
  if (!file.type.startsWith("image/")) err("Sadece görsel dosyaları yüklenebilir")
  if (file.size > 5 * 1024 * 1024) err("Görsel en fazla 5 MB olabilir")

  const safeFolder = folderKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "product"
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const path = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  })
  if (error) err(error.message)

  const { data } = supabase.storage.from("product-images").getPublicUrl(path)
  if (!data?.publicUrl) err("Görsel URL alınamadı")
  return data.publicUrl
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await requireAdminUser()
  const now = new Date().toISOString()
  let stock: Array<Record<string, unknown>>
  if (input.stockLines?.length) {
    stock = input.stockLines.map((line) => ({
      warehouseId: line.warehouseId,
      warehouseName: line.warehouseName,
      quantity: Math.max(0, line.quantity),
      reserved: 0,
      available: Math.max(0, line.quantity),
      location: "",
      lastUpdated: now,
    }))
  } else {
    const { data: wh } = await supabase.from("warehouses").select("id, name").eq("code", "ANA").maybeSingle()
    stock = [{
      warehouseId: (wh?.id as string) ?? "",
      warehouseName: (wh?.name as string) ?? "Ana Depo",
      quantity: input.stockQuantity,
      reserved: 0,
      available: input.stockQuantity,
      location: "",
      lastUpdated: now,
    }]
  }
  const { data, error } = await supabase
    .from("products")
    .insert({
      sku: input.sku,
      name: input.name,
      brand: input.brand,
      category: input.category,
      description: input.description,
      base_price: input.basePrice,
      is_active: input.isActive,
      images: input.images ?? [],
      compatible_vehicles: input.compatibleVehicles ?? [],
      stock,
    })
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Ürün oluşturulamadı")
  try {
    await syncWarehouseUsedCapacity(supabase)
  } catch {
    /* best-effort */
  }
  return mapProduct(data)
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  await requireAdminUser()
  const { data: existing } = await supabase.from("products").select("stock").eq("id", id).single()
  const now = new Date().toISOString()
  const stockArr = (existing?.stock as Array<Record<string, unknown>>) ?? []
  let stock: Array<Record<string, unknown>>
  if (input.stockLines?.length) {
    const reservedByWh = new Map(
      stockArr.map((s) => [String(s.warehouseId ?? ""), Number(s.reserved ?? 0)])
    )
    stock = input.stockLines.map((line) => {
      const reserved = reservedByWh.get(line.warehouseId) ?? 0
      const quantity = Math.max(0, line.quantity)
      return {
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseName,
        quantity,
        reserved,
        available: Math.max(0, quantity - reserved),
        location: "",
        lastUpdated: now,
      }
    })
  } else {
    stock = stockArr.length
      ? stockArr.map((s, i) => {
          if (i !== 0) return s
          const reserved = Number(s.reserved ?? 0)
          return {
            ...s,
            quantity: input.stockQuantity,
            available: Math.max(0, input.stockQuantity - reserved),
            lastUpdated: now,
          }
        })
      : [{
          warehouseId: "",
          warehouseName: "Ana Depo",
          quantity: input.stockQuantity,
          reserved: 0,
          available: input.stockQuantity,
          location: "",
          lastUpdated: now,
        }]
  }

  const payload: Record<string, unknown> = {
    sku: input.sku,
    name: input.name,
    brand: input.brand,
    category: input.category,
    description: input.description,
    base_price: input.basePrice,
    is_active: input.isActive,
    images: input.images ?? [],
    stock,
  }
  if (input.compatibleVehicles !== undefined) {
    payload.compatible_vehicles = input.compatibleVehicles
  }

  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Ürün güncellenemedi")
  try {
    await syncWarehouseUsedCapacity(supabase)
  } catch {
    /* best-effort */
  }
  return mapProduct(data)
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) err(error.message)
  try {
    await syncWarehouseUsedCapacity(supabase)
  } catch {
    /* best-effort */
  }
}

// Orders
export async function deleteOrder(id: string): Promise<void> {
  await requireAdminUser()
  const { data: existing, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()
  if (fetchErr || !existing) err(fetchErr?.message ?? "Sipariş bulunamadı")

  const status = String(existing.status)
  const items = (Array.isArray(existing.items) ? existing.items : []) as Array<{
    productId: string
    warehouseId: string
    quantity: number
    returnedQuantity?: number
    productName?: string
  }>
  const lines = orderItemsToStockLines(
    items.map((i) => ({
      productId: i.productId,
      warehouseId: i.warehouseId,
      quantity: Math.max(0, Number(i.quantity) - Number(i.returnedQuantity ?? 0)),
      productName: i.productName,
    })).filter((i) => i.quantity > 0)
  )

  try {
    if (["draft", "pending_approval", "approved"].includes(status) && lines.length) {
      await applyStockMovement(supabase, lines, "release")
    } else if (["confirmed", "processing", "shipped", "delivered"].includes(status) && lines.length) {
      await applyStockMovement(supabase, lines, "restock")
    }
  } catch {
    /* best-effort before delete */
  }

  const { error } = await supabase.from("orders").delete().eq("id", id)
  if (error) err(error.message)
}

// Campaigns
export async function updateCampaign(id: string, input: CreateCampaignInput): Promise<Campaign> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      name: input.name,
      description: input.description,
      type: input.type,
      discount_rate: input.discountRate,
      start_date: input.startDate,
      end_date: input.endDate,
      brands: input.brands ?? [],
      categories: input.categories ?? [],
    })
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Kampanya güncellenemedi")
  return mapCampaign(data)
}

export async function deleteCampaign(id: string): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("campaigns").delete().eq("id", id)
  if (error) err(error.message)
}

// Warehouses
export interface WarehouseInput {
  name: string
  code: string
  manager: string
  phone: string
  workingHours: string
  capacity: number
  usedCapacity?: number
  isActive: boolean
  address: Address
}

function warehouseRow(input: WarehouseInput, opts?: { includeUsedCapacity?: boolean }) {
  const row: Record<string, unknown> = {
    name: input.name,
    code: input.code,
    manager: input.manager,
    phone: input.phone,
    working_hours: input.workingHours,
    capacity: input.capacity,
    is_active: input.isActive,
    address: input.address,
  }
  // used_capacity is derived from stock — only set on create (0), never overwrite on update
  if (opts?.includeUsedCapacity) {
    row.used_capacity = input.usedCapacity ?? 0
  }
  return row
}

export async function getAllWarehouses(): Promise<Warehouse[]> {
  await requireAdminUser()
  const { data, error } = await supabase.from("warehouses").select("*").order("name")
  if (error) err(error.message)
  return (data ?? []).map(mapWarehouse)
}

export async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("warehouses")
    .insert(warehouseRow({ ...input, usedCapacity: 0 }, { includeUsedCapacity: true }))
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Depo oluşturulamadı")
  return mapWarehouse(data)
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("warehouses")
    .update(warehouseRow(input))
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Depo güncellenemedi")
  return mapWarehouse(data)
}

export async function deleteWarehouse(id: string): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("warehouses").delete().eq("id", id)
  if (error) err(error.message)
}

// Users (profile fields editable directly; auth create/delete via service routes)
export interface AdminUserUpdate {
  name: string
  surname: string
  phone: string
  role: string
  isActive: boolean
  companyId?: string | null
}

export async function updateUserByAdmin(id: string, input: AdminUserUpdate): Promise<void> {
  const me = await requireAdminUser()
  if (input.role === "admin" && me.id !== id) {
    const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle()
    if (target?.role !== "admin") {
      err("Yeni admin ataması bu panelden yapılamaz")
    }
  }
  const patch: Record<string, unknown> = {
    name: input.name,
    surname: input.surname,
    phone: input.phone,
    role: input.role,
    is_active: input.isActive,
  }
  if (input.companyId !== undefined) patch.company_id = input.companyId
  const { error } = await supabase.from("profiles").update(patch).eq("id", id)
  if (error) err(error.message)
}

export interface AdminCreateUserInput {
  email: string
  name: string
  surname: string
  phone: string
  role: string
  companyId?: string
  companyName?: string
  taxNumber?: string
}

export async function adminCreateUser(input: AdminCreateUserInput): Promise<void> {
  await authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify(input) })
}

export async function adminDeleteUser(id: string): Promise<void> {
  await authedFetch(`/api/admin/users/${id}`, { method: "DELETE" })
}

// ─── Invoices ───────────────────────────────────────────────────────────────

// ─── Invoices ───────────────────────────────────────────────────────────────

function withOverdueStatus<T extends Invoice>(inv: T): T {
  if (inv.status === "sent" && inv.dueDate && new Date(inv.dueDate).getTime() < Date.now()) {
    return { ...inv, status: "overdue" }
  }
  return inv
}

export async function getInvoices(): Promise<Invoice[]> {
  const user = await getCurrentUser()
  let query = supabase.from("invoices").select("*").order("created_at", { ascending: false })
  if (user.companyId) query = query.eq("company_id", user.companyId)

  const { data, error } = await query
  if (error) err(error.message)
  return (data ?? []).map(mapInvoice).map(withOverdueStatus)
}

export async function getInvoiceById(id: string): Promise<Invoice & { companyName?: string }> {
  const user = await getCurrentUser()
  const { data, error } = await supabase
    .from("invoices")
    .select("*, companies(name)")
    .eq("id", id)
    .single()
  if (error || !data) err(error?.message ?? "Fatura bulunamadı")
  const inv = withOverdueStatus({
    ...mapInvoice(data),
    companyName: (data.companies as { name?: string } | null)?.name ?? undefined,
  })
  if (user.role !== "admin" && user.companyId && inv.companyId !== user.companyId) {
    err("Bu faturaya erişim yok")
  }
  return inv
}

/** Admin: all invoices across companies. */
export async function getAllInvoices(): Promise<(Invoice & { companyName?: string })[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("invoices")
    .select("*, companies(name)")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) err(error.message)
  return (data ?? []).map((row: Record<string, unknown>) =>
    withOverdueStatus({
      ...mapInvoice(row),
      companyName: (row.companies as { name?: string } | null)?.name ?? "—",
    })
  )
}

export async function updateInvoiceStatus(
  id: string,
  status: Invoice["status"]
): Promise<Invoice> {
  const user = await getCurrentUser()
  if (user.role !== "admin") err("Fatura durumunu yalnızca yönetici değiştirebilir")
  const patch: Record<string, unknown> = { status }
  if (status === "paid") patch.paid_date = new Date().toISOString()
  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Fatura güncellenemedi")
  return mapInvoice(data)
}

/** Mark all invoices for an order as paid (PayTR / admin). */
export async function markOrderInvoicesPaid(
  service: { from: typeof supabase.from },
  orderId: string
): Promise<void> {
  await service
    .from("invoices")
    .update({ status: "paid", paid_date: new Date().toISOString() })
    .eq("order_id", orderId)
    .neq("status", "cancelled")
}

export interface AdminReportSummary {
  revenue: number
  orderCount: number
  pendingApproval: number
  avgOrderValue: number
  byCompany: { companyId: string; companyName: string; orders: number; revenue: number }[]
  byStatus: { status: string; count: number }[]
  monthlyRevenue: number
  monthlyOrders: number
  last30DaysRevenue: number
  last30DaysOrders: number
  cancelledCount: number
  quotationCount: number
  trend: { label: string; revenue: number; orders: number }[]
}

const PAID_STATUSES = ["confirmed", "processing", "shipped", "delivered"]

export async function getAdminReports(range: "all" | "30" | "90" | "month" = "all"): Promise<AdminReportSummary> {
  await requireAdminUser()
  const [{ data: orders }, { data: companies }] = await Promise.all([
    supabase.from("orders").select("id, company_id, status, pricing, created_at"),
    supabase.from("companies").select("id, name"),
  ])

  const companyNames = new Map((companies ?? []).map((c) => [String(c.id), String(c.name)]))
  const byCompanyMap = new Map<string, { orders: number; revenue: number }>()
  const byStatusMap = new Map<string, number>()
  let revenue = 0
  let pendingApproval = 0
  let paidOrders = 0
  let cancelledCount = 0
  let quotationCount = 0
  let monthlyRevenue = 0
  let monthlyOrders = 0
  let last30DaysRevenue = 0
  let last30DaysOrders = 0

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const day90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const rangeStart =
    range === "month" ? monthStart :
    range === "30" ? day30 :
    range === "90" ? day90 :
    null

  const trendMap = new Map<string, { revenue: number; orders: number }>()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    trendMap.set(key, { revenue: 0, orders: 0 })
  }

  let scopedOrderCount = 0

  for (const row of orders ?? []) {
    const created = new Date(String(row.created_at))
    const status = String(row.status)
    const total = Number((row.pricing as { grandTotal?: number } | null)?.grandTotal ?? 0)
    const isPaid = PAID_STATUSES.includes(status)

    // Always keep monthly / 30d / trend for secondary cards
    if (created >= monthStart) {
      monthlyOrders += 1
      if (isPaid) monthlyRevenue += total
    }
    if (created >= day30) {
      last30DaysOrders += 1
      if (isPaid) last30DaysRevenue += total
    }
    const trendKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`
    const trend = trendMap.get(trendKey)
    if (trend) {
      trend.orders += 1
      if (isPaid) trend.revenue += total
    }

    if (rangeStart && created < rangeStart) continue

    scopedOrderCount += 1
    byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1)
    if (status === "pending_approval") pendingApproval += 1
    if (status === "cancelled") cancelledCount += 1
    if (status === "quotation" || status === "draft") quotationCount += 1

    if (isPaid) {
      revenue += total
      paidOrders += 1
    }

    const cid = String(row.company_id)
    const cur = byCompanyMap.get(cid) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    if (isPaid) cur.revenue += total
    byCompanyMap.set(cid, cur)
  }

  const byCompany = [...byCompanyMap.entries()]
    .map(([companyId, v]) => ({
      companyId,
      companyName: companyNames.get(companyId) ?? "—",
      orders: v.orders,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)

  const monthLabels = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]
  const trend = [...trendMap.entries()].map(([key, v]) => {
    const month = Number(key.split("-")[1]) - 1
    return { label: monthLabels[month] ?? key, revenue: v.revenue, orders: v.orders }
  })

  return {
    revenue,
    orderCount: rangeStart ? scopedOrderCount : (orders?.length ?? 0),
    pendingApproval,
    avgOrderValue: paidOrders > 0 ? revenue / paidOrders : 0,
    byCompany,
    byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
    monthlyRevenue,
    monthlyOrders,
    last30DaysRevenue,
    last30DaysOrders,
    cancelledCount,
    quotationCount,
    trend,
  }
}

// ─── Site settings (maintenance / price update) ─────────────────────────────

export interface SiteSettings {
  maintenanceEnabled: boolean
  maintenanceMessage: string
  priceUpdateEnabled: boolean
  priceUpdateDate: string | null
  priceUpdateMessage: string
  /** Sipariş tutarına göre ekstra iskonto kademeleri */
  volumeDiscountTiers: VolumeDiscountTier[]
  updatedAt: string | null
}

const defaultSiteSettings: SiteSettings = {
  maintenanceEnabled: false,
  maintenanceMessage: "Sistemimiz şu an bakımda. Lütfen daha sonra tekrar deneyin.",
  priceUpdateEnabled: false,
  priceUpdateDate: null,
  priceUpdateMessage: "",
  volumeDiscountTiers: [
    { threshold: 50_000, bonusPercent: 5 },
    { threshold: 150_000, bonusPercent: 10 },
  ],
  updatedAt: null,
}

function mapVolumeTiers(raw: unknown): SiteSettings["volumeDiscountTiers"] {
  if (!Array.isArray(raw)) return [...defaultSiteSettings.volumeDiscountTiers]
  const mapped = raw
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        threshold: Number(r.threshold ?? 0),
        bonusPercent: Number(r.bonusPercent ?? r.bonus_percent ?? 0),
      }
    })
    .filter((t) => t.threshold > 0 && t.bonusPercent > 0)
    .sort((a, b) => a.threshold - b.threshold)
  return mapped.length ? mapped : [...defaultSiteSettings.volumeDiscountTiers]
}

function mapSiteSettings(row: Record<string, unknown> | null): SiteSettings {
  if (!row) return { ...defaultSiteSettings, volumeDiscountTiers: [...defaultSiteSettings.volumeDiscountTiers] }
  return {
    maintenanceEnabled: Boolean(row.maintenance_enabled),
    maintenanceMessage: String(row.maintenance_message ?? defaultSiteSettings.maintenanceMessage),
    priceUpdateEnabled: Boolean(row.price_update_enabled),
    priceUpdateDate: row.price_update_date ? String(row.price_update_date).slice(0, 10) : null,
    priceUpdateMessage: String(row.price_update_message ?? ""),
    volumeDiscountTiers: mapVolumeTiers(row.volume_discount_tiers),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  await requireAuth()
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()
  if (error) err(error.message)
  return mapSiteSettings(data)
}

export async function updateSiteSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  await requireAdminUser()
  const user = await getCurrentUser()
  if (user.role !== "admin") err("Bu işlem için admin yetkisi gerekir")
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }
  if (input.maintenanceEnabled !== undefined) patch.maintenance_enabled = input.maintenanceEnabled
  if (input.maintenanceMessage !== undefined) patch.maintenance_message = input.maintenanceMessage
  if (input.priceUpdateEnabled !== undefined) patch.price_update_enabled = input.priceUpdateEnabled
  if (input.priceUpdateDate !== undefined) patch.price_update_date = input.priceUpdateDate || null
  if (input.priceUpdateMessage !== undefined) patch.price_update_message = input.priceUpdateMessage
  if (input.volumeDiscountTiers !== undefined) {
    patch.volume_discount_tiers = input.volumeDiscountTiers
      .map((t) => ({
        threshold: Math.max(0, Number(t.threshold) || 0),
        bonusPercent: Math.min(100, Math.max(0, Number(t.bonusPercent) || 0)),
      }))
      .filter((t) => t.threshold > 0 && t.bonusPercent > 0)
      .sort((a, b) => a.threshold - b.threshold)
  }

  const { data, error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("id", 1)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Ayarlar kaydedilemedi")
  return mapSiteSettings(data)
}

// ─── Home banners (firma ana sayfa) ─────────────────────────────────────────

export type HomeBannerKind = "hero" | "promo"

export interface HomeBanner {
  id: string
  kind: HomeBannerKind
  title: string
  subtitle: string
  cta: string
  href: string
  badge: string
  gradient: string
  imageUrl: string
  sortOrder: number
  isActive: boolean
}

export interface HomeBannerInput {
  kind: HomeBannerKind
  title: string
  subtitle: string
  cta: string
  href: string
  badge: string
  gradient: string
  imageUrl?: string
  isActive: boolean
}

function mapHomeBanner(row: Record<string, unknown>): HomeBanner {
  return {
    id: String(row.id),
    kind: (row.kind === "promo" ? "promo" : "hero") as HomeBannerKind,
    title: String(row.title ?? ""),
    subtitle: String(row.subtitle ?? ""),
    cta: String(row.cta ?? ""),
    href: String(row.href ?? "/products"),
    badge: String(row.badge ?? ""),
    gradient: String(row.gradient ?? "from-accent/20 via-accent/5 to-transparent"),
    imageUrl: String(row.image_url ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  }
}

/** Active banners for storefront (hero + promo). */
export async function getHomeBanners(kind?: HomeBannerKind): Promise<HomeBanner[]> {
  await requireAuth()
  let query = supabase
    .from("home_banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (kind) query = query.eq("kind", kind)
  const { data, error } = await query
  if (error) err(error.message)
  return (data ?? []).map(mapHomeBanner)
}

/** All banners for admin editor. */
export async function getAllHomeBanners(): Promise<HomeBanner[]> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("home_banners")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true })
  if (error) err(error.message)
  return (data ?? []).map(mapHomeBanner)
}

export async function createHomeBanner(input: HomeBannerInput): Promise<HomeBanner> {
  await requireAdminUser()
  const { data: maxRow } = await supabase
    .from("home_banners")
    .select("sort_order")
    .eq("kind", input.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = Number(maxRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from("home_banners")
    .insert({
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      cta: input.cta,
      href: input.href,
      badge: input.badge,
      gradient: input.gradient,
      image_url: input.imageUrl ?? "",
      is_active: input.isActive,
      sort_order: sortOrder,
    })
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Banner oluşturulamadı")
  return mapHomeBanner(data)
}

export async function updateHomeBanner(id: string, input: HomeBannerInput): Promise<HomeBanner> {
  await requireAdminUser()
  const { data, error } = await supabase
    .from("home_banners")
    .update({
      kind: input.kind,
      title: input.title,
      subtitle: input.subtitle,
      cta: input.cta,
      href: input.href,
      badge: input.badge,
      gradient: input.gradient,
      image_url: input.imageUrl ?? "",
      is_active: input.isActive,
    })
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Banner güncellenemedi")
  return mapHomeBanner(data)
}

export async function deleteHomeBanner(id: string): Promise<void> {
  await requireAdminUser()
  const { error } = await supabase.from("home_banners").delete().eq("id", id)
  if (error) err(error.message)
}

export async function reorderHomeBanners(kind: HomeBannerKind, orderedIds: string[]): Promise<void> {
  await requireAuth()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("home_banners").update({ sort_order: index }).eq("id", id).eq("kind", kind)
    )
  )
}

export async function setHomeBannerActive(id: string, isActive: boolean): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("home_banners").update({ is_active: isActive }).eq("id", id)
  if (error) err(error.message)
}

// ─── Warehouses ─────────────────────────────────────────────────────────────

export async function getWarehouses(): Promise<Warehouse[]> {
  await requireAuth()
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) err(error.message)
  return (data ?? []).map(mapWarehouse)
}
