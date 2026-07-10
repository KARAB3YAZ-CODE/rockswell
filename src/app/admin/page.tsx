"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { useProducts, useOrders, useWarehouses } from "@/hooks/use-data"
import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Users, Building2, Package, ShoppingBag,
  Settings, BarChart3, Activity, DollarSign,
  Warehouse, Percent,
  TrendingUp, ChevronRight, Search,
  Edit, Trash2, Eye, Plus,
} from "lucide-react"

const adminTabs = [
  { key: "overview", label: "Genel Bakış", icon: Activity },
  { key: "users", label: "Kullanıcılar", icon: Users },
  { key: "companies", label: "Şirketler", icon: Building2 },
  { key: "products", label: "Ürünler", icon: Package },
  { key: "orders", label: "Siparişler", icon: ShoppingBag },
  { key: "warehouses", label: "Depolar", icon: Warehouse },
  { key: "campaigns", label: "Kampanyalar", icon: Percent },
  { key: "finance", label: "Finans", icon: DollarSign },
  { key: "reports", label: "Raporlar", icon: BarChart3 },
  { key: "settings", label: "Sistem", icon: Settings },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <Shell>
      <div className="flex gap-6">
        {/* Admin Sidebar */}
        <div className={cn(
          "shrink-0 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-56"
        )}>
          <div className="space-y-1 sticky top-24">
            <div className="flex items-center justify-between mb-3 px-3">
              {!sidebarCollapsed && <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Yönetim</span>}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/30 hover:text-white/60"
              >
                <ChevronRight size={12} className={cn("transition-transform", sidebarCollapsed && "rotate-180")} />
              </button>
            </div>
            {adminTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    activeTab === tab.key
                      ? "bg-accent/10 text-accent"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {!sidebarCollapsed && tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === "overview" && <AdminOverview />}
          {activeTab === "users" && <AdminUsers />}
          {activeTab === "products" && <AdminProducts />}
          {activeTab === "warehouses" && <AdminWarehouses />}
          {activeTab === "campaigns" && <AdminCampaigns />}
          {activeTab !== "overview" && activeTab !== "users" && activeTab !== "products" && activeTab !== "warehouses" && activeTab !== "campaigns" && (
            <div className="text-center py-20">
              <BarChart3 size={48} className="mx-auto text-white/20 mb-4" />
              <p className="text-white/50">{adminTabs.find(t => t.key === activeTab)?.label} paneli</p>
              <p className="text-white/30 text-sm mt-1">Bu bölüm geliştirme aşamasındadır.</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

function AdminOverview() {
  const { orders, loading } = useOrders()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Yönetim Paneli</h2>
          <p className="text-sm text-white/40">Sistem genel durumu</p>
        </div>
        <Badge variant="success" pulsing>Sistem Aktif</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Kullanıcı", value: "1,247", change: 8.2, icon: Users, color: "text-info" },
          { label: "Aktif Şirket", value: "523", change: 5.1, icon: Building2, color: "text-accent" },
          { label: "Toplam Sipariş", value: "12,458", change: 12.5, icon: ShoppingBag, color: "text-success" },
          { label: "Aylık Gelir", value: "₺3.2M", change: 7.8, icon: DollarSign, color: "text-warning" },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 bg-card border border-border"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-white/40">{stat.label}</span>
                <Icon size={16} className={stat.color} />
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-success">
                <TrendingUp size={12} />
                %{stat.change}
              </div>
            </motion.div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son Siparişler</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Müşteri</th>
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Durum</th>
                    <th className="text-right text-xs font-medium text-white/30 pb-3">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order: any) => (
                    <tr key={order.id} className="border-b border-white/[0.02]">
                      <td className="py-3 text-sm text-white/80">{order.orderNumber}</td>
                      <td className="py-3 text-sm text-white/50">Otoparç Otomotiv</td>
                      <td className="py-3">
                        <Badge variant={order.status === "delivered" ? "success" : order.status === "shipped" ? "info" : "default"} size="sm">
                          {order.status}
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
  const [userSearch, setUserSearch] = useState("")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Kullanıcı Yönetimi</h2>
          <p className="text-sm text-white/40">Tüm kullanıcıları yönetin</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => toast.success("Yeni kullanıcı ekleme sayfası yakında")}>Yeni Kullanıcı</Button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs font-medium text-white/30 p-4">Kullanıcı</th>
              <th className="text-left text-xs font-medium text-white/30 p-4">Rol</th>
              <th className="text-left text-xs font-medium text-white/30 p-4">Durum</th>
              <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Ahmet Yılmaz", email: "ahmet@otoparc.com", role: "Satın Alma Yöneticisi", status: "active" as const },
              { name: "Mehmet Demir", email: "mehmet@otoparc.com", role: "Depo Kullanıcısı", status: "active" as const },
              { name: "Ayşe Kaya", email: "ayse@otoparc.com", role: "Finans Kullanıcısı", status: "inactive" as const },
            ].filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).map((user, i) => (
              <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                      {user.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-white/40">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-white/60">{user.role}</td>
                <td className="p-4">
                  <Badge variant={user.status === "active" ? "success" : "default"} size="sm">
                    {user.status === "active" ? "Aktif" : "Pasif"}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => toast.success(`${user.name} kullanıcı detayı`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => toast.success(`${user.name} kullanıcı düzenleme`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5">
                      <Edit size={14} />
                    </button>
                    <button onClick={() => toast.success(`${user.name} silindi`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-danger hover:bg-danger/5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminProducts() {
  const { products, loading } = useProducts()
  const [productSearch, setProductSearch] = useState("")
  const filteredProducts = products.filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Ürün Yönetimi</h2>
          <p className="text-sm text-white/40">{products.length} ürün</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => toast.success("Yeni ürün ekleme sayfası yakında")}>Yeni Ürün</Button>
      </div>
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
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40">Ürün bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-white/30 p-4">Ürün</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">SKU</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Kategori</th>
                  <th className="text-left text-xs font-medium text-white/30 p-4">Marka</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Fiyat</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">Stok</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product: any) => (
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
                    <td className="p-4 text-sm text-white/60">{product.category}</td>
                    <td className="p-4"><Badge variant="premium" size="sm">{product.brand}</Badge></td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(product.basePrice)}</td>
                    <td className="p-4 text-right text-sm text-white/60">{product.stock[0]?.available || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toast.success(`${product.name} ürün detayı`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"><Eye size={14} /></button>
                        <button onClick={() => toast.success(`${product.name} ürün düzenleme`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"><Edit size={14} /></button>
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

function AdminWarehouses() {
  const { warehouses, loading } = useWarehouses()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Depo Yönetimi</h2>
          <p className="text-sm text-white/40">{warehouses.length} depo</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => toast.success("Yeni depo ekleme sayfası yakında")}>Yeni Depo</Button>
      </div>
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 bg-card border border-border space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" className="w-16" />
              </div>
              <Skeleton variant="text" className="w-2/3" />
              <Skeleton variant="text" className="w-1/2" />
              <div className="flex items-center justify-between">
                <Skeleton variant="text" className="w-24" />
                <Skeleton variant="text" className="w-20" />
              </div>
              <Skeleton variant="rectangular" className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-12">
          <Warehouse size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Henüz depo bulunmuyor</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((wh: any) => (
            <GlassCard key={wh.id} intensity="light" className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center">
                  <Warehouse size={18} />
                </div>
                <Badge variant={wh.isActive ? "success" : "default"} size="sm">
                  {wh.isActive ? "Aktif" : "Pasif"}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-white">{wh.name}</h3>
              <p className="text-xs text-white/40 mt-1">{wh.address.city} / {wh.address.district}</p>
              <div className="flex items-center justify-between mt-4 text-xs text-white/40">
                <span>Kapasite: %{Math.round((wh.usedCapacity / wh.capacity) * 100)}</span>
                <span>{wh.manager}</span>
              </div>
              <div className="relative h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-accent"
                  style={{ width: `${(wh.usedCapacity / wh.capacity) * 100}%` }}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminCampaigns() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Kampanya Yönetimi</h2>
          <p className="text-sm text-white/40">Aktif ve planlanan kampanyalar</p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => toast.success("Yeni kampanya ekleme sayfası yakında")}>Yeni Kampanya</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => (
          <GlassCard key={i} intensity="light" className="p-4">
            <div className="flex items-start justify-between mb-2">
              <Badge variant="premium" pulsing>Aktif</Badge>
              <span className="text-xs text-white/30">Bitiş: 30.09.2025</span>
            </div>
            <h3 className="text-base font-semibold text-white">Yaz Bakım Kampanyası</h3>
            <p className="text-sm text-white/50 mt-1">Soğutma sistemi ürünlerinde %15 indirim</p>
            <div className="flex items-center justify-between mt-4 text-xs text-white/40">
              <span>128 / 500 kullanım</span>
              <div className="flex gap-2">
                <button onClick={() => toast.success("Kampanya düzenleme sayfası yakında")} className="text-accent hover:text-accent/80">Düzenle</button>
                <button onClick={() => toast.success("Kampanya devre dışı bırakıldı")} className="text-danger/70 hover:text-danger">Devre Dışı</button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
