"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/effects/glass-card"
import { useCartStore, useSearchStore } from "@/lib/store"
import { useSearch } from "@/hooks/use-data"
import { formatPrice } from "@/lib/utils"
import {
  Search, Package, X, Clock, TrendingUp, Plus,
} from "lucide-react"

const suggestions = [
  { text: "fren balatası", type: "Ürün" },
  { text: "yağ filtresi", type: "Ürün" },
  { text: "Bosch", type: "Marka" },
  { text: "Mercedes", type: "Araç" },
]

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  )
}

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQ = searchParams.get("q") ?? ""
  const [query, setQuery] = useState(initialQ)
  const [debounced, setDebounced] = useState(initialQ)
  const { recentSearches, addRecentSearch } = useSearchStore()
  const addToCart = useCartStore((s) => s.addItem)
  const { results, loading } = useSearch(debounced)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query)
      if (query.trim()) addRecentSearch(query.trim())
    }, 350)
    return () => clearTimeout(t)
  }, [query, addRecentSearch])

  const handleSearch = (q: string) => setQuery(q)
  const showResults = debounced.trim().length > 0

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Arama</h1>
          <p className="text-sm text-white/40">Ürün, OEM, marka veya kategori ile arayın</p>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="OEM, ürün adı, marka veya kategori girin..."
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

        {showResults && !loading && (
          <div className="text-sm text-white/40">
            <span className="text-white font-medium">{results.length}</span> sonuç bulundu
          </div>
        )}

        {!showResults && recentSearches.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/50 flex items-center gap-2">
              <Clock size={14} /> Son Aramalar
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

        {loading && showResults && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {showResults && !loading && results.length > 0 && (
          <GlassCard intensity="light" className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <TrendingUp size={16} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Öne çıkan sonuç</p>
              <p className="text-xs text-white/50 mt-0.5">
                &ldquo;{debounced}&rdquo; için: <span className="text-accent">{results[0]?.brand}</span> {results[0]?.category?.toLowerCase()}
              </p>
            </div>
          </GlassCard>
        )}

        {showResults && !loading && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.slice(0, 48).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
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
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={14} />}
                        onClick={(e) => {
                          e.preventDefault()
                          addToCart({
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
                      />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {showResults && !loading && results.length === 0 && (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/50 text-lg">&ldquo;{debounced}&rdquo; için sonuç bulunamadı</p>
            <p className="text-white/30 text-sm mt-1">Farklı bir arama terimi deneyin</p>
          </div>
        )}
      </div>
    </Shell>
  )
}
