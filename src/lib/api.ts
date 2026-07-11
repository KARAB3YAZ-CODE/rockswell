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
import { DEFAULT_DISCOUNT_RATE, resolveDiscountRate, toOrderPricing } from "./pricing"
import { createInvoiceForOrder } from "./invoices"
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

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) err("E-posta veya şifre hatalı")

  const user = await fetchProfile(data.user.id, data.user.email ?? "")
  await supabase
    .from("profiles")
    .update({ last_login: new Date().toISOString() })
    .eq("id", user.id)

  user.lastLogin = new Date()
  _currentUser = user

  if (user.companyId) {
    _currentCompany = await fetchCompany(user.companyId)
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
  _currentUser = user
  _currentCompany = null
  const company = await getCurrentCompany()
  return { user, company }
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

// ─── Products ───────────────────────────────────────────────────────────────

/**
 * Applies customer-specific pricing from the customer_prices table.
 * Overrides basePrice with net/dealer/campaign price when a row exists
 * for the current user. Admins and users without custom prices are unaffected.
 */
async function applyCustomerPrices(products: Product[]): Promise<Product[]> {
  const session = await supabase.auth.getSession()
  const userId = session.data.session?.user?.id
  if (!userId || products.length === 0) return products

  const { data } = await supabase
    .from("customer_prices")
    .select("product_id, net_price, dealer_price, campaign_price")
    .eq("customer_id", userId)

  if (!data?.length) return products

  const map = new Map(data.map((row) => [row.product_id as string, row]))
  return products.map((p) => {
    const cp = map.get(p.id)
    if (!cp) return p
    const price = cp.net_price ?? cp.campaign_price ?? cp.dealer_price
    return price != null ? { ...p, basePrice: Number(price) } : p
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

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%,category.ilike.%${q}%`)
    .order("name")
    .limit(100)

  if (error) err(error.message)

  const results = (data ?? []).map(mapProduct)
  return applyCustomerPrices(results)
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

export type PaymentMethod = "havale" | "online"

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

  if (!input.items.length) err("Sepetiniz boş.")

  const discountRate = await getCustomerDiscountRate()

  const orderItems: Order["items"] = input.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    brand: item.brand,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountRate,
    totalPrice: item.unitPrice * item.quantity,
    warehouseId: item.warehouseId,
    stockLocation: "",
  }))

  const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const pricing = toOrderPricing(subtotal, discountRate, input.paymentMethod)

  const isOnline = input.paymentMethod === "online"
  const status: Order["status"] = input.asQuotation
    ? "quotation"
    : isOnline
      ? "draft"
      : "pending_approval"

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
      approval_flow: [],
    })
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Sipariş oluşturulamadı")
  return mapOrder(data)
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  await requireAuth()
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single()

  if (error || !data) err(error?.message ?? "Sipariş güncellenemedi")

  // Generate an invoice once the order is confirmed (admin approval path).
  if (["confirmed", "processing", "shipped", "delivered"].includes(status)) {
    try {
      await createInvoiceForOrder(supabase, data)
    } catch {
      /* invoice generation is best-effort */
    }
  }

  return mapOrder(data)
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const user = await getCurrentUser()
  const orders = await getOrders()

  let creditLimit = 0
  let openInvoicesAmount = 0
  let openInvoicesCount = 0

  if (user.companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("credit_limit")
      .eq("id", user.companyId)
      .single()

    creditLimit = Number(company?.credit_limit ?? 0)

    const { data: invoices } = await supabase
      .from("invoices")
      .select("grand_total, status")
      .eq("company_id", user.companyId)
      .in("status", ["sent", "overdue"])

    openInvoicesCount = invoices?.length ?? 0
    openInvoicesAmount = (invoices ?? []).reduce(
      (sum, inv) => sum + Number(inv.grand_total ?? 0),
      0
    )
  }

  return buildDashboardStats(orders, creditLimit, openInvoicesAmount, openInvoicesCount)
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
  await requireAuth()
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
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  await requireAuth()
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: input.name,
      description: input.description,
      type: input.type,
      discount_rate: input.discountRate,
      conditions: [],
      products: [],
      brands: [],
      categories: [],
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

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number
  companies: number
  orders: number
  revenue: number
  activeProducts: number
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAuth()
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
  companyName: string
}

export async function getAllUsers(): Promise<AdminUserRow[]> {
  await requireAuth()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, surname, role, phone, is_active, companies(name)")
    .order("created_at", { ascending: false })

  if (error) err(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    surname: String(row.surname ?? ""),
    role: String(row.role ?? ""),
    phone: String(row.phone ?? ""),
    isActive: Boolean(row.is_active),
    companyName:
      (row.companies as { name?: string } | null)?.name ?? "—",
  }))
}

export async function getAllCompanies(): Promise<Company[]> {
  await requireAuth()
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
  }
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  await requireAuth()
  const { data, error } = await supabase.from("companies").insert(companyRow(input)).select().single()
  if (error || !data) err(error?.message ?? "Şirket oluşturulamadı")
  return mapCompany(data)
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  await requireAuth()
  const { data, error } = await supabase.from("companies").update(companyRow(input)).eq("id", id).select().single()
  if (error || !data) err(error?.message ?? "Şirket güncellenemedi")
  return mapCompany(data)
}

export async function deleteCompany(id: string): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("companies").delete().eq("id", id)
  if (error) err(error.message)
}

// Products
export interface ProductInput {
  sku: string
  name: string
  brand: string
  category: string
  description: string
  basePrice: number
  stockQuantity: number
  isActive: boolean
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await requireAuth()
  const { data: wh } = await supabase.from("warehouses").select("id, name").eq("code", "ANA").maybeSingle()
  const now = new Date().toISOString()
  const stock = [{
    warehouseId: (wh?.id as string) ?? "",
    warehouseName: (wh?.name as string) ?? "Ana Depo",
    quantity: input.stockQuantity,
    reserved: 0,
    available: input.stockQuantity,
    location: "",
    lastUpdated: now,
  }]
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
      stock,
    })
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Ürün oluşturulamadı")
  return mapProduct(data)
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  await requireAuth()
  const { data: existing } = await supabase.from("products").select("stock").eq("id", id).single()
  const now = new Date().toISOString()
  const stockArr = (existing?.stock as Array<Record<string, unknown>>) ?? []
  const stock = stockArr.length
    ? stockArr.map((s, i) => (i === 0 ? { ...s, quantity: input.stockQuantity, available: input.stockQuantity, lastUpdated: now } : s))
    : [{ warehouseId: "", warehouseName: "Ana Depo", quantity: input.stockQuantity, reserved: 0, available: input.stockQuantity, location: "", lastUpdated: now }]

  const { data, error } = await supabase
    .from("products")
    .update({
      sku: input.sku,
      name: input.name,
      brand: input.brand,
      category: input.category,
      description: input.description,
      base_price: input.basePrice,
      is_active: input.isActive,
      stock,
    })
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Ürün güncellenemedi")
  return mapProduct(data)
}

export async function deleteProduct(id: string): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) err(error.message)
}

// Orders
export async function deleteOrder(id: string): Promise<void> {
  await requireAuth()
  const { error } = await supabase.from("orders").delete().eq("id", id)
  if (error) err(error.message)
}

// Campaigns
export async function updateCampaign(id: string, input: CreateCampaignInput): Promise<Campaign> {
  await requireAuth()
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      name: input.name,
      description: input.description,
      type: input.type,
      discount_rate: input.discountRate,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .eq("id", id)
    .select()
    .single()
  if (error || !data) err(error?.message ?? "Kampanya güncellenemedi")
  return mapCampaign(data)
}

export async function deleteCampaign(id: string): Promise<void> {
  await requireAuth()
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
  isActive: boolean
  address: Address
}

function warehouseRow(input: WarehouseInput) {
  return {
    name: input.name,
    code: input.code,
    manager: input.manager,
    phone: input.phone,
    working_hours: input.workingHours,
    capacity: input.capacity,
    is_active: input.isActive,
    address: input.address,
  }
}

export async function getAllWarehouses(): Promise<Warehouse[]> {
  await requireAuth()
  const { data, error } = await supabase.from("warehouses").select("*").order("name")
  if (error) err(error.message)
  return (data ?? []).map(mapWarehouse)
}

export async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  await requireAuth()
  const { data, error } = await supabase.from("warehouses").insert(warehouseRow(input)).select().single()
  if (error || !data) err(error?.message ?? "Depo oluşturulamadı")
  return mapWarehouse(data)
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  await requireAuth()
  const { data, error } = await supabase.from("warehouses").update(warehouseRow(input)).eq("id", id).select().single()
  if (error || !data) err(error?.message ?? "Depo güncellenemedi")
  return mapWarehouse(data)
}

export async function deleteWarehouse(id: string): Promise<void> {
  await requireAuth()
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
  await requireAuth()
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

export async function getInvoices(): Promise<Invoice[]> {
  const user = await getCurrentUser()
  let query = supabase.from("invoices").select("*").order("created_at", { ascending: false })
  if (user.companyId) query = query.eq("company_id", user.companyId)

  const { data, error } = await query
  if (error) err(error.message)
  return (data ?? []).map(mapInvoice)
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
