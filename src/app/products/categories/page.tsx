"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useProducts } from "@/hooks/use-data"
import {
  Package, ChevronRight, Grid3X3, List,
} from "lucide-react"

export default function CategoriesPage() {
  const { products, loading } = useProducts()
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products])
  const categoryCounts = useMemo(
    () => Object.fromEntries(categories.map(c => [c, products.filter(p => p.category === c).length])),
    [categories, products]
  )
  const subcategoriesByCategory = useMemo(() => {
    const result: Record<string, { name: string; count: number }[]> = {}
    for (const c of categories) {
      const subs = products.filter(p => p.category === c).reduce((acc, p) => {
        if (p.subcategory) {
          const existing = acc.find(s => s.name === p.subcategory)
          if (existing) existing.count++
          else acc.push({ name: p.subcategory, count: 1 })
        }
        return acc
      }, [] as { name: string; count: number }[])
      subs.sort((a, b) => b.count - a.count)
      result[c] = subs
    }
    return result
  }, [categories, products])

  const sorted = useMemo(
    () => [...categories].sort((a, b) => categoryCounts[b] - categoryCounts[a]),
    [categories, categoryCounts]
  )

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton variant="text" width={180} height={28} />
              <Skeleton variant="text" width={120} height={16} />
            </div>
            <div className="flex gap-1">
              <Skeleton variant="rectangular" width={36} height={36} />
              <Skeleton variant="rectangular" width={36} height={36} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton variant="rectangular" width={40} height={40} className="rounded-xl" />
                  <Skeleton variant="text" width={60} height={22} />
                </div>
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="50%" height={14} />
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
          <div>
            <h1 className="text-2xl font-bold text-white">Kategoriler</h1>
            <p className="text-sm text-white/40">{products.length} ürün, {categories.length} kategori</p>
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

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((cat, i) => {
              const subs = subcategoriesByCategory[cat] || []
              return (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/products?category=${encodeURIComponent(cat)}`}>
                    <GlassCard intensity="light" className="p-5 hover:border-accent/30 transition-all group h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Package size={20} className="text-accent" />
                        </div>
                        <Badge variant="premium" size="sm">{categoryCounts[cat]} ürün</Badge>
                      </div>
                      <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">{cat}</h3>
                      <p className="text-xs text-white/30 mt-1 line-clamp-2">
                        {subs.slice(0, 3).map((s) => s.name).join(", ")}
                      </p>
                      <div className="flex items-center gap-1 mt-3 text-accent text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Kategoriyi Görüntüle</span>
                        <ChevronRight size={12} />
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((cat) => {
              const subs = subcategoriesByCategory[cat] || []
              return (
                <Link key={cat} href={`/products?category=${encodeURIComponent(cat)}`}>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:bg-card-hover hover:border-accent/20 transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Package size={20} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white group-hover:text-accent transition-colors">{cat}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/30">{categoryCounts[cat]} ürün</span>
                        {subs.length > 0 && (
                          <>
                            <span className="text-white/10">·</span>
                            <span className="text-xs text-white/20 truncate">{subs.slice(0, 3).map((s) => s.name).join(", ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-white/20 group-hover:text-accent/60 transition-colors shrink-0" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
