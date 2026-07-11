"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { VehicleBrandLogo } from "@/components/brands/vehicle-brand-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Glow } from "@/components/effects/glow"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useProducts, useOrders, useData, useDiscountRate } from "@/hooks/use-data"
import { getDashboardStats, getHomeBanners } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { roleLabel } from "@/lib/roles"
import { useCartStore, useRecentlyViewedStore } from "@/lib/store"
import { cartItemFromProduct, productInStock } from "@/lib/cart-item"
import { dealerPriceDisplay } from "@/lib/pricing"
import { formatPrice, formatDate, cn } from "@/lib/utils"
import {
  Package, ChevronRight, ArrowRight, Truck,
  Star, Percent, Sparkles,
  ShoppingBag, TrendingUp,
  Search, Zap, Grid3X3,
  CreditCard,
  Plus, CircleCheck, CircleDashed,
  Timer, MessageSquare, Clock,
  Minus, ShoppingCart, X,
} from "lucide-react"

const fallbackSlides = [
  {
    title: "Hızlı Sipariş",
    subtitle: "SKU veya OEM ile hızlıca sipariş oluşturun.",
    cta: "Ürünlere Git",
    href: "/products",
    gradient: "from-warning/20 via-warning/5 to-transparent",
    badge: "Hızlı",
    icon: Zap,
  },
  {
    title: "Siparişlerim",
    subtitle: "Sipariş durumunu takip edin.",
    cta: "Siparişler",
    href: "/orders",
    gradient: "from-info/20 via-info/5 to-transparent",
    badge: "Sipariş",
    icon: ShoppingBag,
  },
]

const quickActions = [
  { icon: Search, label: "Ürün Ara", href: "/products", color: "text-accent bg-accent/10" },
  { icon: ShoppingBag, label: "Sipariş Ver", href: "/orders", color: "text-info bg-info/10" },
  { icon: Truck, label: "Kargo Takip", href: "/orders?status=shipped", color: "text-warning bg-warning/10" },
  { icon: Percent, label: "Kampanyalar", href: "/account/campaigns", color: "text-success bg-success/10" },
  { icon: MessageSquare, label: "Destek", href: "/account/support", color: "text-[#f472b6] bg-[#f472b6]/10" },
]

