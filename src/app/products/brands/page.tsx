"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { useMemo } from "react"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { VehicleBrandLogo } from "@/components/brands/vehicle-brand-logo"
import { useProducts } from "@/hooks/use-data"
import {
  ChevronRight,
} from "lucide-react"

export default function BrandsPage() {
  const { products, loading } = useProducts()

  const vehicleBrands = useMemo(() =>
    [...new Set(products.flatMap((p) => p.compatibleVehicles.map(v => v.brand)))].sort(),
    [products]
  )

  const brandCounts = useMemo(() =>
    Object.fromEntries(vehicleBrands.map(b => [b, products.filter(p => p.compatibleVehicles.some(v => v.brand === b)).length])),
    [vehicleBrands, products]
  )

  const brandCategories = useMemo(() => {
    const cats: Record<string, string[]> = {}
    for (const b of vehicleBrands) {
      const uniqueCats = [...new Set(products.filter(p => p.compatibleVehicles.some(v => v.brand === b)).map(p => p.category))]
      cats[b] = uniqueCats.sort()
    }
    return cats
  }, [vehicleBrands, products])

  const productBrands = useMemo(() =>
    [...new Set(products.map(p => p.brand))].sort(),
    [products]
  )

  const productBrandCounts = useMemo(() =>
    Object.fromEntries(productBrands.map(b => [b, products.filter(p => p.brand === b).length])),
    [productBrands, products]
  )

  const sorted = useMemo(() =>
    [...vehicleBrands].sort((a, b) => brandCounts[b] - brandCounts[a]),
    [vehicleBrands, brandCounts]
  )

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6">
          <div>
            <Skeleton variant="text" className="w-48 h-8 mb-2" />
            <Skeleton variant="text" className="w-32 h-4" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" className="w-28 h-10 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Markalar</h1>
          <p className="text-sm text-white/40">{vehicleBrands.length} araç markası, {products.length} ürün</p>
        </div>

        {/* Ürün Markaları */}
        {productBrands.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-white/70 mb-3">Ürün Markaları</h2>
            <div className="flex flex-wrap gap-2">
              {productBrands.map((b) => (
                <Link key={b} href={`/products?brand=${encodeURIComponent(b)}`}>
                  <GlassCard intensity="light" className="px-4 py-2 hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{b}</span>
                      <Badge variant="premium" size="sm">{productBrandCounts[b]}</Badge>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Araç Markaları */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Araç Markaları</h2>
            <span className="text-xs text-white/30">{vehicleBrands.length} marka</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((b, i) => {
              const cats = brandCategories[b] || []
              return (
                <motion.div
                  key={b}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link href={`/products?vehicleBrand=${encodeURIComponent(b)}`}>
                    <GlassCard intensity="light" className="p-4 hover:border-accent/30 transition-all h-full group">
                      <div className="flex items-start justify-between mb-3">
                        <VehicleBrandLogo brand={b} size={52} />
                        <Badge variant="premium" size="sm">{brandCounts[b]} ürün</Badge>
                      </div>
                      <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">{b}</h3>
                      <p className="text-[11px] text-white/30 mt-1 line-clamp-2">
                        {cats.slice(0, 4).join(", ")}
                        {cats.length > 4 && ` +${cats.length - 4}`}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-accent text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Ürünleri Görüntüle</span>
                        <ChevronRight size={12} />
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </Shell>
  )
}
