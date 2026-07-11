export type UserRole = "admin" | "purchase_manager" | "sales_manager" | "warehouse_user" | "finance_user" | "company_admin"

export interface Company {
  id: string
  name: string
  taxNumber: string
  taxOffice: string
  address: Address
  phone: string
  email: string
  /** Firma bazlı bayi iskonto oranı (yüzde, örn. 25 = %25) */
  discountRate: number
  creditLimit: number
  users: User[]
}

export interface Address {
  street: string
  city: string
  district: string
  country: string
  zipCode: string
  latitude?: number
  longitude?: number
}

export interface User {
  id: string
  companyId: string
  email: string
  name: string
  surname: string
  role: UserRole
  phone: string
  avatar?: string
  isActive: boolean
  lastLogin?: Date
  permissions: string[]
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string
  brand: string
  category: string
  subcategory: string
  oemNumbers: string[]
  crossNumbers: string[]
  compatibleVehicles: VehicleCompatibility[]
  images: string[]
  specifications: Specification[]
  documents: Document[]
  videos: string[]
  stock: StockInfo[]
  basePrice: number
  unit: string
  minOrderQuantity: number
  maxOrderQuantity: number
  isActive: boolean
  isFeatured: boolean
  tags: string[]
  /** true when customer_prices overrode basePrice with a net/dealer price */
  customerPriceApplied?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface VehicleCompatibility {
  brand: string
  model: string
  yearStart: number
  yearEnd: number
  engine: string
  fuel: string
  transmission: string
}

export interface Specification {
  name: string
  value: string
  unit?: string
}

export interface Document {
  id: string
  name: string
  type: "pdf" | "certificate" | "manual" | "datasheet"
  url: string
  size: number
}

export interface StockInfo {
  warehouseId: string
  warehouseName: string
  quantity: number
  reserved: number
  available: number
  location: string
  lastUpdated: Date
}

export interface Price {
  listPrice: number
  dealerPrice: number
  campaignPrice?: number
  netPrice?: number
  currency: string
  discountRate: number
  validFrom?: Date
  validUntil?: Date
}

export interface CustomerPrice {
  customerId: string
  productId: string
  price: Price
  discountGroup?: string
  contractPrice?: number
  volumeDiscount?: number
}

export interface Order {
  id: string
  orderNumber: string
  companyId: string
  userId: string
  status: OrderStatus
  items: OrderItem[]
  pricing: OrderPricing
  shipping: ShippingInfo
  payment: PaymentInfo
  documents: OrderDocument[]
  notes: string
  approvalFlow: ApprovalStep[]
  returns: OrderReturn[]
  createdAt: Date
  updatedAt: Date
}

export type OrderStatus = "draft" | "pending_approval" | "approved" | "quotation" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned"

export interface OrderItem {
  productId: string
  productName: string
  sku: string
  brand: string
  quantity: number
  /** Cumulative returned qty for this line */
  returnedQuantity?: number
  unitPrice: number
  discountRate: number
  totalPrice: number
  warehouseId: string
  stockLocation: string
}

export interface OrderReturnLine {
  productId: string
  productName: string
  sku?: string
  brand?: string
  quantity: number
  warehouseId?: string
}

export interface OrderReturn {
  id: string
  reason: string
  createdAt: string
  createdBy?: string
  items: OrderReturnLine[]
}

export interface OrderPricing {
  subtotal: number
  discountTotal: number
  campaignDiscount: number
  volumeDiscount: number
  /** Havale/EFT ekstra indirim tutarı */
  paymentDiscount: number
  shippingCost: number
  taxTotal: number
  grandTotal: number
  currency: string
}

export interface ShippingInfo {
  address: Address
  method: string
  trackingNumber?: string
  carrier: string
  estimatedDate?: Date
  deliveredDate?: Date
  status: string
}

export interface PaymentInfo {
  method: string
  status: string
  dueDate?: Date
  paidDate?: Date
  transactionId?: string
}

export interface OrderDocument {
  id: string
  type: "invoice" | "waybill" | "receipt" | "contract"
  url: string
  createdAt: Date
}

export interface ApprovalStep {
  id: string
  role: UserRole
  userId?: string
  status: "pending" | "approved" | "rejected"
  comment?: string
  createdAt: Date
  updatedAt?: Date
}

export interface Invoice {
  id: string
  invoiceNumber: string
  orderId: string
  companyId: string
  type: "invoice" | "credit_note" | "debit_note"
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
  items: InvoiceItem[]
  subtotal: number
  taxTotal: number
  discountTotal: number
  grandTotal: number
  currency: string
  dueDate: Date
  paidDate?: Date
  createdAt: Date
  pdfUrl?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  total: number
}

export interface Warehouse {
  id: string
  name: string
  code: string
  address: Address
  isActive: boolean
  capacity: number
  usedCapacity: number
  manager: string
  phone: string
  workingHours: string
}

export interface Campaign {
  id: string
  name: string
  description: string
  type: "discount" | "bundle" | "free_shipping" | "fixed_price"
  discountRate?: number
  conditions: CampaignCondition[]
  products: string[]
  brands: string[]
  categories: string[]
  startDate: Date
  endDate: Date
  isActive: boolean
  usageLimit?: number
  usedCount: number
}

export interface CampaignCondition {
  type: "min_quantity" | "min_amount" | "customer_group" | "first_order"
  value: number | string
}

export interface Notification {
  id: string
  type: "info" | "success" | "warning" | "error"
  title: string
  message: string
  read: boolean
  createdAt: Date
  link?: string
}

export interface SearchFilters {
  query: string
  brand?: string
  category?: string
  vehicleBrand?: string
  vehicleModel?: string
  year?: number
  fuel?: string
  transmission?: string
  oem?: string
  priceMin?: number
  priceMax?: number
  inStock?: boolean
  warehouse?: string
  campaign?: boolean
  manufacturer?: string
  page: number
  limit: number
  sort?: string
  order?: "asc" | "desc"
}

export interface SearchResult {
  products: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
  facets: SearchFacet[]
  didYouMean?: string
  aiSuggestion?: string
}

export interface SearchFacet {
  name: string
  values: { value: string; count: number }[]
}

export interface DashboardStats {
  todayOrders: number
  todayOrdersChange: number
  currentBalance: number
  currentBalanceChange: number
  creditLimit: number
  creditUsed: number
  openInvoices: number
  openInvoicesAmount: number
  shipmentsToday: number
  shipmentsPending: number
  lowStockProducts: number
  averageOrderValue: number
  monthlySales: number[]
  monthlyOrders: number[]
  topProducts: { id: string; name: string; quantity: number; revenue: number }[]
  topCategories: { name: string; value: number }[]
  orderStatusBreakdown: { status: string; count: number }[]
  recentOrders: Order[]
}
