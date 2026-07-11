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

/** Sipariş tutarına göre açılan ekstra iskonto kademeleri (firma oranının üstüne). */
export interface VolumeDiscountTier {
  /** Sepet ara toplamı eşiği (KDV hariç liste tutarı, TL) */
  threshold: number
  /** Firma iskontosuna eklenen ekstra yüzde */
  bonusPercent: number
}

export const DEFAULT_VOLUME_DISCOUNT_TIERS: VolumeDiscountTier[] = [
  { threshold: 50_000, bonusPercent: 5 },
  { threshold: 150_000, bonusPercent: 10 },
]

export interface VolumeTierStatus {
  bonusPercent: number
  unlockedThreshold: number | null
  nextThreshold: number | null
  nextBonusPercent: number | null
  amountToNext: number
  /** 0–1 progress toward next locked tier (1 if max unlocked) */
  progress: number
  tiers: VolumeDiscountTier[]
}

export interface CartPricing {
  subtotal: number
  discount: number
  /** Extra unlock from volume tiers (portion of company discount beyond base rate) */
  volumeDiscount: number
  campaignDiscount: number
  paymentDiscount: number
  shipping: number
  tax: number
  total: number
  /** Base company rate (before volume bonus) */
  discountRate: number
  /** Effective rate = base + unlocked bonus */
  effectiveDiscountRate: number
  volumeBonusPercent: number
  volumeTier: VolumeTierStatus
  paymentDiscountRate: number
  campaignName?: string
}

/** Firma veya profil iskonto oranını yüzde olarak normalize eder. */
export function resolveDiscountRate(rate?: number | null): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_DISCOUNT_RATE
  return Math.min(100, Math.max(0, rate))
}

/** Normalize and sort volume tiers ascending by threshold. */
export function normalizeVolumeTiers(
  tiers?: VolumeDiscountTier[] | null
): VolumeDiscountTier[] {
  const source = tiers?.length ? tiers : DEFAULT_VOLUME_DISCOUNT_TIERS
  return source
    .map((t) => ({
      threshold: Math.max(0, Number(t.threshold) || 0),
      bonusPercent: Math.min(100, Math.max(0, Number(t.bonusPercent) || 0)),
    }))
    .filter((t) => t.threshold > 0 && t.bonusPercent > 0)
    .sort((a, b) => a.threshold - b.threshold)
}

/**
 * Sipariş ara toplamına göre açık kademe.
 * En yüksek eşiği geçen kademenin bonus'u uygulanır (kilit/açılır).
 */
export function resolveVolumeTier(
  qualifyingAmount: number,
  tiers?: VolumeDiscountTier[] | null
): VolumeTierStatus {
  const sorted = normalizeVolumeTiers(tiers)
  let unlocked: VolumeDiscountTier | null = null
  for (const t of sorted) {
    if (qualifyingAmount >= t.threshold) unlocked = t
    else break
  }
  const next = sorted.find((t) => t.threshold > qualifyingAmount) ?? null
  const prevThreshold = unlocked?.threshold ?? 0
  let progress = 1
  if (next) {
    const span = Math.max(1, next.threshold - prevThreshold)
    progress = Math.min(1, Math.max(0, (qualifyingAmount - prevThreshold) / span))
  }
  return {
    bonusPercent: unlocked?.bonusPercent ?? 0,
    unlockedThreshold: unlocked?.threshold ?? null,
    nextThreshold: next?.threshold ?? null,
    nextBonusPercent: next?.bonusPercent ?? null,
    amountToNext: next ? Math.max(0, next.threshold - qualifyingAmount) : 0,
    progress,
    tiers: sorted,
  }
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

/** Whether a product/line matches an active discount campaign.
 * `campaign.brands` matches product manufacturer brand OR compatible vehicle brands.
 */
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

function emptyVolumeTier(tiers?: VolumeDiscountTier[] | null): VolumeTierStatus {
  return {
    bonusPercent: 0,
    unlockedThreshold: null,
    nextThreshold: normalizeVolumeTiers(tiers)[0]?.threshold ?? null,
    nextBonusPercent: normalizeVolumeTiers(tiers)[0]?.bonusPercent ?? null,
    amountToNext: normalizeVolumeTiers(tiers)[0]?.threshold ?? 0,
    progress: 0,
    tiers: normalizeVolumeTiers(tiers),
  }
}

/** Central B2B cart pricing used by both the cart UI and order creation. */
export function computeCartPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaignDiscount = 0,
  volumeTiers?: VolumeDiscountTier[] | null
): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  const volumeTierStatus = resolveVolumeTier(subtotal, volumeTiers)
  const volumeBonusPercent = volumeTierStatus.bonusPercent
  const effectiveDiscountRate = Math.min(100, discountRate + volumeBonusPercent)

  const discount = subtotal * (discountRate / 100)
  const volumeDiscount = subtotal * (volumeBonusPercent / 100)
  const afterDealer = Math.max(0, subtotal - discount - volumeDiscount)
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
    volumeDiscount,
    campaignDiscount: campaign,
    paymentDiscount,
    shipping,
    tax,
    total,
    discountRate,
    effectiveDiscountRate,
    volumeBonusPercent,
    volumeTier: volumeTierStatus,
    paymentDiscountRate,
  }
}

