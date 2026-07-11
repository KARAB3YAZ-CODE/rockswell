"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts, useDiscountRate } from "@/hooks/use-data"
import { dealerPriceDisplay } from "@/lib/pricing"
import { useCartStore } from "@/lib/store"
import { cn, formatPrice } from "@/lib/utils"
import {
  Package, Star, Truck,
  Plus, Grid3X3, List, Clock, ChevronLeft,
} from "lucide-react"

export default function FrequentPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const { products, loading } = useProducts()
  const { discountRate: companyRate } = useDiscountRate()
  const addItem = useCartStore((s) => s.addItem)

  const frequent = products
    .filter((p) => p.isFeatured || p.stock[0]?.available! >= 50)
    .sort((a, b) => (b.stock[0]?.available || 0) - (a.stock[0]?.available || 0))
    .slice(0, 24)

  const perPage = 12
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.ceil(frequent.length / perPage)
  const paginated = frequent.slice((currentPage - 1) * perPage, currentPage * perPage)

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
            <p className="text-sm text-white/40">En sık sipariş edilen {products.length} ürün</p>
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
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
          )}>
            {paginated.map((product, i) => {
              const totalStock = product.stock.reduce((acc, s) => acc + s.available, 0)
              const { listPrice, dealerPrice, discountRate } = dealerPriceDisplay(
                product.basePrice,
                companyRate,
                product.customerPriceApplied
              )
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % perPage) * 0.02 }}
                >
                  {viewMode === "list" ? (
                    <Link href={`/products/${product.id}`} className="block">
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:bg-card-hover transition-all group">
                        <div className="w-16 h-16 rounded-xl bg-card shrink-0 border border-white/5 overflow-hidden bg-contain bg-center bg-no-repeat p-1.5" style={{ backgroundImage: `url(${product.images[0]})` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/30 font-mono">{product.sku}</span>
                            <Badge size="sm" variant="premium">{product.brand}</Badge>
                            {product.oemNumbers.length > 0 && (
                              <span className="text-[10px] text-white/20 font-mono">OEM: {product.oemNumbers[0]}</span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-white mt-0.5 truncate">{product.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-sm font-semibold text-accent">{formatPrice(dealerPrice)}</p>
                            <p className="text-xs text-white/30 line-through">{formatPrice(listPrice)}</p>
                            <Badge variant="success" size="sm">%{discountRate}</Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-xs text-white/30">Min: {product.minOrderQuantity} adet</p>
                          <p className={cn("text-xs font-medium", totalStock >= 10 ? "text-success" : "text-warning")}>
                            {totalStock >= 10 ? "Stokta" : "Sınırlı Stok"} ({totalStock})
                          </p>
                        </div>
                        <Button size="sm" onClick={(e) => { e.preventDefault(); addItem({ productId: product.id, productName: product.name, sku: product.sku, brand: product.brand, image: product.images[0] || "", quantity: product.minOrderQuantity, unitPrice: product.basePrice, totalPrice: product.basePrice * product.minOrderQuantity, warehouseId: product.stock[0]?.warehouseId || "", minOrderQuantity: product.minOrderQuantity, priceLocked: product.customerPriceApplied, category: product.category, vehicleBrands: product.compatibleVehicles.map((v) => v.brand) }); toast.success(`${product.name} sepete eklendi`) }} icon={<Plus size={14} />} />
                      </div>
                    </Link>
                  ) : (
                    <Link href={`/products/${product.id}`} className="block">
                      <Card hover className="group">
                        <div className="relative aspect-square mb-4 rounded-xl bg-card border border-white/5 overflow-hidden">
                          <div className="w-full h-full bg-contain bg-center bg-no-repeat p-3" style={{ backgroundImage: `url(${product.images[0]})` }} />
                          {product.isFeatured && (
                            <Badge variant="premium" size="sm" className="absolute top-2 left-2">
                              <Star size={10} />
                              Öne Çıkan
                            </Badge>
                          )}
                          <Badge variant="success" size="sm" className="absolute bottom-2 left-2">
                            %{discountRate} İndirim
                          </Badge>
                          <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge size="sm" variant="premium">{product.brand}</Badge>
                            <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>
                          </div>
                          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">{product.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Truck size={12} className={totalStock >= 10 ? "text-success" : "text-warning"} />
                            <span className={cn("font-medium", totalStock >= 10 ? "text-success" : "text-warning")}>
                              {totalStock >= 10 ? "Stokta" : "Sınırlı Stok"}
                            </span>
                            <span className="text-white/30">({totalStock} adet)</span>
                          </div>
                          <div className="text-xs text-white/30">Min. Sipariş: {product.minOrderQuantity} adet</div>
                          <div className="flex items-center justify-between pt-2">
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <p className="text-lg font-bold text-accent">{formatPrice(dealerPrice)}</p>
                                <span className="text-[10px] text-white/30">Bayi</span>
                              </div>
                              <p className="text-[11px] text-white/30 line-through">{formatPrice(listPrice)}</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); addItem({ productId: product.id, productName: product.name, sku: product.sku, brand: product.brand, image: product.images[0] || "", quantity: product.minOrderQuantity, unitPrice: product.basePrice, totalPrice: product.basePrice * product.minOrderQuantity, warehouseId: product.stock[0]?.warehouseId || "", minOrderQuantity: product.minOrderQuantity, priceLocked: product.customerPriceApplied, category: product.category, vehicleBrands: product.compatibleVehicles.map((v) => v.brand) }); toast.success(`${product.name} sepete eklendi`) }} icon={<Plus size={14} />} />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...")
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-white/20">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-medium transition-all",
                      currentPage === p ? "bg-accent text-black" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>
    </Shell>
  )
}
