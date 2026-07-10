import { supabase } from "./supabase"
import {
  buildDashboardStats,
  mapCampaign,
  mapCompany,
  mapNotification,
  mapOrder,
  mapProduct,
  mapUser,
  mapWarehouse,
} from "./mappers"
import type {
  Product, Order, Company, User, Warehouse,
  Campaign, Notification, DashboardStats, Address,
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

// ─── Products ───────────────────────────────────────────────────────────────

export async function getProducts(): Promise<Product[]> {
  await requireAuth()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) err(error.message)
  return (data ?? []).map(mapProduct)
}

export async function getProductById(id: string): Promise<Product> {
  await requireAuth()
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) err(`Ürün bulunamadı: ${id}`)
  return mapProduct(data)
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
  const lower = q.toLowerCase()
  return results.filter(
    (p) =>
      p.oemNumbers.some((o) => o.toLowerCase().includes(lower)) ||
      p.name.toLowerCase().includes(lower) ||
      p.sku.toLowerCase().includes(lower) ||
      p.brand.toLowerCase().includes(lower) ||
      p.category.toLowerCase().includes(lower)
  )
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