/**
 * Line-aware pricing: locked lines skip company discount;
 * campaign discount applies on dealer-net of matching lines.
 * Volume bonus unlocks from cart subtotal (liste ara toplamı).
 */
export function computeCartPricingFromLines(
  lines: CartLineForPricing[],
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaigns: Campaign[] = [],
  volumeTiers?: VolumeDiscountTier[] | null
): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  let subtotal = 0
  for (const line of lines) {
    subtotal += line.unitPrice * line.quantity
  }

  const volumeTierStatus =
    subtotal > 0 ? resolveVolumeTier(subtotal, volumeTiers) : emptyVolumeTier(volumeTiers)
  const volumeBonusPercent = volumeTierStatus.bonusPercent
  const effectiveDiscountRate = Math.min(100, discountRate + volumeBonusPercent)

  let discount = 0
  let volumeDiscount = 0
  let campaignDiscount = 0
  let campaignName: string | undefined

  for (const line of lines) {
    const lineSub = line.unitPrice * line.quantity
    if (!line.priceLocked) {
      discount += lineSub * (discountRate / 100)
      volumeDiscount += lineSub * (volumeBonusPercent / 100)
    }
    const companyCut = line.priceLocked
      ? 0
      : lineSub * (effectiveDiscountRate / 100)
    const afterCompany = lineSub - companyCut
    const camp = bestCampaignForLine(campaigns, line)
    if (camp) {
      const rate = Number(camp.discountRate ?? 0) / 100
      campaignDiscount += afterCompany * rate
      campaignName = camp.name
    }
  }

  const afterDealer = Math.max(0, subtotal - discount - volumeDiscount)
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
    volumeDiscount,
    campaignDiscount: campaign,
    paymentDiscount,
    shipping,
    tax,
    total,
    discountRate,
    effectiveDiscountRate,
    volumeBonusPercent,
    volumeTier: volumeTierStatus,
    paymentDiscountRate,
    campaignName,
  }
}

export function toOrderPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online",
  campaignDiscount = 0,
  volumeTiers?: VolumeDiscountTier[] | null
): OrderPricing {
  const p = computeCartPricing(subtotal, discountRatePercent, paymentMethod, campaignDiscount, volumeTiers)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount + p.volumeDiscount,
    campaignDiscount: p.campaignDiscount,
    volumeDiscount: p.volumeDiscount,
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
  campaigns: Campaign[] = [],
  volumeTiers?: VolumeDiscountTier[] | null
): OrderPricing {
  const p = computeCartPricingFromLines(lines, discountRatePercent, paymentMethod, campaigns, volumeTiers)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount + p.volumeDiscount,
    campaignDiscount: p.campaignDiscount,
    volumeDiscount: p.volumeDiscount,
    paymentDiscount: p.paymentDiscount,
    shippingCost: p.shipping,
    taxTotal: p.tax,
    grandTotal: p.total,
    currency: "TRY",
  }
}
