"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { useProducts, useOrders, useWarehouses, useData } from "@/hooks/use-data"
import { useAuth } from "@/lib/auth"
import {
  getAdminStats, getAllUsers, getAllCompanies, getAllCampaigns,
  createCampaign, setCampaignActive, setProductActive, updateOrderStatus,
} from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { formatPrice, formatDate, cn } from "@/lib/utils"
import type { Order } from "@/lib/types"
import {
  Users, Building2, Package, ShoppingBag,
  Settings, BarChart3, Activity, DollarSign,
  Warehouse, Percent, TrendingUp, ChevronRight, Search,
  Eye, Plus, CheckCircle, XCircle, Truck, X,
  KeyRound, Copy, Check,
} from "lucide-react"

const adminTabs = [
  { key: "overview", label: "Genel Bakış", icon: Activity },
  { key: "users", label: "Kullanıcılar", icon: Users },
  { key: "companies", label: "Şirketler", icon: Building2 },
  { key: "products", label: "Ürünler", icon: Package },
  { key: "orders", label: "Siparişler", icon: ShoppingBag },
  { key: "warehouses", label: "Depolar", icon: Warehouse },
  { key: "campaigns", label: "Kampanyalar", icon: Percent },
]

const roleLabels: Record<string, string> = {
  admin: "Yönetici",
  purchase_manager: "Satın Alma Yöneticisi",
  sales_manager: "Satış Yöneticisi",
  warehouse_user: "Depo Kullanıcısı",
  finance_user: "Finans Kullanıcısı",
  company_admin: "Firma Yöneticisi",
}

const orderStatusLabels: Record<string, string> = {
  draft: "Ödeme Bekliyor",
  pending_approval: "Onay Bekliyor",
  approved: "Onaylandı",
  quotation: "Teklif",
  confirmed: "Onaylandı",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
  returned: "İade",
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminGuarded />
    </Suspense>
  )
}

