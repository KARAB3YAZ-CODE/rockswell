"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts } from "@/hooks/use-data"
import { useCompareStore, useCartStore } from "@/lib/store"
import { cn, formatPrice } from "@/lib/utils"
import type { Product } from "@/lib/types"
import {
  Package, X, ShoppingCart, Star, Truck, Plus,
  AlertTriangle, ArrowLeft,
} from "lucide-react"

const specKeys = [
  { key: "brand", label: "Marka" },
  { key: "sku", label: "SKU" },
  { key: "basePrice", label: "Fiyat" },
  { key: "category", label: "Kategori" },
  { key: "subcategory", label: "Alt Kategori" },
  { key: "stock", label: "Stok Durumu" },
  { key: "minOrderQuantity", label: "Min. Sipariş" },
  { key: "oemNumbers", label: "OEM Numaraları" },
] as const

export default function ComparePage() {
  return (
    <Suspense>
      <CompareContent />
    </Suspense>
  )
}

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ids = searchParams.get("ids")
  const compareItems = useCompareStore((s) => s.items)
  const removeCompareItem = useCompareStore((s) => s.removeItem)
  const clearCompare = useCompareStore((s) => s.clearAll)
  const addItem = useCartStore((s) => s.addItem)

  const { products, loading } = useProducts()
  const productIds = ids ? ids.split(",").filter(Boolean) : compareItems
  const compareProducts: Product[] = productIds.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => p != null)

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="w-full aspect-square rounded-xl mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-6 w-1/3 mb-1" />
                <Skeleton className="h-3 w-1/2 mb-3" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Ürün Karşılaştırma</h1>
              <p className="text-sm text-white/40">{compareProducts.length} ürün karşılaştırılıyor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { clearCompare(); router.push("/products") }}>
              Temizle
            </Button>
            <Link href="/products/categories">
              <Button variant="ghost" size="sm" icon={<Package size={14} />}>
                Kategoriler
              </Button>
            </Link>
          </div>
        </div>

        {compareProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/50 mb-2">Karşılaştırılacak ürün seçilmedi</p>
            <Link href="/products" className="text-accent text-sm hover:underline">Ürünlere Git</Link>
          </div>
        ) : compareProducts.length < 2 && compareProducts.length > 0 ? (
          <div className="text-center py-20">
            <AlertTriangle size={48} className="mx-auto text-warning/50 mb-4" />
            <p className="text-white/50 mb-2">Karşılaştırma için en az 2 ürün seçmelisiniz</p>
            <Link href="/products" className="text-accent text-sm hover:underline">Ürünlere Git</Link>
          </div>
        ) : (
          <>
            {/* Product Cards Header */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {compareProducts.slice(0, 4).map((product, i) => {
                const totalStock = product.stock.reduce((acc, s) => acc + s.available, 0)
                const listPrice = product.basePrice * 1.25
                const discountPercent = Math.round((1 - product.basePrice / listPrice) * 100)
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <GlassCard intensity="light" className="p-4 relative h-full">
                      <button
                        onClick={() => {
                          removeCompareItem(product.id)
                          if (compareItems.length <= 2) {
                            clearCompare()
                          }
                          toast.success("Karşılaştırmadan çıkarıldı")
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-danger hover:bg-white/5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                      <Link href={`/products/${product.id}`}>
                        <div className="w-full aspect-square rounded-xl bg-card border border-white/5 overflow-hidden bg-contain bg-center bg-no-repeat mb-3" style={{ backgroundImage: `url(${product.images[0]})` }} />
                        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug mb-1">{product.name}</h3>
                        <div className="flex items-baseline gap-1.5 mb-1">
                          <span className="text-lg font-bold text-accent">{formatPrice(product.basePrice)}</span>
                          <span className="text-[10px] text-white/30">Bayi</span>
                        </div>
                        <p className="text-[11px] text-white/30 line-through mb-2">{formatPrice(listPrice)}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="success" size="sm">%{discountPercent}</Badge>
                          <span className={cn("text-[11px] font-medium", totalStock >= 10 ? "text-success" : "text-warning")}>
                            {totalStock >= 10 ? "Stokta" : "Sınırlı Stok"} ({totalStock})
                          </span>
                        </div>
                      </Link>
                      <Button
                        size="sm"
                        className="w-full mt-3"
                        icon={<ShoppingCart size={14} />}
                        onClick={() => {
                          addItem({
                            productId: product.id,
                            productName: product.name,
                            sku: product.sku,
                            brand: product.brand,
                            image: product.images[0] || "",
                            quantity: product.minOrderQuantity,
                            unitPrice: product.basePrice,
                            totalPrice: product.basePrice * product.minOrderQuantity,
                            warehouseId: product.stock[0]?.warehouseId || "",
                            minOrderQuantity: product.minOrderQuantity,
                          })
                          toast.success("Sepete eklendi")
                        }}
                      >
                        Sepete Ekle
                      </Button>
                    </GlassCard>
                  </motion.div>
                )
              })}
            </div>

            {/* Comparison Table */}
            <GlassCard intensity="light" className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {specKeys.map(({ key, label }) => {
                      const values = compareProducts.slice(0, 4).map((p) => {
                        if (key === "brand") return p.brand
                        if (key === "sku") return p.sku
                        if (key === "basePrice") return formatPrice(p.basePrice)
                        if (key === "category") return p.category
                        if (key === "subcategory") return p.subcategory || "—"
                        if (key === "stock") {
                          const stock = p.stock.reduce((acc, s) => acc + s.available, 0)
                          return (
                            <span className={cn("font-medium", stock >= 10 ? "text-success" : "text-warning")}>
                              {stock >= 10 ? "Stokta" : "Sınırlı Stok"} ({stock})
                            </span>
                          )
                        }
                        if (key === "minOrderQuantity") return `${p.minOrderQuantity} adet`
                        if (key === "oemNumbers") return p.oemNumbers.length > 0 ? p.oemNumbers.slice(0, 3).join(", ") : "—"
                        return "—"
                      })
                      return (
                        <tr key={key} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 text-white/50 font-medium w-40 border-r border-border">{label}</td>
                          {values.map((v, i) => (
                            <td key={i} className="px-4 py-3 text-white/80 min-w-[160px]">
                              {v}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* OEM Comparison */}
            <GlassCard intensity="light" className="p-4">
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">OEM Karşılaştırması</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {compareProducts.slice(0, 4).map((product) => (
                  <div key={product.id}>
                    <p className="text-xs text-white/50 mb-2 truncate">{product.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {product.oemNumbers.slice(0, 5).map((oem) => (
                        <span key={oem} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-mono text-white/40">{oem}</span>
                      ))}
                      {product.oemNumbers.length === 0 && (
                        <span className="text-[11px] text-white/30">OEM bilgisi yok</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </Shell>
  )
}
