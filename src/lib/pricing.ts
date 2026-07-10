import type { OrderPricing } from "./types"

export const DEALER_DISCOUNT_RATE = 0.25
export const TAX_RATE = 0.2
export const SHIPPING_COST = 150
export const FREE_SHIPPING_THRESHOLD = 5000

export interface CartPricing {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
}

/** Central B2B cart pricing used by both the cart UI and order creation. */
export function computeCartPricing(subtotal: number): CartPricing {
  const discount = subtotal * DEALER_DISCOUNT_RATE
  const shipping = subtotal > FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_COST
  const tax = (subtotal - discount) * TAX_RATE
  const total = subtotal - discount + shipping + tax
  return { subtotal, discount, shipping, tax, total }
}

export function toOrderPricing(subtotal: number): OrderPricing {
  const p = computeCartPricing(subtotal)
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
