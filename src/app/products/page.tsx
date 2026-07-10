"use client"

import { useState, Suspense, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { GlassCard } from "@/components/effects/glass-card"
import { useProducts } from "@/hooks/use-data"
import { useCartStore } from "@/lib/store"
import { cn, formatPrice } from "@/lib/utils"
import type { Product } from "@/lib/types"
import {
  Search, Grid3X3, List, ChevronDown,
  Heart, Package, Star, Truck,
  Filter, ChevronLeft, ChevronRight,
  Plus, FileText,
} from "lucide-react"

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsContent />
    </Suspense>
  )
}

function ProductsContent() {
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => {
    const b = searchParams.get("brand")
    return b ? [b] : []
  })
  const [selectedVehicleBrands, setSelectedVehicleBrands] = useState<string[]>(() => {
    const v = searchParams.get("vehicleBrand")
    return v ? [v] : []
  })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => searchParams.get("category") || null)
  const [sortBy, setSortBy] = useState("name")
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const { products, loading } = useProducts()
  const addItem = useCartStore((s) => s.addItem)
  const perPage = 12

  const categories = [...new Set(products.map(p => p.category))]
  const brands = [...new Set(products.map(p => p.brand))]
  const vehicleBrands = [...new Set(products.flatMap(p => p.compatibleVehicles.map(v => v.brand)))]

  const filtered = products.filter((p) => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.sku.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false
    if (selectedCategory && p.category !== selectedCategory) return false
    if (selectedVehicleBrands.length > 0 && !selectedVehicleBrands.some(v => p.compatibleVehicles.some(cv => cv.brand === v))) return false
    return true
  })

  filtered.sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name)
    if (sortBy === "price_asc") return a.basePrice - b.basePrice
    if (sortBy === "price_desc") return b.basePrice - a.basePrice
    if (sortBy === "stock") return (b.stock[0]?.available || 0) - (a.stock[0]?.available || 0)
    return 0
  })

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage)

  return (
    <Shell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Ürün Kataloğu</h1>
            <p className="text-sm text-white/40">{filtered.length} ürün bulundu</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Filter size={14} />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filtrele
            </Button>
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
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 px-3 pr-8 rounded-xl bg-white/5 border border-white/10 text-white text-xs appearance-none focus:outline-none focus:border-accent/40"
              >
                <option value="name">Ad</option>
                <option value="price_asc">Fiyat (Düşük)</option>
                <option value="price_desc">Fiyat (Yüksek)</option>
                <option value="stock">Stok</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            placeholder="Ürün adı, SKU, OEM veya marka ile ara..."
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
          />
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 260 }}
                exit={{ opacity: 0, width: 0 }}
                className="shrink-0 overflow-hidden"
              >
                <div className="w-[260px] space-y-4">
                  <GlassCard intensity="light" className="p-4">
                    <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Kategori</h3>
                    <div className="space-y-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                            selectedCategory === cat ? "bg-accent/10 text-accent" : "text-white/50 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard intensity="light" className="p-4">
                    <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Marka</h3>
                    <div className="space-y-1.5">
                      {brands.map((brand) => (
                        <label key={brand} className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() => {
                              setSelectedBrands((prev) =>
                                prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
                              )
                            }}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30"
                          />
                          <span className="text-sm text-white/60 group-hover:text-white transition-colors">{brand}</span>
                        </label>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard intensity="light" className="p-4">
                    <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Araç Markası</h3>
                    <div className="space-y-1 max-h-[240px] overflow-y-auto">
                      {vehicleBrands.map((vbrand) => (
                        <label key={vbrand} className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedVehicleBrands.includes(vbrand)}
                            onChange={() => {
                              setSelectedVehicleBrands((prev) =>
                                prev.includes(vbrand) ? prev.filter((b) => b !== vbrand) : [...prev, vbrand]
                              )
                            }}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30"
                          />
                          <span className="text-sm text-white/60 group-hover:text-white transition-colors">{vbrand}</span>
                        </label>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                    <Skeleton className="aspect-square rounded-xl w-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex justify-between items-center pt-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-20">
                <Package size={48} className="mx-auto text-white/20 mb-4" />
                <p className="text-white/50">Ürün bulunamadı</p>
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
              )}>
                {paginated.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i % perPage) * 0.02 }}
                  >
            <ProductCard product={product} viewMode={viewMode} onAddToCart={() => {
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
              toast.success(`${product.name} sepete eklendi`)
            }} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {(() => {
                  const pages: (number | "...")[] = []
                  const range = 1
                  pages.push(1)
                  if (currentPage - range > 2) pages.push("...")
                  for (let i = Math.max(2, currentPage - range); i <= Math.min(totalPages - 1, currentPage + range); i++) {
                    pages.push(i)
                  }
                  if (currentPage + range < totalPages - 1) pages.push("...")
                  if (totalPages > 1) pages.push(totalPages)
                  return pages.map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-white/20">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-medium transition-all",
                          currentPage === p ? "bg-accent text-black" : "text-white/40 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )
                })()}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

