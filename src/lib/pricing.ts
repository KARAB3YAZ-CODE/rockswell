import type { OrderPricing } from "./types"

/** Varsayılan bayi iskonto oranı (yüzde) */
export const DEFAULT_DISCOUNT_RATE = 25

/** @deprecated Use DEFAULT_DISCOUNT_RATE / 100 or resolveDiscountRate() */
export const DEALER_DISCOUNT_RATE = DEFAULT_DISCOUNT_RATE / 100

export const TAX_RATE = 0.2
export const SHIPPING_COST = 150
export const FREE_SHIPPING_THRESHOLD = 5000

export interface CartPricing {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  discountRate: number
}

/** Firma veya profil iskonto oranını yüzde olarak normalize eder. */
export function resolveDiscountRate(rate?: number | null): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_DISCOUNT_RATE
  return Math.min(100, Math.max(0, rate))
}

/** Central B2B cart pricing used by both the cart UI and order creation. */
export function computeCartPricing(subtotal: number, discountRatePercent = DEFAULT_DISCOUNT_RATE): CartPricing {
  const discountRate = resolveDiscountRate(discountRatePercent)
  const discount = subtotal * (discountRate / 100)
  const shipping = subtotal > FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST
  const tax = (subtotal - discount) * TAX_RATE
  const total = subtotal - discount + shipping + tax
  return { subtotal, discount, shipping, tax, total, discountRate }
}

export function toOrderPricing(subtotal: number, discountRatePercent = DEFAULT_DISCOUNT_RATE): OrderPricing {
  const p = computeCartPricing(subtotal, discountRatePercent)
  return {
    subtotal: p.subtotal,
    discountTotal: p.discount,
    campaignDiscount: 0,
    volumeDiscount: 0,
    shippingCost: p.shipping,
    taxTotal: p.tax,
    grandTotal: p.total,
    currency: "TRY",
  }
}
