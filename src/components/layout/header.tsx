"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import toast from "react-hot-toast"
import { cn, formatPrice } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { useUIStore, useCartStore } from "@/lib/store"
import { useDashboardStats, useProducts, useNotifications } from "@/hooks/use-data"
import { markNotificationRead, markAllNotificationsRead } from "@/lib/api"
import { decodeVin } from "@/lib/vin"
import { cartItemFromProduct, productInStock } from "@/lib/cart-item"
import type { Product } from "@/lib/types"
import {
  Search, Bell, ShoppingCart, ChevronDown, User, Settings,
  LogOut, MessageSquare, Menu, Package, Truck,
  X, Wallet, ChevronRight, Plus, Minus, Zap,
} from "lucide-react"

const dropdownVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
}

export function Header() {
  const router = useRouter()
  const { isAdmin, logout, user, company } = useAuth()
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const markAsReadLocal = useUIStore((s) => s.markAsRead)
  const addNotification = useUIStore((s) => s.addNotification)
  const notifications = useUIStore((s) => s.notifications)

  const markAsRead = (id: string) => {
    markAsReadLocal(id)
    markNotificationRead(id).catch(() => {})
  }

  const markAllRead = () => {
    notifications.forEach((n) => { if (!n.read) markAsReadLocal(n.id) })
    markAllNotificationsRead().catch(() => {})
    toast.success("Tüm bildirimler okundu")
  }
  const cartItems = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [showQuickOrder, setShowQuickOrder] = useState(false)
  const [quickSku, setQuickSku] = useState("")
  const [quickBatch, setQuickBatch] = useState<Array<{
    productId: string; productName: string; sku: string; brand: string
    image: string; quantity: number; unitPrice: number; totalPrice: number
    warehouseId: string; minOrderQuantity: number; maxOrderQuantity?: number
    priceLocked?: boolean; category?: string; vehicleBrands?: string[]
    inStock: boolean
  }>>([])
 
  const { stats } = useDashboardStats()
  const { products } = useProducts()
  const { notifications: apiNotifications } = useNotifications()

  useEffect(() => {
    if (notifications.length === 0 && apiNotifications.length > 0) {
      apiNotifications.forEach((n) => addNotification(n))
    }
  }, [apiNotifications, notifications.length, addNotification])

  const unreadCount = notifications.filter((n) => !n.read).length
  const totalCartItems = cartItems.reduce((acc, i) => acc + i.quantity, 0)
  const creditPercent = stats ? (stats.currentBalance / stats.creditLimit) * 100 : 0

  const quickResults = useMemo(() => {
    if (!quickSku.trim()) return []
    const terms = quickSku.split(",").map((t) => t.trim()).filter(Boolean)
    return products.filter((p) =>
      terms.some((t) => {
        const vin = decodeVin(t)
        if (vin?.make) {
          const make = vin.make.toLowerCase()
          return p.compatibleVehicles.some((v) =>
            v.brand.toLowerCase().includes(make) || make.includes(v.brand.toLowerCase())
          )
        }
        const ql = t.toLowerCase()
        return (
          p.name.toLowerCase().includes(ql) ||
          p.sku.toLowerCase().includes(ql) ||
          p.brand.toLowerCase().includes(ql) ||
          p.oemNumbers.some((o) => o.toLowerCase().includes(ql)) ||
          p.compatibleVehicles.some((v) => v.brand.toLowerCase().includes(ql) || v.model.toLowerCase().includes(ql))
        )
      })
    ).slice(0, 8)
  }, [products, quickSku])

  const addToQuickBatch = (product: Product) => {
    if (!productInStock(product)) {
      toast.error("Bu ürün stokta yok")
      return
    }
    setQuickBatch((prev) => {
      if (prev.some((i) => i.productId === product.id)) return prev
      return [...prev, { ...cartItemFromProduct(product), inStock: true }]
    })
    setQuickSku("")
  }

  const updateQuickBatchQty = (id: string, delta: number) => {
    setQuickBatch((prev) =>
      prev.map((item) =>
        item.productId === id
          ? { ...item, quantity: Math.max(item.minOrderQuantity, item.quantity + delta), totalPrice: item.unitPrice * Math.max(item.minOrderQuantity, item.quantity + delta) }
          : item
      )
    )
  }

  const removeFromQuickBatch = (id: string) => {
    setQuickBatch((prev) => prev.filter((i) => i.productId !== id))
  }

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-border bg-background/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="flex items-center h-14 sm:h-16 px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          aria-label="Menü"
        >
          <Menu size={20} />
        </button>

        {/* Desktop / tablet search */}
        <div className="hidden sm:block flex-1 max-w-xl min-w-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              placeholder="Ürün, OEM, VIN, marka ara…"
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
              onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) { router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`) } }}
            />
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="absolute top-full mt-2 left-0 right-0 bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  {searchQuery.length > 0 ? (
                    <SearchPreview query={searchQuery} products={products} />
                  ) : (
                    <SearchEmpty />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile search toggle */}
        <button
          type="button"
          onClick={() => setShowSearch((v) => !v)}
          className="sm:hidden w-10 h-10 shrink-0 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/50"
          aria-label="Ara"
        >
          <Search size={18} />
        </button>

        <div className="flex-1 sm:hidden" />

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {stats && (
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
              <Wallet size={16} className="text-white/40" />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-white/80">
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(stats.currentBalance)}
                  </span>
                  <span className="text-xs text-white/30">/</span>
                  <span className="text-xs text-white/40">
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(stats.creditLimit)}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(creditPercent, 100)}%`,
                      backgroundColor: creditPercent > 85 ? "#ef4444" : creditPercent > 70 ? "#f59e0b" : "#22c55e",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowQuickOrder(!showQuickOrder); setShowNotifications(false); setShowUserMenu(false) }}
              className="flex items-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 justify-center rounded-xl hover:bg-white/5 text-white/50 hover:text-white transition-colors"
              aria-label="Hızlı sipariş"
            >
              <Package size={18} />
              <span className="hidden lg:block text-xs font-medium">Hızlı Sipariş</span>
            </button>
            <AnimatePresence>
              {showQuickOrder && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-full mt-0 sm:mt-2 w-auto sm:w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(80vh,640px)] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl z-50"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                        <Zap size={10} />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Hızlı Sipariş</h4>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={quickSku}
                        onChange={(e) => setQuickSku(e.target.value)}
                        placeholder="SKU, OEM no veya ürün adı (birden fazla için virgül)"
                        className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 transition-all"
                      />
                    </div>

                    {/* Dropdown Results */}
                    {quickSku && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 rounded-xl border border-border bg-black/40 overflow-hidden max-h-60 overflow-y-auto"
                      >
                        {quickResults.length === 0 ? (
                          <div className="p-4 text-center">
                            <Package size={20} className="mx-auto text-white/10 mb-1.5" />
                            <p className="text-xs text-white/30">Sonuç bulunamadı</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {quickResults.map((product) => {
                              const inStock = product.stock.some((s) => s.available > 0)
                              const added = quickBatch.some((i) => i.productId === product.id)
                              return (
                                <div key={product.id} className="flex items-center gap-2.5 p-2.5 hover:bg-white/[0.03] transition-colors">
                                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                                    <Package size={14} className="text-white/20" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white/90 truncate">{product.name}</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-white/20 font-mono">{product.sku}</span>
                                      <span className={cn("text-[9px] font-mono", inStock ? "text-success" : "text-danger")}>
                                        {inStock ? "Stokta" : "Tükendi"}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs font-bold text-accent">{formatPrice(product.basePrice)}</p>
                                  <button
                                    onClick={() => addToQuickBatch(product)}
                                    disabled={!inStock || added}
                                    className={cn(
                                      "flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10px] font-medium transition-all",
                                      added
                                        ? "bg-success/10 text-success/60 cursor-default"
                                        : inStock
                                          ? "bg-accent text-black hover:bg-accent/90 active:scale-95"
                                          : "bg-white/5 text-white/20 cursor-not-allowed"
                                    )}
                                  >
                                    {added ? "Eklendi" : "Ekle"}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Batch Items */}
                    {quickBatch.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 rounded-xl border border-border bg-black/40 overflow-hidden"
                      >
                        <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                          {quickBatch.map((item) => (
                            <div key={item.productId} className="flex items-center gap-2.5 p-2.5">
                              <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                                <Package size={14} className="text-white/20" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white/90 truncate">{item.productName}</p>
                                <p className="text-[9px] text-white/20 font-mono">{item.sku}</p>
                              </div>
                              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                                <button
                                  onClick={() => updateQuickBatchQty(item.productId, -item.minOrderQuantity)}
                                  className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                                >
                                  <Minus size={8} />
                                </button>
                                <span className="w-7 text-center text-[10px] font-medium text-white/90 tabular-nums">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuickBatchQty(item.productId, item.minOrderQuantity)}
                                  className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                                >
                                  <Plus size={8} />
                                </button>
                              </div>
                              <p className="text-[10px] font-bold text-accent w-14 text-right tabular-nums">{formatPrice(item.totalPrice)}</p>
                              <button
                                onClick={() => removeFromQuickBatch(item.productId)}
                                className="text-white/20 hover:text-danger transition-colors"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between p-2.5 border-t border-border/50">
                          <button
                            onClick={() => setQuickBatch([])}
                            className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                          >
                            Temizle
                          </button>
                          <button
                            onClick={() => {
                              const inStock = quickBatch.filter((i) => i.inStock)
                              if (!inStock.length) {
                                toast.error("Stokta ürün yok")
                                return
                              }
                              for (const item of inStock) {
                                addItem({
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
                              setQuickBatch([])
                              setShowQuickOrder(false)
                            }}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-black text-[10px] font-bold hover:bg-accent/90 active:scale-95 transition-all"
                          >
                            <ShoppingCart size={11} />
                            Sepete Ekle ({quickBatch.length})
                          </button>
                        </div>
                      </motion.div>
                    )}

                    <p className="text-[10px] text-white/30 mt-2">
                      Birden fazla ürün için virgül kullanın
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-black text-[8px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <Link
            href="/cart"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          >
            <ShoppingCart size={18} />
            {totalCartItems > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-black text-[8px] font-bold rounded-full flex items-center justify-center">
                {totalCartItems}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                {user ? `${user.name[0]}${user.surname[0]}` : "?"}
              </div>
              <div className="hidden lg:flex lg:flex-col lg:items-end">
                <span className="text-sm text-white/70 leading-tight">{user ? `${user.name} ${user.surname}` : "Yükleniyor..."}</span>
                <span className="text-[10px] text-white/40 leading-tight">{company?.name ?? ""}</span>
              </div>
              <ChevronDown size={12} className="text-white/30" />
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="absolute top-full right-0 mt-2 w-[min(16rem,calc(100vw-1.5rem))] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-medium text-white">{user ? `${user.name} ${user.surname}` : "Kullanıcı"}</p>
                    <p className="text-xs text-white/40 mt-0.5">{user?.email ?? ""}</p>
                    {user && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="text-xs text-white/50">
                          {user.role === "purchase_manager" ? "Satın Alma Yöneticisi" :
                           user.role === "admin" ? "Admin" :
                           user.role === "company_admin" ? "Şirket Admin" : "Kullanıcı"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-1">
                    {[
                      { label: "Profil", icon: User, href: "/account" },
                      { label: "Ayarlar", icon: Settings, href: "/account/settings" },
                      { label: "Destek", icon: MessageSquare, href: "/account/support" },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <item.icon size={16} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-border p-1">
                    <button onClick={async () => { await logout(); window.location.href = "/login" }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-danger/70 hover:text-danger hover:bg-danger/5 transition-colors w-full">
                      <LogOut size={16} />
                      Çıkış Yap
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNotifications && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-4 top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-full mt-0 sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-white">Bildirimler</h3>
              <button onClick={markAllRead} className="text-xs text-accent hover:text-accent/80 transition-colors">Tümünü Oku</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="p-6 text-center">
                  <Bell size={24} className="mx-auto text-white/20 mb-2" />
                  <p className="text-sm text-white/40">Bildirim bulunmuyor</p>
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-4 border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer",
                    !n.read && "bg-accent/[0.02]"
                  )}
                  onClick={() => {
                    markAsRead(n.id)
                    if (n.link) {
                      setShowNotifications(false)
                      router.push(n.link)
                    }
                  }}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                    n.type === "success" && "bg-success/10 text-success",
                    n.type === "warning" && "bg-warning/10 text-warning",
                    n.type === "error" && "bg-danger/10 text-danger",
                    n.type === "info" && "bg-info/10 text-info",
                  )}>
                    {n.type === "success" && <Truck size={14} />}
                    {n.type === "warning" && <Package size={14} />}
                    {n.type === "error" && <X size={14} />}
                    {n.type === "info" && <Bell size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      {new Date(n.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile search sheet */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sm:hidden overflow-hidden border-t border-border bg-background"
          >
            <div className="p-3 space-y-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ürün, OEM, VIN ara…"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
                      setShowSearch(false)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/40"
                  aria-label="Kapat"
                >
                  <X size={16} />
                </button>
              </div>
              {searchQuery.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden max-h-64 overflow-y-auto">
                  <SearchPreview query={searchQuery} products={products} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function SearchPreview({ query, products }: { query: string; products: Product[] }) {
  const router = useRouter()
  const addToCart = useCartStore((s) => s.addItem)

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const ql = q.toLowerCase()
    const vin = decodeVin(q)
    if (vin?.make) {
      const make = vin.make.toLowerCase()
      const year = vin.year
      const matched = products.filter((p) =>
        p.compatibleVehicles.some((v) => {
          const brandOk =
            v.brand.toLowerCase().includes(make) || make.includes(v.brand.toLowerCase())
          if (!brandOk) return false
          if (!year) return true
          const start = v.yearStart || 0
          const end = v.yearEnd || 9999
          return year >= start && year <= end
        })
      )
      if (matched.length) return matched.slice(0, 6)
    }
    return products.filter((p) =>
      p.name.toLowerCase().includes(ql) ||
      p.sku.toLowerCase().includes(ql) ||
      p.brand.toLowerCase().includes(ql) ||
      p.category.toLowerCase().includes(ql) ||
      p.oemNumbers.some((o) => o.toLowerCase().includes(ql)) ||
      p.compatibleVehicles.some((v) =>
        v.brand.toLowerCase().includes(ql) || v.model.toLowerCase().includes(ql)
      )
    ).slice(0, 6)
  }, [query, products])

  const totalMatches = useMemo(() => {
    const q = query.toLowerCase()
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.oemNumbers.some((o) => o.toLowerCase().includes(q))
    ).length
  }, [query, products])

  return (
    <div>
      {results.length > 0 && (
        <div className="px-2 pt-2 pb-1">
          <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider px-2 mb-1">
            Ürünler ({totalMatches})
          </div>
          <div className="space-y-0.5">
            {results.map((p) => (
              <div
                key={p.id}
                className="group/item flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <Link
                  href={`/products/${p.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Package size={14} className="text-white/20" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/40 font-mono">{p.brand}</span>
                      <span className="text-[9px] text-white/20 px-1 rounded bg-white/[0.04]">{p.category}</span>
                    </div>
                    <p className="text-sm text-white/80 truncate group-hover/item:text-white transition-colors">{p.name}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-white/90">{formatPrice(p.basePrice)}</p>
                    <p className="text-[9px] text-white/30">{p.sku}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      addToCart({
                        productId: p.id,
                        productName: p.name,
                        sku: p.sku,
                        brand: p.brand,
                        image: p.images[0] || "",
                        quantity: p.minOrderQuantity,
                        unitPrice: p.basePrice,
                        totalPrice: p.basePrice * p.minOrderQuantity,
                        warehouseId: p.stock[0]?.warehouseId || "",
                        minOrderQuantity: p.minOrderQuantity,
                      })
                      toast.success(`${p.name} sepete eklendi`)
                    }}
                    className="w-7 h-7 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-black flex items-center justify-center transition-all"
                    title="Sepete Ekle"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div className="p-6 text-center">
          <Search size={24} className="mx-auto text-white/20 mb-2" />
          <p className="text-sm text-white/40">&ldquo;{query}&rdquo; için sonuç bulunamadı</p>
        </div>
      )}

      <div className={cn("border-t border-border", results.length > 0 && "mt-1")}>
        <Link
          href={`/search?q=${encodeURIComponent(query)}`}
          className="flex items-center justify-between px-4 py-2.5 text-sm text-accent hover:text-accent/80 transition-colors"
        >
          <span>Tüm sonuçları gör</span>
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function SearchEmpty() {
  return (
    <div className="p-4">
      <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-3 px-1">
        İpuçları
      </div>
      <div className="space-y-2">
        {[
          { label: "Ürün adı ile ara", desc: "Örn: fren balatası, yağ filtresi" },
          { label: "OEM numarası ile ara", desc: "Örn: 735298499" },
          { label: "VIN ile ara", desc: "17 hane · örn. WBAVB13506PT12345" },
          { label: "Marka ile ara", desc: "Örn: Bosch, Mercedes" },
        ].map((tip) => (
          <div key={tip.label} className="flex items-start gap-2.5 px-1">
            <div className="w-1 h-1 rounded-full bg-accent/50 mt-2" />
            <div>
              <p className="text-xs text-white/70">{tip.label}</p>
              <p className="text-[10px] text-white/30">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