function AdminGuarded() {
  const { isAdmin, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab") ?? "overview"
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    setActiveTab(searchParams.get("tab") ?? "overview")
  }, [searchParams])

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/home")
  }, [loading, isAdmin, router])

  if (loading || !isAdmin) {
    return (
      <Shell>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="flex gap-6">
        <div className={cn("shrink-0 transition-all duration-300", sidebarCollapsed ? "w-16" : "w-60")}>
          <div className="sticky top-24 rounded-2xl bg-card/60 border border-border p-2 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2 px-2 pt-1">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/30 to-accent/5 border border-accent/20 flex items-center justify-center">
                    <Settings size={14} className="text-accent" />
                  </div>
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Yönetim</span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/30 hover:text-white/60"
              >
                <ChevronRight size={12} className={cn("transition-transform", sidebarCollapsed && "rotate-180")} />
              </button>
            </div>
            <div className="space-y-0.5">
              {adminTabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.key
                return (
                  <Link
                    key={tab.key}
                    href={`/admin?tab=${tab.key}`}
                    className={cn(
                      "group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-r from-accent/15 to-transparent text-accent"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                    title={sidebarCollapsed ? tab.label : undefined}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-accent" />}
                    <Icon size={16} className="shrink-0" />
                    {!sidebarCollapsed && tab.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === "overview" && <AdminOverview />}
          {activeTab === "users" && <AdminUsers />}
          {activeTab === "companies" && <AdminCompanies />}
          {activeTab === "products" && <AdminProducts />}
          {activeTab === "orders" && <AdminOrders />}
          {activeTab === "warehouses" && <AdminWarehouses />}
          {activeTab === "campaigns" && <AdminCampaigns />}
        </div>
      </div>
    </Shell>
  )
}

const statStyles: Record<string, { text: string; chip: string; glow: string; from: string }> = {
  info: { text: "text-info", chip: "bg-info/10 text-info border-info/20", glow: "shadow-info/10", from: "from-info/10" },
  accent: { text: "text-accent", chip: "bg-accent/10 text-accent border-accent/20", glow: "shadow-accent/10", from: "from-accent/10" },
  success: { text: "text-success", chip: "bg-success/10 text-success border-success/20", glow: "shadow-success/10", from: "from-success/10" },
  warning: { text: "text-warning", chip: "bg-warning/10 text-warning border-warning/20", glow: "shadow-warning/10", from: "from-warning/10" },
}

function AdminOverview() {
  const { data: stats, loading } = useData(() => getAdminStats(), [])
  const { orders, loading: ordersLoading } = useOrders()

  const cards = [
    { label: "Toplam Kullanıcı", value: stats?.users ?? 0, icon: Users, tone: "info", hint: "Kayıtlı hesaplar" },
    { label: "Aktif Şirket", value: stats?.companies ?? 0, icon: Building2, tone: "accent", hint: "Bayi & müşteri" },
    { label: "Toplam Sipariş", value: stats?.orders ?? 0, icon: ShoppingBag, tone: "success", hint: "Tüm zamanlar" },
    { label: "Ciro", value: stats ? formatPrice(stats.revenue) : "—", icon: DollarSign, tone: "warning", hint: "Toplam gelir" },
  ]

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent/10 via-card to-card p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-white">Yönetim Paneli</h2>
              <Badge variant="success" pulsing>Sistem Aktif</Badge>
            </div>
            <p className="text-sm text-white/50">Sistemin genel durumunu buradan takip edin</p>
          </div>
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/5 border border-accent/20 items-center justify-center">
            <BarChart3 size={26} className="text-accent" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat, i) => {
          const Icon = stat.icon
          const s = statStyles[stat.tone]
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br to-card border border-border transition-all hover:border-white/15 hover:shadow-lg",
                s.from, s.glow
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", s.chip)}>
                  <Icon size={18} />
                </div>
                <TrendingUp size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-24 mb-1" />
              ) : (
                <p className="text-2xl font-bold text-white leading-none mb-1">{stat.value}</p>
              )}
              <p className="text-xs font-medium text-white/60">{stat.label}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{stat.hint}</p>
            </motion.div>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Son Siparişler</CardTitle></CardHeader>
        <CardContent>
          {ordersLoading ? (
            <TableSkeleton rows={5} />
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag size={32} className="mx-auto text-white/20 mb-3" />
              <p className="text-sm text-white/40">Henüz sipariş bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Sipariş</th>
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Tarih</th>
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Durum</th>
                    <th className="text-right text-xs font-medium text-white/30 pb-3">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="border-b border-white/[0.02]">
                      <td className="py-3 text-sm text-white/80">
                        <Link href={`/orders/${order.id}`} className="hover:text-accent">{order.orderNumber}</Link>
                      </td>
                      <td className="py-3 text-sm text-white/50">{formatDate(order.createdAt)}</td>
                      <td className="py-3">
                        <Badge variant={order.status === "delivered" || order.status === "confirmed" ? "success" : order.status === "shipped" ? "info" : "default"} size="sm">
                          {orderStatusLabels[order.status] ?? order.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right text-sm font-medium text-white">{formatPrice(order.pricing.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminUsers() {
  const { data: users, loading } = useData(() => getAllUsers(), [])
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState<{ name: string; link: string } | null>(null)
  const rows = (users ?? []).filter(
    (u) => `${u.name} ${u.surname}`.toLowerCase().includes(search.toLowerCase()) ||
      u.companyName.toLowerCase().includes(search.toLowerCase())
  )

  const generateLink = async (user: { id: string; name: string; surname: string }) => {
    setBusyId(user.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/admin/reset-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ userId: user.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Link oluşturulamadı")
      await navigator.clipboard.writeText(json.link).catch(() => {})
      setLinkModal({ name: `${user.name} ${user.surname}`.trim(), link: json.link })
      toast.success("Şifre bağlantısı oluşturuldu ve kopyalandı")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link oluşturulamadı")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={Users} tone="info" title="Kullanıcı Yönetimi" subtitle={`${users?.length ?? 0} kullanıcı`} />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12"><Users size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Kullanıcı bulunamadı</p></div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-white/30 p-4">Kullanıcı</th>
                <th className="text-left text-xs font-medium text-white/30 p-4">Firma</th>
                <th className="text-left text-xs font-medium text-white/30 p-4">Rol</th>
                <th className="text-left text-xs font-medium text-white/30 p-4">Durum</th>
                <th className="text-right text-xs font-medium text-white/30 p-4">Şifre Bağlantısı</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                        {`${user.name} ${user.surname}`.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{user.name} {user.surname}</p>
                        <p className="text-xs text-white/40">{user.phone || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-white/60">{user.companyName}</td>
                  <td className="p-4 text-sm text-white/60">{roleLabels[user.role] ?? user.role}</td>
                  <td className="p-4">
                    <Badge variant={user.isActive ? "success" : "default"} size="sm">{user.isActive ? "Aktif" : "Pasif"}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      disabled={busyId === user.id}
                      onClick={() => generateLink(user)}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors"
                    >
                      <KeyRound size={13} />
                      {busyId === user.id ? "Oluşturuluyor..." : "Şifre Linki"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {linkModal && <ResetLinkModal name={linkModal.name} link={linkModal.link} onClose={() => setLinkModal(null)} />}
    </div>
  )
}

function ResetLinkModal({ name, link, onClose }: { name: string; link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    toast.success("Kopyalandı")
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><KeyRound size={16} /></div>
            <div>
              <h3 className="text-base font-bold text-white">Şifre Sıfırlama Bağlantısı</h3>
              <p className="text-xs text-white/40">{name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>

        <p className="text-xs text-white/50">
          Bu bağlantıyı üyeye iletin. Üye, bağlantıya tıklayıp kendi şifresini belirleyecek. Bağlantı bir süre sonra geçersiz olur; gerekirse yenisini oluşturun.
        </p>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white/80 text-xs font-mono focus:outline-none focus:border-accent/40"
          />
          <Button size="sm" onClick={copy} icon={copied ? <Check size={14} /> : <Copy size={14} />}>
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AdminCompanies() {
  const { data: companies, loading } = useData(() => getAllCompanies(), [])

  return (
    <div className="space-y-4">
      <SectionHeader icon={Building2} tone="accent" title="Şirket Yönetimi" subtitle={`${companies?.length ?? 0} şirket`} />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (companies?.length ?? 0) === 0 ? (
        <div className="text-center py-12"><Building2 size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Şirket bulunamadı</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies!.map((c) => (
            <GlassCard key={c.id} intensity="light" className="p-5 group hover:border-accent/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 border border-accent/20 text-accent flex items-center justify-center text-base font-bold shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate group-hover:text-accent transition-colors">{c.name}</h3>
                  <p className="text-xs text-white/40 truncate">{c.email || c.phone || "—"}</p>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Vergi No</span>
                  <span className="text-white/70 font-mono">{c.taxNumber || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Konum</span>
                  <span className="text-white/70 truncate ml-2">{[c.address.city, c.address.district].filter(Boolean).join(", ") || "—"}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminProducts() {
  const { products, loading, refetch } = useProducts()
  const [productSearch, setProductSearch] = useState("")
  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
    .slice(0, 30)

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await setProductActive(id, !current)
      toast.success(current ? "Ürün pasife alındı" : "Ürün aktifleştirildi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={Package} tone="success" title="Ürün Yönetimi" subtitle={`${products.length} ürün`} />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12"><Package size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Ürün bulunamadı</p></div>
        ) : (
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-white/30 p-4">Ürün</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">SKU</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Fiyat</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Stok</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center">
                          <Package size={14} className="text-white/30" />
                        </div>
                        <span className="text-sm text-white/80">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-white/40 font-mono">{product.sku}</td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(product.basePrice)}</td>
                    <td className="p-4 text-right text-sm text-white/60">{product.stock[0]?.available || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/products/${product.id}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"><Eye size={14} /></Link>
                        <button
                          onClick={() => toggleActive(product.id, product.isActive)}
                          className={cn("text-xs px-2 py-1 rounded-lg", product.isActive ? "text-danger/70 hover:bg-danger/5" : "text-success hover:bg-success/5")}
                        >
                          {product.isActive ? "Pasife Al" : "Aktifleştir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminOrders() {
  const { orders, loading, refetch } = useOrders()
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, status: Order["status"], label: string) => {
    setBusy(id)
    try {
      await updateOrderStatus(id, status)
      toast.success(label)
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    } finally {
      setBusy(null)
    }
  }

  const actionsFor = (order: Order) => {
    switch (order.status) {
      case "pending_approval":
      case "quotation":
        return (
          <>
            <button disabled={busy === order.id} onClick={() => act(order.id, "confirmed", "Sipariş onaylandı")} className="text-xs px-2 py-1 rounded-lg text-success hover:bg-success/5 flex items-center gap-1"><CheckCircle size={12} /> Onayla</button>
            <button disabled={busy === order.id} onClick={() => act(order.id, "cancelled", "Sipariş reddedildi")} className="text-xs px-2 py-1 rounded-lg text-danger/70 hover:bg-danger/5 flex items-center gap-1"><XCircle size={12} /> Reddet</button>
          </>
        )
      case "confirmed":
      case "approved":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "processing", "Hazırlığa alındı")} className="text-xs px-2 py-1 rounded-lg text-info hover:bg-info/5 flex items-center gap-1"><Package size={12} /> Hazırlığa Al</button>
      case "processing":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "shipped", "Kargoya verildi")} className="text-xs px-2 py-1 rounded-lg text-info hover:bg-info/5 flex items-center gap-1"><Truck size={12} /> Kargola</button>
      case "shipped":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "delivered", "Teslim edildi")} className="text-xs px-2 py-1 rounded-lg text-success hover:bg-success/5 flex items-center gap-1"><CheckCircle size={12} /> Teslim Et</button>
      default:
        return <span className="text-xs text-white/20">—</span>
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={ShoppingBag} tone="warning" title="Sipariş Yönetimi" subtitle={`${orders.length} sipariş`} />
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12"><ShoppingBag size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Sipariş bulunamadı</p></div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-white/30 p-4">Sipariş</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Tarih</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Durum</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Tutar</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm text-white/80">
                      <Link href={`/orders/${order.id}`} className="hover:text-accent">{order.orderNumber}</Link>
                    </td>
                    <td className="p-4 text-sm text-white/50">{formatDate(order.createdAt)}</td>
                    <td className="p-4">
                      <Badge variant={order.status === "delivered" || order.status === "confirmed" ? "success" : order.status === "shipped" || order.status === "processing" ? "info" : order.status === "cancelled" ? "danger" : "default"} size="sm">
                        {orderStatusLabels[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(order.pricing.grandTotal)}</td>
                    <td className="p-4"><div className="flex items-center justify-end gap-1">{actionsFor(order)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminWarehouses() {
  const { warehouses, loading } = useWarehouses()

  return (
    <div className="space-y-4">
      <SectionHeader icon={Warehouse} tone="info" title="Depo Yönetimi" subtitle={`${warehouses.length} depo`} />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-12"><Warehouse size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Henüz depo bulunmuyor</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((wh) => {
            const pct = wh.capacity > 0 ? Math.round((wh.usedCapacity / wh.capacity) * 100) : 0
            return (
              <GlassCard key={wh.id} intensity="light" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center"><Warehouse size={18} /></div>
                  <Badge variant={wh.isActive ? "success" : "default"} size="sm">{wh.isActive ? "Aktif" : "Pasif"}</Badge>
                </div>
                <h3 className="text-base font-semibold text-white">{wh.name}</h3>
                <p className="text-xs text-white/40 mt-1">{wh.address.city} {wh.address.district}</p>
                <div className="flex items-center justify-between mt-4 text-xs text-white/40">
                  <span>Kapasite: %{pct}</span>
                  <span>{wh.manager}</span>
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AdminCampaigns() {
  const { data: campaigns, loading, refetch } = useData(() => getAllCampaigns(), [])
  const [showForm, setShowForm] = useState(false)

  const toggle = async (id: string, active: boolean) => {
    try {
      await setCampaignActive(id, !active)
      toast.success(active ? "Kampanya devre dışı bırakıldı" : "Kampanya aktifleştirildi")
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Percent}
        tone="accent"
        title="Kampanya Yönetimi"
        subtitle={`${campaigns?.length ?? 0} kampanya`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(true)}>Yeni Kampanya</Button>}
      />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : (campaigns?.length ?? 0) === 0 ? (
        <div className="text-center py-12"><Percent size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Henüz kampanya yok</p></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {campaigns!.map((c) => (
            <GlassCard key={c.id} intensity="light" className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={c.isActive ? "premium" : "default"} pulsing={c.isActive}>{c.isActive ? "Aktif" : "Pasif"}</Badge>
                <span className="text-xs text-white/30">Bitiş: {formatDate(c.endDate)}</span>
              </div>
              <h3 className="text-base font-semibold text-white">{c.name}</h3>
              <p className="text-sm text-white/50 mt-1">{c.description || (c.discountRate ? `%${c.discountRate} indirim` : "")}</p>
              <div className="flex items-center justify-end mt-4 text-xs">
                <button onClick={() => toggle(c.id, c.isActive)} className={cn(c.isActive ? "text-danger/70 hover:text-danger" : "text-success hover:text-success/80")}>
                  {c.isActive ? "Devre Dışı Bırak" : "Aktifleştir"}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showForm && <CampaignForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); refetch() }} />}
    </div>
  )
}

const inputCls = "w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"

function CampaignForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [discountRate, setDiscountRate] = useState("10")
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { toast.error("Kampanya adı gerekli"); return }
    setSaving(true)
    try {
      await createCampaign({
        name,
        description,
        type: "discount",
        discountRate: Number(discountRate) || 0,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })
      toast.success("Kampanya oluşturuldu")
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturulamadı")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Yeni Kampanya</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
        </div>
        <Field label="Kampanya Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Açıklama"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
        <Field label="İndirim Oranı (%)"><input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
          <Field label="Bitiş"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : "Kampanyayı Oluştur"}</Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone = "accent",
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  subtitle: string
  tone?: keyof typeof statStyles
  action?: React.ReactNode
}) {
  const s = statStyles[tone]
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center shrink-0", s.chip)}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{title}</h2>
          <p className="text-sm text-white/40">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
