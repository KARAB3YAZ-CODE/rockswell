import type { OrderPricing } from "./types"

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
  paymentDiscount: number
  shipping: number
  tax: number
  total: number
  discountRate: number
  paymentDiscountRate: number
}

/** Firma veya profil iskonto oranını yüzde olarak normalize eder. */
export function resolveDiscountRate(rate?: number | null): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_DISCOUNT_RATE
  return Math.min(100, Math.max(0, rate))
}

/** Liste fiyatından firma iskontolu bayi birim fiyatı. */
export function dealerUnitPrice(listPrice: number, discountRatePercent?: number | null): number {
  const rate = resolveDiscountRate(discountRatePercent)
  return listPrice * (1 - rate / 100)
}

/** Katalog kartları / ürün detayı için tutarlı fiyat gösterimi. */
export function dealerPriceDisplay(listPrice: number, discountRatePercent?: number | null) {
  const discountRate = resolveDiscountRate(discountRatePercent)
  return {
    listPrice,
    dealerPrice: dealerUnitPrice(listPrice, discountRate),
    discountRate,
  }
}

export type PricingPaymentMethod = "havale" | "online" | string

/** Central B2B cart pricing used by both the cart UI and order creation. */
export function computeCartPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online"
): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  const discount = subtotal * (discountRate / 100)
  const afterDealer = Math.max(0, subtotal - discount)

  const paymentDiscountRate = paymentMethod === "havale" ? HAVALE_EXTRA_DISCOUNT_RATE : 0
  const paymentDiscount = afterDealer * (paymentDiscountRate / 100)
  const taxable = Math.max(0, afterDealer - paymentDiscount)

  const shipping = subtotal > FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST
  const tax = taxable * TAX_RATE
  const total = taxable + shipping + tax

  return {
    subtotal,
    discount,
    paymentDiscount,
    shipping,
    tax,
    total,
    discountRate,
    paymentDiscountRate,
  }
}

export function toOrderPricing(
  subtotal: number,
  discountRatePercent = DEFAULT_DISCOUNT_RATE,
  paymentMethod: PricingPaymentMethod = "online"
): OrderPricing {
  const p = computeCartPricing(subtotal, discountRatePercent, paymentMethod)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount,
    campaignDiscount: 0,
    volumeDiscount: 0,
    paymentDiscount: p.paymentDiscount,
    shippingCost: p.shipping,
    taxTotal: p.tax,
    grandTotal: p.total,
    currency: "TRY",
  }
}
