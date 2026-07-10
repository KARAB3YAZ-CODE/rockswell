"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/effects/glass-card"
import { useCartStore, useSearchStore } from "@/lib/store"
import { useProducts } from "@/hooks/use-data"
import { formatPrice } from "@/lib/utils"
import {
  Search, Package, X, Clock,
  TrendingUp, Plus,
} from "lucide-react"

const suggestions = [
  { text: "Ön Fren Balatası Bosch", type: "Ürün" },
  { text: "WBA123456789", type: "VIN" },
  { text: "OEM 1234567890", type: "OEM" },
  { text: "Mercedes W206", type: "Araç" },
  { text: "8681234567890", type: "Barkod" },
]

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const { recentSearches, addRecentSearch } = useSearchStore()
  const addToCart = useCartStore((s) => s.addItem)
  const { products, loading } = useProducts()

  const handleSearch = (q: string) => {
    setQuery(q)
    if (q.trim()) addRecentSearch(q)
  }

  const results = useMemo(() => {
    if (query.length === 0) return []
    return products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()) ||
      p.brand.toLowerCase().includes(query.toLowerCase()) ||
      p.oemNumbers.some((o) => o.toLowerCase().includes(query.toLowerCase())) ||
      p.category.toLowerCase().includes(query.toLowerCase())
    )
  }, [query, products])

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
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
        {/* Search Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Arama</h1>
          <p className="text-sm text-white/40">Ürün, OEM, VIN, barcode veya marka ile arayın</p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="OEM, VIN, ürün adı, marka veya barcode girin..."
            className="w-full h-14 pl-12 pr-12 rounded-2xl bg-white/5 border border-white/10 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Quick Suggestions */}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.text}
              onClick={() => handleSearch(s.text)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-white/40 hover:text-white/70 hover:border-white/10 transition-colors"
            >
              <Badge variant="default" size="sm" className="text-[9px]">{s.type}</Badge>
              {s.text}
            </button>
          ))}
        </div>

        {query && results.length > 0 && (
          <div className="text-sm text-white/40">
            <span className="text-white font-medium">{results.length}</span> sonuç bulundu
          </div>
        )}

        {/* Recent Searches */}
        {!query && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/50 flex items-center gap-2">
              <Clock size={14} />
              Son Aramalar
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-2"
                >
                  <Clock size={12} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Suggestion */}
        {query && results.length > 0 && (
          <GlassCard intensity="light" className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">AI Önerisi</p>
              <p className="text-xs text-white/50 mt-0.5">
                &ldquo;{query}&rdquo; için en iyi sonuçlar: <span className="text-accent">{results[0]?.brand || "Bosch"}</span> marka {results[0]?.category?.toLowerCase() || "ürünler"}
              </p>
            </div>
          </GlassCard>
        )}

        {/* Results */}
        {query && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.slice(0, 24).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link href={`/products/${product.id}`}>
                  <Card hover className="group">
                    <div
                      className="relative aspect-square mb-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center bg-contain bg-center bg-no-repeat p-6"
                      style={product.images[0] ? { backgroundImage: `url(${product.images[0]})` } : undefined}
                    >
                      {!product.images[0] && <Package size={40} className="text-white/10 group-hover:text-white/20 transition-colors" />}
                      <Badge variant="premium" size="sm" className="absolute top-2 left-2">{product.brand}</Badge>
                    </div>
                    <h3 className="text-sm font-medium text-white line-clamp-2">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-lg font-bold text-white">{formatPrice(product.basePrice)}</p>
                      <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={(e) => { e.preventDefault(); addToCart({ productId: product.id, productName: product.name, sku: product.sku, brand: product.brand, image: product.images[0] || "", quantity: product.minOrderQuantity, unitPrice: product.basePrice, totalPrice: product.basePrice * product.minOrderQuantity, warehouseId: product.stock[0]?.warehouseId || "", minOrderQuantity: product.minOrderQuantity }); toast.success("Sepete eklendi") }} />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* No Results */}
        {query && results.length === 0 && (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/50 text-lg">&ldquo;{query}&rdquo; için sonuç bulunamadı</p>
            <p className="text-white/30 text-sm mt-1">Farklı bir arama terimi deneyin</p>
          </div>
        )}
      </div>
    </Shell>
  )
}
