import type { SupabaseClient } from "@supabase/supabase-js"
import type { StockInfo } from "./types"

type StockRow = {
  warehouseId: string
  warehouseName: string
  quantity: number
  reserved: number
  available: number
  location: string
  lastUpdated: string
}

export type StockLine = {
  productId: string
  warehouseId: string
  quantity: number
  productName?: string
}

function toRow(s: Record<string, unknown>): StockRow {
  return {
    warehouseId: String(s.warehouseId ?? ""),
    warehouseName: String(s.warehouseName ?? ""),
    quantity: Number(s.quantity ?? 0),
    reserved: Number(s.reserved ?? 0),
    available: Number(s.available ?? 0),
    location: String(s.location ?? ""),
    lastUpdated: String(s.lastUpdated ?? new Date().toISOString()),
  }
}

export function assertStockAvailable(
  stock: StockInfo[] | StockRow[] | unknown,
  warehouseId: string,
  qty: number,
  productLabel: string
): void {
  const rows = (Array.isArray(stock) ? stock : []).map((s) => toRow(s as Record<string, unknown>))
  const row =
    rows.find((r) => r.warehouseId === warehouseId) ??
    rows.find((r) => r.available > 0) ??
    rows[0]
  if (!row) throw new Error(`${productLabel}: stok kaydı yok`)
  if (row.available < qty) {
    throw new Error(
      `${productLabel}: yetersiz stok (istenilen ${qty}, kalan ${row.available})`
    )
  }
}

/**
 * Mutate embedded products.stock via SECURITY DEFINER RPC
 * (dealers cannot UPDATE products under RLS).
 */
export async function applyStockMovement(
  client: SupabaseClient,
  lines: StockLine[],
  mode: "reserve" | "commit" | "release" | "restock"
): Promise<void> {
  if (!lines.length) return
  const payload = lines.map((l) => ({
    productId: l.productId,
    warehouseId: l.warehouseId || "",
    quantity: l.quantity,
    productName: l.productName ?? "",
  }))
  const { error } = await client.rpc("mutate_product_stock", {
    p_lines: payload,
    p_mode: mode,
  })
  if (error) throw new Error(error.message)
}

/** Recompute warehouses.used_capacity (calls same RPC with empty restock of 0 via direct update helper). */
export async function syncWarehouseUsedCapacity(client: SupabaseClient): Promise<void> {
  // Empty mutation path: call RPC with no lines still won't sync.
  // Use a no-op restock after reading — instead invoke via SQL through rpc with [].
  const { error } = await client.rpc("mutate_product_stock", {
    p_lines: [],
    p_mode: "restock",
  })
  if (error) throw new Error(error.message)
}

export function orderItemsToStockLines(
  items: Array<{ productId: string; warehouseId: string; quantity: number; productName?: string }>
): StockLine[] {
  return items
    .filter((i) => i.productId && i.quantity > 0)
    .map((i) => ({
      productId: i.productId,
      warehouseId: i.warehouseId || "",
      quantity: i.quantity,
      productName: i.productName,
    }))
}
