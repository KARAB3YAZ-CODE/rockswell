import type { Product, StockInfo } from "./types"

export type CartWarehouseOption = {
  warehouseId: string
  warehouseName: string
  available: number
}

/** Cart line payload from a catalog product (keeps pricing metadata consistent). */
export function cartItemFromProduct(product: Product, quantity?: number) {
  const qty = quantity ?? product.minOrderQuantity ?? 1
  const preferred =
    product.stock.find((s) => s.available > 0) || product.stock[0]
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    brand: product.brand,
    image: product.images[0] || "",
    quantity: qty,
    unitPrice: product.basePrice,
    totalPrice: product.basePrice * qty,
    warehouseId: preferred?.warehouseId || "",
    warehouseName: preferred?.warehouseName || "",
    warehouseOptions: stockToOptions(product.stock),
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    priceLocked: product.customerPriceApplied,
    category: product.category,
    vehicleBrands: product.compatibleVehicles.map((v) => v.brand),
  }
}

export function stockToOptions(stock: StockInfo[]): CartWarehouseOption[] {
  return stock
    .filter((s) => s.warehouseId)
    .map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouseName || s.warehouseId,
      available: s.available,
    }))
}

export function productInStock(product: Product): boolean {
  return product.stock.some((s) => s.available > 0)
}

export function cartLineKey(productId: string, warehouseId: string): string {
  return `${productId}::${warehouseId || "_"}`
}
