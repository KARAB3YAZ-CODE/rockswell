"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts, useDiscountRate, useOrders } from "@/hooks/use-data"
import { dealerPriceDisplay } from "@/lib/pricing"
import { cartItemFromProduct, productInStock } from "@/lib/cart-item"
import { useCartStore } from "@/lib/store"
import { cn, formatPrice } from "@/lib/utils"
import {
  Package, Star, Truck,
  Plus, Grid3X3, List, Clock, ChevronLeft,
} from "lucide-react"

const COUNTED_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"])

export default function FrequentPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const { products, loading: productsLoading } = useProducts()
  const { orders, loading: ordersLoading } = useOrders()
  const { discountRate: companyRate } = useDiscountRate()
  const addItem = useCartStore((s) => s.addItem)
  const loading = productsLoading || ordersLoading

  const frequent = useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders) {
      if (!COUNTED_STATUSES.has(order.status)) continue
      for (const item of order.items) {
        counts.set(item.productId, (counts.get(item.productId) ?? 0) + item.quantity)
      }
    }
    const byId = new Map(products.map((p) => [p.id, p]))
    const fromHistory = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .slice(0, 24) as typeof products

    if (fromHistory.length > 0) return fromHistory

    return products
      .filter((p) => p.isFeatured || (p.stock[0]?.available ?? 0) >= 50)
      .sort((a, b) => (b.stock[0]?.available || 0) - (a.stock[0]?.available || 0))
      .slice(0, 24)
  }, [orders, products])

  const perPage = 12
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.ceil(frequent.length / perPage)
  const paginated = frequent.slice((currentPage - 1) * perPage, currentPage * perPage)

  const add = (product: (typeof products)[0]) => {
    if (!productInStock(product)) {
      toast.error("Stokta yok")
      return
    }
    addItem(cartItemFromProduct(product))
    toast.success(`${product.name} sepete eklendi`)
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Sık Sipariş Edilenler</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                <Clock size={12} />
                Sık
              </div>
            </div>
            <p className="text-sm text-white/40">
              Sipariş geçmişinize göre en çok aldığınız {frequent.length} ürün
            </p>
          </div>
          <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-accent/10 text-accent" : "text-white/30 hover:text-white/60")}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-2 transition-colors", viewMode === "list" ? "bg-accent/10 text-accent" : "text-white/30 hover:text-white/60")}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={360} />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/50">Henüz sipariş edilen ürün bulunmuyor</p>
            <Link href="/products" className="inline-block mt-4 text-sm text-accent hover:underline">
              Kataloga git
            </Link>
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
          )}>
            {paginated.map((product, i) => {
              const price = dealerPriceDisplay(product.basePrice, companyRate, product.customerPriceApplied)
              const inStock = productInStock(product)
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {viewMode === "grid" ? (
                    <Link href={`/products/${product.id}`}>
                      <Card className="p-4 h-full hover:border-accent/30 transition-colors group">
                        <div
                          className="relative aspect-square mb-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center bg-contain bg-center bg-no-repeat p-6"
                          style={product.images[0] ? { backgroundImage: `url(${product.images[0]})` } : undefined}
                        >
                          {!product.images[0] && <Package size={40} className="text-white/10" />}
                          <Badge variant="premium" size="sm" className="absolute top-2 left-2">{product.brand}</Badge>
                          {product.isFeatured && (
                            <div className="absolute top-2 right-2 text-warning"><Star size={14} fill="currentColor" /></div>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2">{product.name}</h3>
                        <p className="text-[10px] text-white/30 font-mono mt-1">{product.sku}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div>
                            {!price.priceLocked && (
                              <p className="text-[10px] text-white/30 line-through">{formatPrice(price.listPrice)}</p>
                            )}
                            <p className="text-lg font-bold text-white">{formatPrice(price.dealerPrice)}</p>
                          </div>
                          <Button
                            size="sm"
                            disabled={!inStock}
                            onClick={(e) => { e.preventDefault(); add(product) }}
                            icon={<Plus size={14} />}
                          />
                        </div>
                        <p className={cn("text-[10px] mt-2", inStock ? "text-success" : "text-danger")}>
                          {inStock ? <><Truck size={10} className="inline mr-1" />Stokta</> : "Tükendi"}
                        </p>
                      </Card>
                    </Link>
                  ) : (
                    <Link href={`/products/${product.id}`}>
                      <Card className="p-4 flex items-center gap-4 hover:border-accent/30 transition-colors">
                        <div
                          className="w-16 h-16 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center bg-contain bg-center bg-no-repeat shrink-0"
                          style={product.images[0] ? { backgroundImage: `url(${product.images[0]})` } : undefined}
                        >
                          {!product.images[0] && <Package size={24} className="text-white/10" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-white truncate">{product.name}</h3>
                          <p className="text-[10px] text-white/30 font-mono">{product.sku} · {product.brand}</p>
                        </div>
                        <p className="text-sm font-bold text-accent tabular-nums">{formatPrice(price.dealerPrice)}</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!inStock}
                          onClick={(e) => { e.preventDefault(); add(product) }}
                          icon={<Plus size={14} />}
                        />
                      </Card>
                    </Link>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-white/40">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/5 disabled:opacity-30 rotate-180"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>
    </Shell>
  )
}
