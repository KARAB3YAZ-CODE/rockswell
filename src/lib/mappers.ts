import type {
  Address,
  Campaign,
  Company,
  DashboardStats,
  Invoice,
  Notification,
  Order,
  Product,
  User,
  Warehouse,
} from "./types"

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

function parseAddress(value: unknown): Address {
  const raw = (value ?? {}) as Record<string, unknown>
  return {
    street: String(raw.street ?? ""),
    city: String(raw.city ?? ""),
    district: String(raw.district ?? ""),
    country: String(raw.country ?? "Türkiye"),
    zipCode: String(raw.zipCode ?? raw.zip_code ?? ""),
    latitude: typeof raw.latitude === "number" ? raw.latitude : undefined,
    longitude: typeof raw.longitude === "number" ? raw.longitude : undefined,
  }
}

function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description ?? ""),
    brand: String(row.brand ?? ""),
    category: String(row.category ?? ""),
    subcategory: String(row.subcategory ?? ""),
    oemNumbers: (row.oem_numbers as string[]) ?? [],
    crossNumbers: (row.cross_numbers as string[]) ?? [],
    compatibleVehicles: (row.compatible_vehicles as Product["compatibleVehicles"]) ?? [],
    images: (row.images as string[]) ?? [],
    specifications: (row.specifications as Product["specifications"]) ?? [],
    documents: (row.documents as Product["documents"]) ?? [],
    videos: (row.videos as string[]) ?? [],
    stock: ((row.stock as Product["stock"]) ?? []).map((item) => ({
      ...item,
      lastUpdated: new Date(item.lastUpdated),
    })),
    basePrice: Number(row.base_price ?? 0),
    unit: String(row.unit ?? "adet"),
    minOrderQuantity: Number(row.min_order_quantity ?? 1),
    maxOrderQuantity: Number(row.max_order_quantity ?? 9999),
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
    tags: (row.tags as string[]) ?? [],
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}

export function mapUser(row: Record<string, unknown>, email: string): User {
  return {
    id: String(row.id),
    companyId: row.company_id ? String(row.company_id) : "",
    email,
    name: String(row.name ?? ""),
    surname: String(row.surname ?? ""),
    role: row.role as User["role"],
    phone: String(row.phone ?? ""),
    avatar: row.avatar ? String(row.avatar) : undefined,
    isActive: Boolean(row.is_active),
    lastLogin: row.last_login ? new Date(String(row.last_login)) : undefined,
    permissions: (row.permissions as string[]) ?? [],
  }
}

export function mapCompany(row: Record<string, unknown>, users: User[] = []): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    taxNumber: String(row.tax_number ?? ""),
    taxOffice: String(row.tax_office ?? ""),
    address: parseAddress(row.address),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    discountRate: Number(row.discount_rate ?? 25),
    users,
  }
}

export function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    companyId: String(row.company_id),
    userId: String(row.user_id),
    status: row.status as Order["status"],
    items: (row.items as Order["items"]) ?? [],
    pricing: (row.pricing as Order["pricing"]) ?? {
      subtotal: 0,
      discountTotal: 0,
      campaignDiscount: 0,
      volumeDiscount: 0,
      shippingCost: 0,
      taxTotal: 0,
      grandTotal: 0,
      currency: "TRY",
    },
    shipping: (row.shipping as Order["shipping"]) ?? {
      address: parseAddress({}),
      method: "",
      carrier: "",
      status: "",
    },
    payment: (row.payment as Order["payment"]) ?? { method: "", status: "" },
    documents: (row.documents as Order["documents"]) ?? [],
    notes: String(row.notes ?? ""),
    approvalFlow: (row.approval_flow as Order["approvalFlow"]) ?? [],
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}

export function mapCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    type: row.type as Campaign["type"],
    discountRate: row.discount_rate != null ? Number(row.discount_rate) : undefined,
    conditions: (row.conditions as Campaign["conditions"]) ?? [],
    products: (row.products as string[]) ?? [],
    brands: (row.brands as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    startDate: new Date(String(row.start_date)),
    endDate: new Date(String(row.end_date)),
    isActive: Boolean(row.is_active),
    usageLimit: row.usage_limit != null ? Number(row.usage_limit) : undefined,
    usedCount: Number(row.used_count ?? 0),
  }
}

