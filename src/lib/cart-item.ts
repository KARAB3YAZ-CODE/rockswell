import type { Product } from "./types"

/** Cart line payload from a catalog product (keeps pricing metadata consistent). */
export function cartItemFromProduct(
  product: Product,
  quantity?: number
) {
  const qty = quantity ?? product.minOrderQuantity ?? 1
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    brand: product.brand,
    image: product.images[0] || "",
    quantity: qty,
    unitPrice: product.basePrice,
    totalPrice: product.basePrice * qty,
    warehouseId:
      product.stock.find((s) => s.available > 0)?.warehouseId ||
      product.stock[0]?.warehouseId ||
      "",
    minOrderQuantity: product.minOrderQuantity,
    maxOrderQuantity: product.maxOrderQuantity,
    priceLocked: product.customerPriceApplied,
    category: product.category,
    vehicleBrands: product.compatibleVehicles.map((v) => v.brand),
  }
}

export function productInStock(product: Product): boolean {
  return product.stock.some((s) => s.available > 0)
}