function ProductCard({ product, viewMode, onAddToCart }: { product: Product; viewMode: "grid" | "list"; onAddToCart: () => void }) {
  const totalStock = product.stock.reduce((acc, s) => acc + s.available, 0)
  const listPrice = product.basePrice * 1.25
  const discountPercent = Math.round((1 - product.basePrice / listPrice) * 100)

  if (viewMode === "list") {
    return (
      <Link href={`/products/${product.id}`} className="block">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:bg-card-hover transition-all group">
          <div className="w-16 h-16 rounded-xl bg-card shrink-0 border border-white/5 overflow-hidden bg-contain bg-center bg-no-repeat p-1.5" style={{ backgroundImage: `url(${product.images[0]})` }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30 font-mono">{product.sku}</span>
              <Badge size="sm" variant="premium">{product.brand}</Badge>
              {product.compatibleVehicles.slice(0, 3).map((v) => (
                <span key={v.brand} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">{v.brand}</span>
              ))}
              {product.compatibleVehicles.length > 3 && (
                <span className="text-[10px] text-white/20 font-mono">+{product.compatibleVehicles.length - 3}</span>
              )}
              {product.oemNumbers.length > 0 && (
                <span className="text-[10px] text-white/20 font-mono">OEM: {product.oemNumbers[0]}</span>
              )}
            </div>
            <h3 className="text-sm font-medium text-white mt-0.5 truncate">{product.name}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-sm font-semibold text-accent">{formatPrice(product.basePrice)}</p>
              <p className="text-xs text-white/30 line-through">{formatPrice(listPrice)}</p>
              <Badge variant="success" size="sm">%{discountPercent}</Badge>
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <p className="text-xs text-white/30">Min: {product.minOrderQuantity} adet</p>
            <p className={cn("text-xs font-medium", totalStock >= 10 ? "text-success" : "text-warning")}>
              {totalStock >= 10 ? "Stokta" : "Sınırlı Stok"} ({totalStock})
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={(e) => { e.preventDefault(); onAddToCart() }} icon={<Plus size={14} />} />
            <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); toast.success("Teklif talebiniz alındı, müşteri temsilciniz sizinle iletişime geçecek.") }} icon={<FileText size={14} />}>
              Teklif İste
            </Button>
          </div>
        </div>
      </Link>
    )
  }

  return (
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
          <button
            onClick={(e) => { e.preventDefault(); toast.success("Favorilere eklendi") }}
            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-danger transition-colors"
          >
            <Heart size={14} />
          </button>
          <Badge variant="success" size="sm" className="absolute bottom-2 left-2">
            %{discountPercent} İndirim
          </Badge>
          <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge size="sm" variant="premium">{product.brand}</Badge>
            <span className="text-[10px] text-white/30 font-mono">{product.sku}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {product.compatibleVehicles.slice(0, 4).map((v) => (
              <span key={v.brand} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 font-mono">{v.brand}</span>
            ))}
            {product.compatibleVehicles.length > 4 && (
              <span className="text-[9px] text-white/20 font-mono">+{product.compatibleVehicles.length - 4}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">{product.name}</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <Truck size={12} className={totalStock >= 10 ? "text-success" : "text-warning"} />
            <span className={cn("font-medium", totalStock >= 10 ? "text-success" : "text-warning")}>
              {totalStock >= 10 ? "Stokta" : "Sınırlı Stok"}
            </span>
            <span className="text-white/30">({totalStock} adet)</span>
          </div>
          <div className="text-xs text-white/30">
            Min. Sipariş: {product.minOrderQuantity} adet
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <p className="text-lg font-bold text-accent">{formatPrice(product.basePrice)}</p>
                <span className="text-[10px] text-white/30">Bayi</span>
              </div>
              <p className="text-[11px] text-white/30 line-through">{formatPrice(listPrice)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => { e.preventDefault(); onAddToCart() }}
                icon={<Plus size={14} />}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); toast.success("Teklif talebiniz alındı") }}
                icon={<FileText size={14} />}
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