export function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number ?? ""),
    orderId: String(row.order_id ?? ""),
    companyId: String(row.company_id ?? ""),
    type: (row.type as Invoice["type"]) ?? "invoice",
    status: (row.status as Invoice["status"]) ?? "draft",
    items: (row.items as Invoice["items"]) ?? [],
    subtotal: Number(row.subtotal ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    discountTotal: Number(row.discount_total ?? 0),
    grandTotal: Number(row.grand_total ?? 0),
    currency: String(row.currency ?? "TRY"),
    dueDate: new Date(String(row.due_date ?? row.created_at)),
    paidDate: row.paid_date ? new Date(String(row.paid_date)) : undefined,
    createdAt: new Date(String(row.created_at)),
    pdfUrl: row.pdf_url ? String(row.pdf_url) : undefined,
  }
}

export function mapWarehouse(row: Record<string, unknown>): Warehouse {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    address: parseAddress(row.address),
    isActive: Boolean(row.is_active),
    capacity: Number(row.capacity ?? 0),
    usedCapacity: Number(row.used_capacity ?? 0),
    manager: String(row.manager ?? ""),
    phone: String(row.phone ?? ""),
    workingHours: String(row.working_hours ?? ""),
  }
}

export function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    type: row.type as Notification["type"],
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    read: Boolean(row.is_read),
    createdAt: new Date(String(row.created_at)),
    link: row.link ? String(row.link) : undefined,
  }
}

export function productToRow(product: Product, warehouseId?: string): Record<string, unknown> {
  const stock = warehouseId
    ? product.stock.map((item) => ({
        ...item,
        warehouseId,
        lastUpdated: item.lastUpdated.toISOString(),
      }))
    : product.stock.map((item) => ({
        ...item,
        lastUpdated: item.lastUpdated.toISOString(),
      }))

  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    oem_numbers: product.oemNumbers,
    cross_numbers: product.crossNumbers,
    compatible_vehicles: product.compatibleVehicles,
    images: product.images,
    specifications: product.specifications,
    documents: product.documents,
    videos: product.videos,
    stock: toJson(stock),
    base_price: product.basePrice,
    unit: product.unit,
    min_order_quantity: product.minOrderQuantity,
    max_order_quantity: product.maxOrderQuantity,
    is_active: product.isActive,
    is_featured: product.isFeatured,
    tags: product.tags,
  }
}

export function buildDashboardStats(
  orders: Order[],
  creditLimit: number,
  openInvoicesAmount: number,
  openInvoicesCount: number
): DashboardStats {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayOrders = orders.filter((order) => order.createdAt >= today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayOrders = orders.filter(
    (order) => order.createdAt >= yesterday && order.createdAt < today
  )

  const monthlySales = Array.from({ length: 12 }, () => 0)
  const monthlyOrders = Array.from({ length: 12 }, () => 0)
  const statusCounts = new Map<string, number>()
  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>()
  const categoryTotals = new Map<string, number>()

  for (const order of orders) {
    const month = order.createdAt.getMonth()
    monthlyOrders[month] += 1
    monthlySales[month] += order.pricing.grandTotal ?? 0
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1)

    for (const item of order.items) {
      const current = productTotals.get(item.productId) ?? {
        name: item.productName,
        quantity: 0,
        revenue: 0,
      }
      current.quantity += item.quantity
      current.revenue += item.totalPrice
      productTotals.set(item.productId, current)
    }
  }

  const grandTotal = orders.reduce((sum, order) => sum + (order.pricing.grandTotal ?? 0), 0)

  return {
    todayOrders: todayOrders.length,
    todayOrdersChange:
      yesterdayOrders.length === 0
        ? todayOrders.length > 0
          ? 100
          : 0
        : Math.round(
            ((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100
          ),
    currentBalance: openInvoicesAmount,
    currentBalanceChange: 0,
    creditLimit,
    creditUsed: openInvoicesAmount,
    openInvoices: openInvoicesCount,
    openInvoicesAmount,
    shipmentsToday: orders.filter((order) => order.status === "shipped").length,
    shipmentsPending: orders.filter((order) =>
      ["processing", "confirmed", "approved"].includes(order.status)
    ).length,
    lowStockProducts: 0,
    averageOrderValue: orders.length ? grandTotal / orders.length : 0,
    monthlySales,
    monthlyOrders,
    topProducts: [...productTotals.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    topCategories: [...categoryTotals.entries()]
      .map(([name, value]) => ({ name, value }))
      .slice(0, 5),
    orderStatusBreakdown: [...statusCounts.entries()].map(([status, count]) => ({
      status,
      count,
    })),
    recentOrders: orders.slice(0, 5),
  }
}
