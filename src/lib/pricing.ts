import type { Campaign, OrderPricing, Product } from "./types"

/** Varsayılan bayi iskonto oranı (yüzde) */
export const DEFAULT_DISCOUNT_RATE = 25

/** @deprecated Use DEFAULT_DISCOUNT_RATE / 100 or resolveDiscountRate() */
export const DEALER_DISCOUNT_RATE = DEFAULT_DISCOUNT_RATE / 100

/** Havale / EFT ödemelerinde ek indirim (yüzde) */
export const HAVALE_EXTRA_DISCOUNT_RATE = 3

export const TAX_RATE = 0.2
export const SHIPPING_COST = 150
export const FREE_SHIPPING_THRESHOLD = 5000

export interface CartPricing {
  subtotal: number
  discount: number
  campaignDiscount: number
  paymentDiscount: number
  shipping: number
  tax: number
  total: number
  discountRate: number
  paymentDiscountRate: number
  campaignName?: string
}

/** Firma veya profil iskonto oranını yüzde olarak normalize eder. */
export function resolveDiscountRate(rate?: number | null): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_DISCOUNT_RATE
  return Math.min(100, Math.max(0, rate))
}

/** Liste fiyatından firma iskontolu bayi birim fiyatı. */
export function dealerUnitPrice(
  listPrice: number,
  discountRatePercent?: number | null,
  priceLocked = false
): number {
  if (priceLocked) return listPrice
  const rate = resolveDiscountRate(discountRatePercent)
  return listPrice * (1 - rate / 100)
}

/** Katalog kartları / ürün detayı için tutarlı fiyat gösterimi. */
export function dealerPriceDisplay(
  listPrice: number,
  discountRatePercent?: number | null,
  priceLocked = false
) {
  if (priceLocked) {
    return { listPrice, dealerPrice: listPrice, discountRate: 0, priceLocked: true as const }
  }
  const discountRate = resolveDiscountRate(discountRatePercent)
  return {
    listPrice,
    dealerPrice: dealerUnitPrice(listPrice, discountRate),
    discountRate,
    priceLocked: false as const,
  }
}

export type PricingPaymentMethod = "havale" | "online" | string

export interface CartLineForPricing {
  unitPrice: number
  quantity: number
  /** true = customer_prices net; skip company discount */
  priceLocked?: boolean
  category?: string
  brand?: string
  vehicleBrands?: string[]
}

function norm(s: string) {
  return s.trim().toLocaleLowerCase("tr")
}

/** Whether a product/line matches an active discount campaign. Empty targets = all products. */
export function campaignMatchesProduct(
  campaign: Campaign,
  product: Pick<Product, "category" | "brand" | "compatibleVehicles"> | CartLineForPricing
): boolean {
  const cats = (campaign.categories ?? []).map(norm).filter(Boolean)
  const brands = (campaign.brands ?? []).map(norm).filter(Boolean)
  if (cats.length === 0 && brands.length === 0) return true

  const category = "category" in product ? norm(product.category ?? "") : ""
  const brand = norm(product.brand ?? "")
  const vehicles =
    "compatibleVehicles" in product
      ? (product.compatibleVehicles ?? []).map((v) => norm(v.brand))
      : (product.vehicleBrands ?? []).map(norm)

  const catHit = cats.length > 0 && cats.includes(category)
  const brandHit =
    brands.length > 0 &&
    (brands.includes(brand) || vehicles.some((v) => brands.includes(v)))

  if (cats.length > 0 && brands.length > 0) return catHit || brandHit
  if (cats.length > 0) return catHit
  return brandHit
}

/** Best active discount campaign for a line (highest rate). */
export function bestCampaignForLine(
  campaigns: Campaign[],
  line: CartLineForPricing
): Campaign | null {
  let best: Campaign | null = null
  for (const c of campaigns) {
    if (c.type !== "discount" && c.type) continue
    const rate = Number(c.discountRate ?? 0)
    if (!rate || rate <= 0) continue
    if (!campaignMatchesProduct(c, line)) continue
    if (!best || rate > Number(best.discountRate ?? 0)) best = c
  }
  return best
}

/** Central B2B cart pricing used by both the cart UI and order creation. */
export function computeCartPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaignDiscount = 0
): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  const discount = subtotal * (discountRate / 100)
  const afterDealer = Math.max(0, subtotal - discount)
  const campaign = Math.min(afterDealer, Math.max(0, campaignDiscount))
  const afterCampaign = Math.max(0, afterDealer - campaign)

  const paymentDiscountRate = paymentMethod === "havale" ? HAVALE_EXTRA_DISCOUNT_RATE : 0
  const paymentDiscount = afterCampaign * (paymentDiscountRate / 100)
  const taxable = Math.max(0, afterCampaign - paymentDiscount)

  const shipping = subtotal > FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST
  const tax = taxable * TAX_RATE
  const total = taxable + shipping + tax

  return {
    subtotal,
    discount,
    campaignDiscount: campaign,
    paymentDiscount,
    shipping,
    tax,
    total,
    discountRate,
    paymentDiscountRate,
  }
}

/**
 * Line-aware pricing: locked lines skip company discount;
 * campaign discount applies on dealer-net of matching lines.
 */
export function computeCartPricingFromLines(
  lines: CartLineForPricing[],
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaigns: Campaign[] = []
): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  let subtotal = 0
  let discount = 0
  let campaignDiscount = 0
  let campaignName: string | undefined

  for (const line of lines) {
    const lineSub = line.unitPrice * line.quantity
    subtotal += lineSub
    const companyCut = line.priceLocked ? 0 : lineSub * (discountRate / 100)
    discount += companyCut
    const afterCompany = lineSub - companyCut
    const camp = bestCampaignForLine(campaigns, line)
    if (camp) {
      const rate = Number(camp.discountRate ?? 0) / 100
      campaignDiscount += afterCompany * rate
      campaignName = camp.name
    }
  }

  const afterDealer = Math.max(0, subtotal - discount)
  const campaign = Math.min(afterDealer, campaignDiscount)
  const afterCampaign = Math.max(0, afterDealer - campaign)

  const paymentDiscountRate = paymentMethod === "havale" ? HAVALE_EXTRA_DISCOUNT_RATE : 0
  const paymentDiscount = afterCampaign * (paymentDiscountRate / 100)
  const taxable = Math.max(0, afterCampaign - paymentDiscount)
  const shipping = subtotal > FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST
  const tax = taxable * TAX_RATE
  const total = taxable + shipping + tax

  return {
    subtotal,
    discount,
    campaignDiscount: campaign,
    paymentDiscount,
    shipping,
    tax,
    total,
    discountRate,
    paymentDiscountRate,
    campaignName,
  }
}

export function toOrderPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaignDiscount = 0
): OrderPricing {
  const p = computeCartPricing(subtotal, discountRatePercent, paymentMethod, campaignDiscount)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount,
    campaignDiscount: p.campaignDiscount,
    volumeDiscount: 0,
    paymentDiscount: p.paymentDiscount,
    shippingCost: p.shipping,
    taxTotal: p.tax,
    grandTotal: p.total,
    currency: "TRY",
  }
}

export function toOrderPricingFromLines(
  lines: CartLineForPricing[],
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaigns: Campaign[] = []
): OrderPricing {
  const p = computeCartPricingFromLines(lines, discountRatePercent, paymentMethod, campaigns)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount,
    campaignDiscount: p.campaignDiscount,
    volumeDiscount: 0,
    paymentDiscount: p.paymentDiscount,
    shippingCost: p.shipping,
    taxTotal: p.tax,
    grandTotal: p.total,
    currency: "TRY",
  }
}