export default function CustomerHomePage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [quickSearch, setQuickSearch] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [batchItems, setBatchItems] = useState<Array<{
    productId: string
    productName: string
    sku: string
    brand: string
    image: string
    quantity: number
    unitPrice: number
    totalPrice: number
    warehouseId: string
    minOrderQuantity: number
    maxOrderQuantity?: number
    priceLocked?: boolean
    category?: string
    vehicleBrands?: string[]
    inStock: boolean
  }>>([])
  const addCartItem = useCartStore((s) => s.addItem)
  const { campaigns, loading: campaignsLoading } = useCampaigns()
  const { products, loading: productsLoading } = useProducts()
  const { orders, loading: ordersLoading } = useOrders()
  const { user, company } = useAuth()
  const { data: stats } = useData(() => getDashboardStats(), [])
  const { data: homeBanners } = useData(() => getHomeBanners(), [])
  const { discountRate: companyDiscountRate } = useDiscountRate()

  const newProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [products])

  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.isFeatured).slice(0, 4)
  }, [products])

  const recentIds = useRecentlyViewedStore((s) => s.items)
  const recentlyViewed = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]))
    return recentIds.map((id) => map.get(id)).filter(Boolean).slice(0, 4) as typeof products
  }, [products, recentIds])

  const activeCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.isActive).slice(0, 3)
  }, [campaigns])

  const heroBanners = useMemo(
    () => (homeBanners ?? []).filter((b) => b.kind === "hero"),
    [homeBanners]
  )
  const promoBanners = useMemo(
    () => (homeBanners ?? []).filter((b) => b.kind === "promo").slice(0, 3),
    [homeBanners]
  )

  const slides = useMemo(() => {
    if (heroBanners.length > 0) {
      return heroBanners.map((b) => ({
        title: b.title,
        subtitle: b.subtitle,
        cta: b.cta || "İncele",
        href: b.href || "/products",
        gradient: b.gradient,
        badge: b.badge || "Banner",
        imageUrl: b.imageUrl,
        icon: Percent,
      }))
    }
    if (activeCampaigns.length > 0) {
      return activeCampaigns.map((campaign, i) => ({
        title: campaign.name,
        subtitle: campaign.description || (campaign.discountRate ? `%${campaign.discountRate} indirim fırsatı` : "Kampanyayı inceleyin."),
        cta: "Kampanyayı İncele",
        href: "/account/campaigns",
        gradient: i % 2 === 0 ? "from-accent/20 via-accent/5 to-transparent" : "from-info/20 via-info/5 to-transparent",
        badge: campaign.discountRate ? `%${campaign.discountRate}` : "Kampanya",
        imageUrl: "",
        icon: Percent,
      }))
    }
    return fallbackSlides.map((s) => ({ ...s, imageUrl: "" }))
  }, [heroBanners, activeCampaigns])

  const creditLimit = stats?.creditLimit ?? 0
  const creditUsed = stats?.creditUsed ?? stats?.currentBalance ?? 0
  const creditPercent = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0

  const brands = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      for (const v of p.compatibleVehicles) {
        set.add(v.brand)
      }
    }
    return [...set].sort()
  }, [products])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      map.set(p.category, (map.get(p.category) || 0) + 1)
    }
    return [...map.entries()].sort(([, a], [, b]) => b - a).slice(0, 6)
  }, [products])

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status === "pending_approval" || o.status === "processing" || o.status === "shipped")
  }, [orders])

  const recentOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4)
  }, [orders])

  const quickResults = useMemo(() => {
    if (!quickSearch.trim()) return []
    const q = quickSearch.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.compatibleVehicles.some((v) => v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q))
    ).slice(0, 8)
  }, [products, quickSearch])

  const addToBatch = useCallback((product: typeof products[0]) => {
    if (!productInStock(product)) {
      toast.error("Bu ürün stokta yok")
      return
    }
    setBatchItems((prev) => {
      if (prev.some((i) => i.productId === product.id)) return prev
      const line = cartItemFromProduct(product)
      return [...prev, { ...line, inStock: true }]
    })
    setQuickSearch("")
  }, [])

  const removeFromBatch = useCallback((id: string) => {
    setBatchItems((prev) => prev.filter((i) => i.productId !== id))
  }, [])

  const updateBatchQuantity = useCallback((id: string, delta: number) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.productId === id
          ? { ...item, quantity: Math.max(item.minOrderQuantity, item.quantity + delta), totalPrice: item.unitPrice * Math.max(item.minOrderQuantity, item.quantity + delta) }
          : item
      )
    )
  }, [])

  useEffect(() => {
    if (slides.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  useEffect(() => {
    setCurrentSlide((prev) => (slides.length === 0 ? 0 : prev % slides.length))
  }, [slides.length])

  return (
    <Shell>
      <div className="space-y-8 pb-8 w-full max-w-full min-w-0 overflow-x-hidden">

        {/* Hero Banner — fixed height frame; image never drives layout width */}
        <div className="relative isolate w-full max-w-full min-w-0 overflow-hidden rounded-2xl h-[200px] sm:h-[280px] lg:h-[340px] group">
          <Glow color="rgba(57, 255, 20," size={200} opacity={0.06} blur={60} className="top-1/3 left-1/4 pointer-events-none" />
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className={cn(
                "absolute inset-0 overflow-hidden bg-gradient-to-br",
                slides[currentSlide]?.gradient
              )}
              style={{ backgroundColor: "var(--card)" }}
            >
              {slides[currentSlide]?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slides[currentSlide].imageUrl}
                  alt=""
                  className="absolute inset-0 !max-w-none w-full h-full object-cover object-center pointer-events-none select-none"
                  draggable={false}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
              <div className="relative z-10 h-full flex flex-col justify-center p-5 sm:p-8 lg:p-12 min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <Badge variant="premium" className="w-fit">
                    {slides[currentSlide]?.badge === "Hızlı" ? <Zap size={12} /> : slides[currentSlide]?.badge === "Sipariş" ? <ShoppingBag size={12} /> : <Percent size={12} />}
                    {slides[currentSlide]?.badge}
                  </Badge>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white max-w-xl leading-tight line-clamp-2">
                  {slides[currentSlide]?.title}
                </h2>
                <p className="mt-2 sm:mt-3 text-white/60 max-w-lg text-sm lg:text-base leading-relaxed line-clamp-2">
                  {slides[currentSlide]?.subtitle}
                </p>
                <Link href={slides[currentSlide]?.href || "/products"} className="mt-4 sm:mt-6 w-fit max-w-full">
                  <Button size="lg" className="w-fit max-w-full group/btn">
                    <span className="truncate">{slides[currentSlide]?.cta}</span>
                    <ArrowRight size={16} className="shrink-0 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "rounded-full transition-all duration-500",
                  i === currentSlide ? "bg-accent w-8 h-2" : "bg-white/20 hover:bg-white/40 w-2 h-2"
                )}
              />
            ))}
          </div>
        </div>

        {/* Welcome + discount + credit */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch">
          <GlassCard intensity="medium" className="p-5 md:col-span-2 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/5 blur-2xl pointer-events-none" />
            <div className="relative flex items-start gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-xl font-bold text-black shadow-lg shadow-accent/25">
                {user ? `${user.name[0]}${user.surname[0]}` : "R"}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[11px] uppercase tracking-wider text-white/35 mb-1">Firma paneli</p>
                <h1 className="text-xl font-bold text-white leading-snug m-0">
                  Hoş geldin, {user?.name ?? "…"}
                </h1>
                <p className="text-sm text-white/55 mt-1 truncate">{company?.name ?? "—"}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                    <span className={cn("w-1.5 h-1.5 rounded-full", user?.isActive ? "bg-success" : "bg-white/30")} />
                    {roleLabel(user?.role)}
                  </span>
                  <Badge variant={user?.isActive ? "success" : "default"} size="sm">
                    {user?.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </div>
              <Link
                href="/account"
                className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-white/10 text-xs font-medium text-white/55 hover:text-white hover:border-accent/30 hover:bg-white/[0.03] transition-colors"
              >
                Profil
                <ChevronRight size={14} />
              </Link>
            </div>
          </GlassCard>

          <GlassCard intensity="light" className="p-5 relative overflow-hidden border-accent/20">
            <Glow color="rgba(57, 255, 20," size={120} opacity={0.1} blur={50} className="top-0 right-0" />
            <div className="relative h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">İskonto oranınız</span>
                <Percent size={15} className="text-accent/60" />
              </div>
              <p className="text-3xl font-bold text-accent tracking-tight leading-none">
                %{companyDiscountRate}
              </p>
              <p className="text-xs text-white/40 mt-auto pt-3">
                Liste fiyatına uygulanan bayi iskontosu
              </p>
            </div>
          </GlassCard>

          <GlassCard intensity="light" glow className="p-5 relative overflow-hidden">
            <Glow color="rgba(57, 255, 20," size={120} opacity={0.06} blur={50} className="top-0 right-0" />
            <div className="relative h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Kredi limiti</span>
                <CreditCard size={15} className="text-white/25" />
              </div>
              <p className="text-2xl font-bold text-white leading-none">{formatPrice(creditLimit)}</p>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs text-white/40">Kullanılan {formatPrice(creditUsed)}</span>
                <span className="text-xs text-accent font-medium">%{Math.round(creditPercent)}</span>
              </div>
              <div className="relative h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-accent to-accent/60"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, creditPercent)}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-white/30 mt-auto pt-2">
                Kalan {formatPrice(Math.max(0, creditLimit - creditUsed))}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Admin-managed promo banners — fixed height so title/CTA never clip */}
        {promoBanners.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
            {promoBanners.map((b, i) => (
              <Link
                key={b.id}
                href={b.href || "/products"}
                className="block w-full min-w-0 max-w-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "relative w-full h-[148px] sm:h-[160px] overflow-hidden rounded-2xl border border-border bg-gradient-to-br hover:border-accent/30 transition-colors group isolate",
                    b.gradient
                  )}
                  style={{ backgroundColor: "var(--card)" }}
                >
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
                      draggable={false}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
                  <div className="relative z-10 h-full flex flex-col justify-end gap-1.5 p-4 min-w-0">
                    {b.badge && (
                      <Badge variant="premium" size="sm" className="w-fit shrink-0">{b.badge}</Badge>
                    )}
                    <p className="text-sm font-bold text-white leading-snug group-hover:text-accent transition-colors line-clamp-1">
                      {b.title}
                    </p>
                    {b.subtitle ? (
                      <p className="text-xs text-white/45 leading-snug line-clamp-1">{b.subtitle}</p>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-[11px] text-accent shrink-0">
                      {b.cta || "İncele"} <ArrowRight size={12} />
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: ShoppingBag, label: "Aktif Sipariş", value: ordersLoading ? "..." : pendingOrders.length, href: "/orders", color: "from-info/20 to-info/5", iconColor: "text-info" },
            { icon: Package, label: "Stoktaki Ürün", value: productsLoading ? "..." : products.reduce((acc, p) => acc + p.stock.reduce((s, st) => s + st.available, 0), 0), href: "/products", color: "from-accent/20 to-accent/5", iconColor: "text-accent" },
            { icon: TrendingUp, label: "Toplam Sipariş", value: ordersLoading ? "..." : orders.length, href: "/orders", color: "from-warning/20 to-warning/5", iconColor: "text-warning" },
            { icon: Timer, label: "Son Sipariş", value: ordersLoading ? "..." : (recentOrders[0] ? formatDate(recentOrders[0].createdAt).slice(0, 5) : "—"), href: "/orders", color: "from-success/20 to-success/5", iconColor: "text-success" },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <Link key={stat.label} href={stat.href}
                className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br border border-white/5 hover:border-white/10 transition-all group"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div className={cn("absolute inset-0 opacity-30 rounded-xl bg-gradient-to-br", stat.color)} />
                <div className="relative">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-2", stat.iconColor, "bg-black/20")}>
                    <Icon size={16} />
                  </div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick Order */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
              <Zap size={12} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Hızlı Sipariş</h2>
              <p className="text-xs text-white/40">SKU, OEM no veya ürün adı ile sipariş verin</p>
            </div>
          </div>

          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
              <input
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="SKU, OEM no veya ürün adı (birden fazla için virgül kullanın)"
                className="w-full h-11 pl-9 pr-9 rounded-xl bg-card border border-border text-sm text-white placeholder:text-white/20 outline-none focus:border-accent/40 focus:bg-white/[0.04] transition-all"
              />
              {quickSearch && (
                <button onClick={() => setQuickSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            {quickSearch && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {quickResults.length === 0 ? (
                  <div className="p-6 text-center">
                    <Package size={24} className="mx-auto text-white/10 mb-2" />
                    <p className="text-xs text-white/30">Sonuç bulunamadı</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {quickResults.map((product) => {
                      const inStock = product.stock.some((s) => s.available > 0)
                      const alreadyAdded = batchItems.some((i) => i.productId === product.id)
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                            <Package size={16} className="text-white/20" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link href={`/products/${product.id}`} className="text-sm font-medium text-white/90 hover:text-accent transition-colors truncate block">{product.name}</Link>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-white/20 font-mono">{product.sku}</span>
                              {product.oemNumbers && product.oemNumbers.length > 0 && (
                                <>
                                  <span className="text-[10px] text-white/10">|</span>
                                  <span className="text-[10px] text-white/20 font-mono">OEM: {product.oemNumbers[0]}</span>
                                </>
                              )}
                              <span className="text-[10px] text-white/10">|</span>
                              <span className={cn("text-[10px] font-mono", inStock ? "text-success" : "text-danger")}>
                                {inStock ? `${product.stock.reduce((a, s) => a + s.available, 0)} adet` : "Tükendi"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 mr-1">
                            <p className="text-sm font-bold text-accent">{formatPrice(dealerPriceDisplay(product.basePrice, companyDiscountRate, product.customerPriceApplied).dealerPrice)}</p>
                          </div>
                          <button
                            onClick={() => addToBatch(product)}
                            disabled={!inStock || alreadyAdded}
                            className={cn(
                              "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all",
                              alreadyAdded
                                ? "bg-success/10 text-success/60 cursor-default"
                                : inStock
                                  ? "bg-accent text-black hover:bg-accent/90 active:scale-95"
                                  : "bg-white/5 text-white/20 cursor-not-allowed"
                            )}
                          >
                            <Plus size={12} />
                            {alreadyAdded ? "Eklendi" : "Ekle"}
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Batch Items List */}
            {batchItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="p-3 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-white/60">Eklenen Ürünler ({batchItems.length})</span>
                  <span className="text-xs text-white/30 font-mono">
                    {formatPrice(batchItems.reduce((t, i) => t + i.totalPrice, 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {batchItems.map((item) => (
                    <motion.div
                      key={item.productId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                        <Package size={16} className="text-white/20" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/20 font-mono">{item.sku}</span>
                          <span className={cn("text-[10px] font-mono", item.inStock ? "text-success" : "text-danger")}>
                            {item.inStock ? "Stokta" : "Tükendi"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateBatchQuantity(item.productId, -item.minOrderQuantity)}
                            className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-white/90 tabular-nums">{item.quantity}</span>
                          <button
                            onClick={() => updateBatchQuantity(item.productId, item.minOrderQuantity)}
                            className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        <p className="text-xs font-bold text-accent w-16 text-right tabular-nums">{formatPrice(item.totalPrice)}</p>
                        <button
                          onClick={() => removeFromBatch(item.productId)}
                          className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-danger transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="p-3 border-t border-border/50 flex items-center justify-between">
                  <button
                    onClick={() => setBatchItems([])}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Temizle
                  </button>
                  <button
                    onClick={() => {
                      const inStock = batchItems.filter((i) => i.inStock)
                      if (!inStock.length) {
                        toast.error("Stokta ürün yok")
                        return
                      }
                      for (const item of inStock) {
                        addCartItem({
                          productId: item.productId,
                          productName: item.productName,
                          sku: item.sku,
                          brand: item.brand,
                          image: item.image,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          totalPrice: item.totalPrice,
                          warehouseId: item.warehouseId,
                          minOrderQuantity: item.minOrderQuantity,
                          maxOrderQuantity: item.maxOrderQuantity,
                          priceLocked: item.priceLocked,
                          category: item.category,
                          vehicleBrands: item.vehicleBrands,
                        })
                      }
                      toast.success(`${inStock.length} ürün sepete eklendi`)
                      setBatchItems([])
                    }}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-black text-xs font-bold hover:bg-accent/90 active:scale-95 transition-all"
                  >
                    <ShoppingCart size={13} />
                    Sepete Ekle ({batchItems.length})
                  </button>
                </div>
              </motion.div>
            )}

            {/* Quick Actions (shown when empty) */}
            {!quickSearch && batchItems.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:bg-white/[0.04] hover:border-accent/20 transition-all group"
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", action.color)}>
                        <Icon size={18} />
                      </div>
                      <span className="text-xs text-white/60 group-hover:text-white transition-colors">{action.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Kategoriler</h2>
                <p className="text-sm text-white/40">Ürün gruplarına göz atın</p>
              </div>
              <Link href="/products/categories">
                <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {categories.map(([cat, count], i) => (
                <motion.div
                  key={cat}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/products?category=${encodeURIComponent(cat)}`}
                    className="flex flex-col items-center gap-3 p-5 rounded-xl bg-card border border-border hover:bg-white/[0.04] hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5 transition-all group text-center"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Grid3X3 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90 leading-tight">{cat}</p>
                      <p className="text-xs text-white/40 mt-0.5">{count} ürün</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Campaigns */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Aktif Kampanyalar</h2>
              <p className="text-sm text-white/40">Kaçırmayın! Size özel fırsatlar</p>
            </div>
            <Link href="/account/campaigns">
              <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
            </Link>
          </div>
          {campaignsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : activeCampaigns.length === 0 ? (
            <div className="text-center py-10 rounded-xl bg-card border border-border">
              <Percent size={32} className="mx-auto text-white/20 mb-3" />
              <p className="text-sm text-white/40">Aktif kampanya bulunmuyor</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCampaigns.map((campaign, i) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href="/account/campaigns">
                    <GlassCard intensity="light" glow className="p-5 h-full group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                            <Percent size={14} />
                          </div>
                          <Badge variant="premium" pulsing size="sm">
                            {campaign.type === "discount" ? `%${campaign.discountRate} İndirim` : "Kampanya"}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">{campaign.name}</h3>
                      <p className="text-sm text-white/50 mt-1.5 line-clamp-2 leading-relaxed">{campaign.description}</p>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                        <span className="text-xs text-white/30">
                          {campaign.usedCount}/{campaign.usageLimit || "∞"} kullanım
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <Timer size={10} />
                          {Math.ceil((campaign.endDate.getTime() - Date.now()) / 86400000)} gün kaldı
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Vehicle Brands */}
        {brands.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-info/10 text-info flex items-center justify-center">
                  <Truck size={12} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Araç Markaları</h2>
                  <p className="text-sm text-white/40">Aracınıza göre ürün bulun</p>
                </div>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {brands.map((brand, i) => (
                <motion.div
                  key={brand}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/products?vehicleBrand=${encodeURIComponent(brand)}`}
                    className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-xl bg-card border border-border hover:bg-white/[0.04] hover:border-accent/20 hover:text-accent transition-all text-sm font-medium text-white/60"
                  >
                    <VehicleBrandLogo brand={brand} size={28} className="rounded-lg p-1" />
                    {brand}
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        {recentlyViewed.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-info/10 text-info flex items-center justify-center">
                  <Clock size={12} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Son İncelenenler</h2>
                  <p className="text-sm text-white/40">Kaldığınız yerden devam edin</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {recentlyViewed.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <GlassCard intensity="light" className="p-4 h-full hover:bg-white/[0.06] transition-all">
                    <p className="text-sm font-medium text-white line-clamp-2">{product.name}</p>
                    <p className="text-[10px] text-white/30 font-mono mt-1">{product.sku}</p>
                    <p className="text-sm font-bold text-accent mt-2">{formatPrice(product.basePrice)}</p>
                  </GlassCard>
                </Link>
              ))}
            </div>
          </section>
        )}

        {featuredProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                  <Star size={12} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Öne Çıkan Ürünler</h2>
                  <p className="text-sm text-white/40">En çok tercih edilenler</p>
                </div>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/products/${product.id}`}>
                    <GlassCard intensity="light" className="p-4 h-full group hover:bg-white/[0.06] transition-all">
                      <div className="relative w-full aspect-square rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3 overflow-hidden group-hover:border-accent/20 transition-colors">
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={36} className="text-white/20 group-hover:text-accent/30 transition-colors" />
                        </div>
                        <Badge variant="premium" size="sm" className="absolute top-2 left-2">Öne Çıkan</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] text-white/30 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{product.brand}</span>
                        <span className="text-[9px] text-white/20 px-1.5 py-0.5 rounded bg-white/[0.04]">{product.category}</span>
                      </div>
                      <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{product.name}</p>
                      <p className="text-xs text-white/30 mt-0.5 font-mono">{product.sku}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <p className="text-base font-bold text-accent">{formatPrice(dealerPriceDisplay(product.basePrice, companyDiscountRate, product.customerPriceApplied).dealerPrice)}</p>
                        {product.stock[0]?.available > 0 ? (
                          <span className="flex items-center gap-1 text-[10px] text-success">
                            <span className="w-1 h-1 rounded-full bg-success" />
                            Stokta
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-danger">Tükendi</span>
                        )}
                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <section className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-info/10 text-info flex items-center justify-center">
                    <ShoppingBag size={12} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Son Siparişler</h2>
                    <p className="text-sm text-white/40">Son 4 siparişiniz</p>
                  </div>
                </div>
                <Link href="/orders">
                  <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
                </Link>
              </div>
              <div className="space-y-2">
                {recentOrders.map((order, i) => {
                  const statusMap: Record<string, { label: string; color: string; icon: typeof CircleCheck }> = {
                    delivered: { label: "Teslim Edildi", color: "text-success", icon: CircleCheck },
                    shipped: { label: "Kargoda", color: "text-info", icon: Truck },
                    processing: { label: "Hazırlanıyor", color: "text-warning", icon: Timer },
                    pending_approval: { label: "Onay Bekliyor", color: "text-white/50", icon: CircleDashed },
                    confirmed: { label: "Onaylandı", color: "text-accent", icon: CircleCheck },
                  }
                  const st = statusMap[order.status] || { label: order.status, color: "text-white/50", icon: CircleDashed }
                  const Icon = st.icon
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link href={`/orders/${order.id}`} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:bg-white/[0.04] transition-all group">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", st.color, "bg-black/20")}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-accent transition-colors">{order.orderNumber}</p>
                            <p className="text-xs text-white/40">{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{formatPrice(order.pricing.grandTotal)}</p>
                          <Badge variant={order.status === "delivered" ? "success" : order.status === "shipped" ? "info" : "default"} size="sm">{st.label}</Badge>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* New Products */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <Sparkles size={12} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Yeni Ürünler</h2>
                    <p className="text-sm text-white/40">En son eklenenler</p>
                  </div>
                </div>
                <Link href="/products">
                  <Button variant="ghost" size="sm" icon={<ChevronRight size={14} />}>Tümü</Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {newProducts.slice(0, 4).map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/products/${product.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-white/[0.04] transition-all group">
                        <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                          <Package size={16} className="text-white/30 group-hover:text-accent/50 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/90 truncate">{product.name}</p>
                          <p className="text-[10px] text-white/30 font-mono">{product.sku}</p>
                          <p className="text-xs font-bold text-accent mt-0.5">{formatPrice(dealerPriceDisplay(product.basePrice, companyDiscountRate, product.customerPriceApplied).dealerPrice)}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </Shell>
  )
}
