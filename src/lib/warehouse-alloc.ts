import type { StockInfo } from "./types"

export type AllocatableLine = {
  productId: string
  productName: string
  sku: string
  brand: string
  quantity: number
  unitPrice: number
  warehouseId: string
  priceLocked?: boolean
}

export type StockByProduct = Map<string, StockInfo[]>

/**
 * Ensures each line has a warehouse with enough stock.
 * If quantity exceeds one warehouse, splits into multiple lines across warehouses.
 * Throws if total available across warehouses is insufficient.
 */
export function allocateWarehouses(
  items: AllocatableLine[],
  stockByProduct: StockByProduct
): AllocatableLine[] {
  const out: AllocatableLine[] = []

  for (const item of items) {
    const stock = stockByProduct.get(item.productId) ?? []
    const sorted = [...stock]
      .filter((s) => s.available > 0)
      .sort((a, b) => b.available - a.available)

    const totalAvail = sorted.reduce((sum, s) => sum + s.available, 0)
    if (totalAvail < item.quantity) {
      throw new Error(
        `${item.productName}: yetersiz stok (istenilen ${item.quantity}, kalan ${totalAvail})`
      )
    }

    // Prefer explicit warehouse if it can fulfill fully
    const preferred = item.warehouseId
      ? sorted.find((s) => s.warehouseId === item.warehouseId)
      : undefined
    if (preferred && preferred.available >= item.quantity) {
      out.push({ ...item, warehouseId: preferred.warehouseId })
      continue
    }

    let remaining = item.quantity
    for (const wh of sorted) {
      if (remaining <= 0) break
      const take = Math.min(remaining, wh.available)
      if (take <= 0) continue
      out.push({
        ...item,
        quantity: take,
        warehouseId: wh.warehouseId,
      })
      remaining -= take
    }
    if (remaining > 0) {
      throw new Error(`${item.productName}: depo dağıtımı tamamlanamadı`)
    }
  }

  return out
}
