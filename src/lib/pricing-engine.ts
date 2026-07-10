import type { Price, Product, OrderItem, OrderPricing } from "./types"

export type DiscountType =
  | "percentage"
  | "fixed"
  | "net_price"
  | "campaign"
  | "contract"
  | "volume"
  | "tiered"

export interface DiscountRule {
  id: string
  type: DiscountType
  name: string
  priority: number
  conditions: DiscountCondition[]
  value: number
  currency?: string
  validFrom?: Date
  validUntil?: Date
  customerGroupIds?: string[]
  productIds?: string[]
  brandIds?: string[]
  categoryIds?: string[]
  minQuantity?: number
  minAmount?: number
  maxUsage?: number
  usedCount?: number
}

export interface DiscountCondition {
  field: string
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "between" | "in"
  value: string | number | [number, number]
}

export class PricingEngine {
  private rules: DiscountRule[] = []

  constructor(rules: DiscountRule[] = []) {
    this.rules = rules.sort((a, b) => a.priority - b.priority)
  }

  addRule(rule: DiscountRule) {
    this.rules.push(rule)
    this.rules.sort((a, b) => a.priority - b.priority)
  }

  removeRule(id: string) {
    this.rules = this.rules.filter((r) => r.id !== id)
  }

  setRules(rules: DiscountRule[]) {
    this.rules = rules.sort((a, b) => a.priority - b.priority)
  }

  private evaluateCondition(condition: DiscountCondition, context: PricingContext): boolean {
    const value = this.getContextValue(condition.field, context)
    if (value === undefined) return false

    switch (condition.operator) {
      case "equals":
        return value === condition.value
      case "not_equals":
        return value !== condition.value
      case "greater_than":
        return typeof value === "number" && typeof condition.value === "number" && value > condition.value
      case "less_than":
        return typeof value === "number" && typeof condition.value === "number" && value < condition.value
      case "between":
        if (Array.isArray(condition.value) && typeof value === "number") {
          return value >= condition.value[0] && value <= condition.value[1]
        }
        return false
      case "in":
        return Array.isArray(condition.value) && (condition.value as unknown[]).includes(value)
      default:
        return false
    }
  }

  private getContextValue(field: string, context: PricingContext): unknown {
    const map: Record<string, unknown> = {
      customerId: context.customerId,
      customerGroup: context.customerGroup,
      productId: context.product?.id,
      brand: context.product?.brand,
      category: context.product?.category,
      quantity: context.quantity,
      totalAmount: context.totalAmount,
      currency: context.currency,
      isFirstOrder: context.isFirstOrder,
      orderCount: context.orderCount,
    }
    return map[field]
  }

  calculatePrice(product: Product, context: PricingContext): Price {
    const basePrice = product.basePrice
    let finalPrice = basePrice
    let discountRate = 0
    let campaignPrice: number | undefined
    let netPrice: number | undefined
    let contractPrice: number | undefined

    const applicableRules = this.rules
      .filter((rule) => this.isRuleApplicable(rule, product, context))
      .slice(0, 3)

    for (const rule of applicableRules) {
      switch (rule.type) {
        case "percentage":
          discountRate = Math.max(discountRate, rule.value)
          finalPrice = basePrice * (1 - discountRate / 100)
          break
        case "fixed":
          finalPrice = Math.min(finalPrice, rule.value)
          break
        case "net_price":
          netPrice = rule.value
          finalPrice = rule.value
          break
        case "campaign":
          campaignPrice = basePrice * (1 - rule.value / 100)
          finalPrice = Math.min(finalPrice, campaignPrice)
          break
        case "contract":
          contractPrice = rule.value
          finalPrice = Math.min(finalPrice, contractPrice)
          break
        case "volume":
          if (context.quantity >= (rule.minQuantity || 0)) {
            const volumeDiscount = rule.value
            finalPrice = basePrice * (1 - volumeDiscount / 100)
            discountRate = Math.max(discountRate, volumeDiscount)
          }
          break
      }
    }

    return {
      listPrice: basePrice,
      dealerPrice: finalPrice,
      campaignPrice,
      netPrice,
      currency: context.currency || "TRY",
      discountRate,
    }
  }

  private isRuleApplicable(rule: DiscountRule, product: Product, context: PricingContext): boolean {
    if (rule.validFrom && new Date() < rule.validFrom) return false
    if (rule.validUntil && new Date() > rule.validUntil) return false

    if (rule.customerGroupIds?.length && !rule.customerGroupIds.includes(context.customerGroup || "")) return false
    if (rule.productIds?.length && !rule.productIds.includes(product.id)) return false
    if (rule.brandIds?.length && !rule.brandIds.includes(product.brand)) return false
    if (rule.categoryIds?.length && !rule.categoryIds.includes(product.category)) return false

    if (rule.maxUsage && rule.usedCount && rule.usedCount >= rule.maxUsage) return false

    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) return false
    }

    return true
  }

  calculateOrderTotal(items: OrderItem[], shippingCost: number): OrderPricing {
    const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)
    const discountTotal = items.reduce(
      (acc, item) => acc + (item.unitPrice * item.quantity * item.discountRate) / 100,
      0
    )
    const campaignDiscount = 0
    const volumeDiscount = 0
    const taxTotal = (subtotal - discountTotal) * 0.2
    const grandTotal = subtotal - discountTotal - campaignDiscount - volumeDiscount + shippingCost + taxTotal

    return {
      subtotal,
      discountTotal,
      campaignDiscount,
      volumeDiscount,
      shippingCost,
      taxTotal,
      grandTotal,
      currency: "TRY",
    }
  }
}

export interface PricingContext {
  customerId: string
  customerGroup?: string
  product?: Product
  quantity: number
  totalAmount: number
  currency?: string
  isFirstOrder?: boolean
  orderCount?: number
  date?: Date
}

export const defaultPricingEngine = new PricingEngine([
  {
    id: "dealer_standard",
    type: "percentage",
    name: "Standard Dealer Discount",
    priority: 1,
    conditions: [],
    value: 25,
    customerGroupIds: ["dealer"],
  },
  {
    id: "wholesale_standard",
    type: "percentage",
    name: "Standard Wholesale Discount",
    priority: 1,
    conditions: [],
    value: 18,
    customerGroupIds: ["wholesale"],
  },
  {
    id: "vip_discount",
    type: "percentage",
    name: "VIP Customer Discount",
    priority: 1,
    conditions: [],
    value: 35,
    customerGroupIds: ["vip"],
  },
  {
    id: "volume_tier_1",
    type: "volume",
    name: "Volume Discount Tier 1",
    priority: 3,
    conditions: [],
    value: 5,
    minQuantity: 50,
  },
  {
    id: "volume_tier_2",
    type: "volume",
    name: "Volume Discount Tier 2",
    priority: 3,
    conditions: [],
    value: 10,
    minQuantity: 100,
  },
  {
    id: "campaign_summer",
    type: "campaign",
    name: "Summer Campaign",
    priority: 2,
    conditions: [],
    value: 15,
    validFrom: new Date("2025-06-01"),
    validUntil: new Date("2025-09-01"),
    categoryIds: ["cooling", "ac"],
  },
])
