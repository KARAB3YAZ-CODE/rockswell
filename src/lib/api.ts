import type {
  Product, Order, Company, User, Warehouse,
  Campaign, Notification, DashboardStats, Address,
} from "./types"

function delay(ms = 400): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function err(msg: string): never {
  throw new Error(msg)
}

// ─── Auth ───────────────────────────────────────────────────────────────────

let _currentUser: User | null = null
let _currentCompany: Company | null = null

export async function getCurrentUser(): Promise<User> {
  await delay()
  if (!_currentUser) err("Oturum bulunamadı. Lütfen giriş yapın.")
  return _currentUser
}

export async function getCurrentCompany(): Promise<Company> {
  await delay()
  if (!_currentCompany) err("Şirket bilgisi bulunamadı.")
  return _currentCompany
}

const SEED_ACCOUNTS = [
  {
    email: "admin@rockswell.com",
    password: "admin123",
    user: {
      id: "usr_admin",
      companyId: "comp_admin",
      name: "Admin",
      surname: "Kullanıcı",
      role: "admin" as const,
      phone: "+90 555 000 00 01",
      isActive: true,
      permissions: ["all"],
    },
    company: {
      id: "comp_admin",
      name: "ROCKSWELL Yönetim",
      taxNumber: "9999999999",
      taxOffice: "Merkez",
      phone: "+90 555 000 00 01",
      email: "admin@rockswell.com",
    },
  },
  {
    email: "musteri@otoparc.com",
    password: "musteri123",
    user: {
      id: "usr_001",
      companyId: "comp_001",
      name: "Ahmet",
      surname: "Yılmaz",
      role: "purchase_manager" as const,
      phone: "+90 532 123 45 67",
      isActive: true,
      permissions: ["view_products", "create_orders", "view_pricing", "view_invoices"],
    },
    company: {
      id: "comp_001",
      name: "Otoparç Otomotiv A.Ş.",
      taxNumber: "1234567890",
      taxOffice: "Kadıköy",
      phone: "+90 216 555 12 34",
      email: "info@otoparc.com",
    },
  },
]

export async function login(email: string, password: string): Promise<User> {
  await delay(800)
  const account = SEED_ACCOUNTS.find((a) => a.email === email && a.password === password)
  if (!account) err("E-posta veya şifre hatalı")

  const now = new Date()
  _currentUser = { ...account.user, email, lastLogin: now } as User
  _currentCompany = {
    ...account.company,
    address: {
      street: account.company.id === "comp_admin" ? "Merkez Mah. No:1" : "Bağdat Caddesi No:123",
      city: "İstanbul",
      district: "Kadıköy",
      country: "Türkiye",
      zipCode: "34710",
    },
    users: [_currentUser],
  } as Company
  return _currentUser
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
  await delay(800)
  _currentUser = {
    id: "usr_" + Date.now(),
    companyId: "comp_" + Date.now(),
    email: data.email,
    name: data.name,
    surname: data.surname,
    role: "company_admin",
    phone: data.phone,
    isActive: true,
    lastLogin: new Date(),
    permissions: ["view_products", "create_orders", "view_pricing", "view_invoices"],
  }
  _currentCompany = {
    id: _currentUser.companyId,
    name: data.companyName,
    taxNumber: data.taxNumber,
    taxOffice: "",
    address: {
      street: "",
      city: "",
      district: "",
      country: "Türkiye",
      zipCode: "",
    },
    phone: data.phone,
    email: data.email,
    users: [_currentUser],
  }
  return _currentUser
}

export async function restoreSession(user: User, company: Company): Promise<void> {
  _currentUser = user
  _currentCompany = company
}

export async function logout(): Promise<void> {
  await delay()
  _currentUser = null
  _currentCompany = null
}

// ─── Products ───────────────────────────────────────────────────────────────

let _products: Product[] = []

export async function getProducts(): Promise<Product[]> {
  await delay()
  return _products
}

export async function getProductById(id: string): Promise<Product> {
  await delay()
  const p = _products.find((x) => x.id === id)
  if (!p) err(`Ürün bulunamadı: ${id}`)
  return p
}

export async function searchProducts(query: string): Promise<Product[]> {
  await delay(200)
  const q = query.toLowerCase()
  return _products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.oemNumbers.some((o) => o.toLowerCase().includes(q))
  )
}

export async function getProductsByBrand(brand: string): Promise<Product[]> {
  await delay()
  return _products.filter((p) => p.brand === brand)
}

export async function getProductsByVehicleBrand(brand: string): Promise<Product[]> {
  await delay()
  return _products.filter((p) => p.compatibleVehicles.some((v) => v.brand === brand))
}

export async function getRelatedProducts(productId: string): Promise<Product[]> {
  await delay()
  const p = _products.find((x) => x.id === productId)
  if (!p) return []
  return _products.filter((x) => x.category === p.category && x.id !== productId).slice(0, 4)
}

// ─── Brands & Categories ────────────────────────────────────────────────────

export interface BrandSummary {
  brand: string
  productCount: number
  categories: string[]
}

export async function getVehicleBrands(): Promise<string[]> {
  await delay()
  const brands = new Set<string>()
  for (const p of _products) {
    for (const v of p.compatibleVehicles) {
      brands.add(v.brand)
    }
  }
  return [...brands].sort()
}

export async function getProductBrands(): Promise<BrandSummary[]> {
  await delay()
  const map = new Map<string, { count: number; cats: Set<string> }>()
  for (const p of _products) {
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
  await delay()
  return [...new Set(_products.map((p) => p.category))].sort()
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  await delay()
  const counts: Record<string, number> = {}
  for (const p of _products) {
    counts[p.category] = (counts[p.category] || 0) + 1
  }
  return counts
}

// ─── Orders ─────────────────────────────────────────────────────────────────

let _orders: Order[] = []

export async function getOrders(): Promise<Order[]> {
  await delay()
  return _orders
}

export async function getOrderById(id: string): Promise<Order> {
  await delay()
  const o = _orders.find((x) => x.id === id)
  if (!o) err(`Sipariş bulunamadı: ${id}`)
  return o
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

let _dashboardStats: DashboardStats = {
  todayOrders: 0,
  todayOrdersChange: 0,
  currentBalance: 0,
  currentBalanceChange: 0,
  creditLimit: 0,
  creditUsed: 0,
  openInvoices: 0,
  openInvoicesAmount: 0,
  shipmentsToday: 0,
  shipmentsPending: 0,
  lowStockProducts: 0,
  averageOrderValue: 0,
  monthlySales: [],
  monthlyOrders: [],
  topProducts: [],
  topCategories: [],
  orderStatusBreakdown: [],
  recentOrders: [],
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay()
  return { ..._dashboardStats }
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

let _campaigns: Campaign[] = []

export async function getCampaigns(): Promise<Campaign[]> {
  await delay()
  return _campaigns
}

// ─── Notifications ──────────────────────────────────────────────────────────

let _notifications: Notification[] = []

export async function getNotifications(): Promise<Notification[]> {
  await delay()
  return _notifications
}

// ─── Warehouses ─────────────────────────────────────────────────────────────

let _warehouses: Warehouse[] = []

export async function getWarehouses(): Promise<Warehouse[]> {
  await delay()
  return _warehouses
}






