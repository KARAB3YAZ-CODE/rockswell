"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { useOrders, useData } from "@/hooks/use-data"
import {
  getAdminStats, getAllUsers, getAllCompanies, getAllCampaigns, getAllWarehouses,
  getCategories, getVehicleBrands,
  createCampaign, updateCampaign, deleteCampaign, setCampaignActive,
  createCompany, updateCompany, deleteCompany,
  createWarehouse, updateWarehouse, deleteWarehouse,
  updateOrderStatus, bulkUpdateOrderStatus, deleteOrder,
  updateUserByAdmin, adminCreateUser, adminDeleteUser, bulkSetUsersActive,
  type CompanyInput, type WarehouseInput, type CreateCampaignInput,
  type AdminUserRow,
} from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { formatPrice, formatDate, cn } from "@/lib/utils"
import type { Order, Company, Product, Warehouse, Campaign, Address } from "@/lib/types"
import {
  Users, Building2, Package, ShoppingBag,
  BarChart3, DollarSign,
  Warehouse as WarehouseIcon, Percent, TrendingUp, Search,
  Eye, Plus, CheckCircle, XCircle, Truck, X,
  KeyRound, Copy, Check, Pencil, Trash2, Ban, UserPlus, ChevronRight,
} from "lucide-react"
import { ROLE_LABELS } from "@/lib/roles"
import { siteAbsoluteUrl, adminPath } from "@/lib/admin-host"
import {
  inputCls, Field, AddressFields, Toggle, Warn, IconBtn, Modal, ConfirmDialog, SectionHeader, statStyles, emptyAddress, orderStatusLabels,
} from "@/components/admin/ui"

const roleLabels = ROLE_LABELS as Record<string, string>

const ORDER_STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "pending_approval", label: "Onay bekleyen" },
  { id: "quotation", label: "Teklif" },
  { id: "confirmed", label: "Onaylı" },
  { id: "processing", label: "Hazırlanan" },
  { id: "shipped", label: "Kargoda" },
  { id: "delivered", label: "Teslim" },
  { id: "cancelled", label: "İptal" },
]

const COMMON_VEHICLE_BRANDS = [
  "AUDI", "BMW", "MERCEDES", "VOLKSWAGEN", "SEAT", "SKODA", "RENAULT", "FIAT",
  "PEUGEOT", "CITROEN", "FORD", "OPEL", "DACIA", "HYUNDAI", "TOYOTA", "KIA",
]

function nextStatusFor(status: Order["status"]): { status: Order["status"]; label: string } | null {
  switch (status) {
    case "pending_approval":
    case "quotation":
      return { status: "confirmed", label: "Onayla" }
    case "confirmed":
    case "approved":
      return { status: "processing", label: "Hazırlığa Al" }
    case "processing":
      return { status: "shipped", label: "Kargola" }
    case "shipped":
      return { status: "delivered", label: "Teslim Et" }
    default:
      return null
  }
}

export function AdminOverview() {
  const { data: stats, loading } = useData(() => getAdminStats(), [])
  const { orders, loading: ordersLoading } = useOrders()
  const { data: companies } = useData(() => getAllCompanies(), [])

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of companies ?? []) map.set(c.id, c.name)
    return map
  }, [companies])

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "pending_approval" || o.status === "quotation").length,
    [orders]
  )
  const processingCount = useMemo(
    () => orders.filter((o) => o.status === "processing" || o.status === "shipped").length,
    [orders]
  )

  const cards = [
    { label: "Toplam Kullanıcı", value: stats?.users ?? 0, icon: Users, tone: "info", hint: "Kayıtlı hesaplar", href: adminPath("/users") },
    { label: "Aktif Şirket", value: stats?.companies ?? 0, icon: Building2, tone: "accent", hint: "Bayi & müşteri", href: adminPath("/companies") },
    { label: "Toplam Sipariş", value: stats?.orders ?? 0, icon: ShoppingBag, tone: "success", hint: "Tüm zamanlar", href: adminPath("/orders") },
    { label: "Ciro", value: stats ? formatPrice(stats.revenue) : "—", icon: DollarSign, tone: "warning", hint: "Toplam gelir", href: adminPath("/reports") },
  ]

  const quick = [
    { label: "Onay bekleyen", value: pendingCount, href: `${adminPath("/orders")}?status=pending_approval`, tone: "warning" as const },
    { label: "Hazırlık / kargo", value: processingCount, href: `${adminPath("/orders")}?status=processing`, tone: "info" as const },
    { label: "Ürünler", value: "Yönet", href: adminPath("/products"), tone: "accent" as const },
    { label: "Raporlar", value: "Aç", href: adminPath("/reports"), tone: "success" as const },
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
            <Link key={stat.label} href={stat.href}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br to-card border border-border transition-all hover:border-white/15 hover:shadow-lg h-full",
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
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quick.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="rounded-2xl border border-border bg-card/60 p-4 hover:border-accent/30 transition-colors"
          >
            <p className="text-[11px] text-white/40 mb-1">{q.label}</p>
            <p className={cn(
              "text-lg font-bold",
              q.tone === "warning" ? "text-warning" :
              q.tone === "info" ? "text-info" :
              q.tone === "accent" ? "text-accent" : "text-success"
            )}>
              {q.value}
            </p>
          </Link>
        ))}
      </div>

      <GlassCard intensity="light" className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">Son Siparişler</h3>
          <Link href={adminPath("/orders")} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
            Tüm siparişler <ChevronRight size={12} />
          </Link>
        </div>
        <div className="p-5 pt-2">
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
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Firma</th>
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Tarih</th>
                    <th className="text-left text-xs font-medium text-white/30 pb-3">Durum</th>
                    <th className="text-right text-xs font-medium text-white/30 pb-3">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="border-b border-white/[0.02]">
                      <td className="py-3 text-sm text-white/80">
                        <a href={siteAbsoluteUrl(`/orders/${order.id}`)} className="hover:text-accent">{order.orderNumber}</a>
                      </td>
                      <td className="py-3 text-sm text-white/50 truncate max-w-[140px]">
                        {companyNameById.get(order.companyId) || "—"}
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
        </div>
      </GlassCard>
    </div>
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function AdminUsers() {
  const { data: users, loading, refetch } = useData(() => getAllUsers(), [])
  const { data: companies } = useData(() => getAllCompanies(), [])
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("company") ?? "")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState<{ name: string; link: string } | null>(null)
  const [formUser, setFormUser] = useState<AdminUserRow | "new" | null>(null)
  const [delUser, setDelUser] = useState<AdminUserRow | null>(null)

  const roles = useMemo(
    () => [...new Set((users ?? []).map((u) => u.role).filter(Boolean))].sort(),
    [users]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users ?? []).filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false
      if (statusFilter === "active" && !u.isActive) return false
      if (statusFilter === "inactive" && u.isActive) return false
      if (companyFilter !== "all") {
        if (companyFilter === "__none__") {
          if (u.companyId) return false
        } else if (u.companyId !== companyFilter) return false
      }
      if (!q) return true
      return (
        `${u.name} ${u.surname}`.toLowerCase().includes(q) ||
        u.companyName.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        (roleLabels[u.role] ?? u.role).toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter, statusFilter, companyFilter])

  const allSelected = rows.length > 0 && rows.every((u) => selected.has(u.id))

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        rows.forEach((u) => next.delete(u.id))
        return next
      }
      return new Set([...prev, ...rows.map((u) => u.id)])
    })
  }

  const runBulkActive = async (isActive: boolean) => {
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const n = await bulkSetUsersActive(ids, isActive)
      toast.success(`${n} kullanıcı ${isActive ? "aktifleştirildi" : "pasife alındı"}`)
      setSelected(new Set())
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toplu işlem başarısız")
    } finally {
      setBulkBusy(false)
    }
  }

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

  const clearFilters = () => {
    setSearch("")
    setRoleFilter("all")
    setStatusFilter("all")
    setCompanyFilter("all")
    setSelected(new Set())
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Users}
        tone="info"
        title="Kullanıcı Yönetimi"
        subtitle={`${rows.length} / ${users?.length ?? 0} kullanıcı`}
        action={<Button size="sm" icon={<UserPlus size={14} />} onClick={() => setFormUser("new")}>Yeni Kullanıcı</Button>}
      />

      <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(new Set()) }}
            placeholder="Ad, telefon, firma ara…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setSelected(new Set()) }}
            className={cn(inputCls, "cursor-pointer")}
          >
            <option value="all" className="bg-card">Tüm roller</option>
            {roles.map((r) => (
              <option key={r} value={r} className="bg-card">{roleLabels[r] ?? r}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setSelected(new Set()) }}
            className={cn(inputCls, "cursor-pointer")}
          >
            <option value="all" className="bg-card">Tüm durum</option>
            <option value="active" className="bg-card">Aktif</option>
            <option value="inactive" className="bg-card">Pasif</option>
          </select>
          <select
            value={companyFilter}
            onChange={(e) => { setCompanyFilter(e.target.value); setSelected(new Set()) }}
            className={cn(inputCls, "cursor-pointer")}
          >
            <option value="all" className="bg-card">Tüm firmalar</option>
            <option value="__none__" className="bg-card">Firmasız</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-card">{c.name}</option>
            ))}
          </select>
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs text-white/45">{selected.size} seçili</span>
            <Button size="sm" disabled={bulkBusy} onClick={() => void runBulkActive(true)}>Aktifleştir</Button>
            <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => void runBulkActive(false)}>Pasife al</Button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1">
              <X size={12} /> Temizle
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : (users?.length ?? 0) === 0 ? (
          <div className="text-center py-12">
            <Users size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40 mb-3">Henüz kullanıcı yok</p>
            <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setFormUser("new")}>Yeni Kullanıcı</Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Search size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-sm text-white/40 mb-3">Filtrelere uyan kullanıcı yok</p>
            <button type="button" onClick={clearFilters} className="text-xs text-accent hover:underline">Filtreleri temizle</button>
          </div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#39ff14]" />
                  </th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Kullanıcı</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Firma</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Rol</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Durum</th>
                  <th className="text-right text-xs font-medium text-white/30 p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const missing = missingUser(user)
                  return (
                    <tr key={user.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(user.id)}
                          onChange={() => toggleOne(user.id)}
                          className="accent-[#39ff14]"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
                            {`${user.name} ${user.surname}`.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white flex items-center gap-2">{user.name} {user.surname}<Warn items={missing} /></p>
                            <p className="text-xs text-white/40">{user.phone || "Telefon yok"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-white/60">{user.companyName}</td>
                      <td className="p-3 text-sm text-white/60">{roleLabels[user.role] ?? user.role}</td>
                      <td className="p-3">
                        <Badge variant={user.isActive ? "success" : "default"} size="sm">{user.isActive ? "Aktif" : "Pasif"}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn icon={KeyRound} label="Şifre linki" onClick={() => generateLink(user)} disabled={busyId === user.id} />
                          <IconBtn icon={Pencil} label="Düzenle" onClick={() => setFormUser(user)} />
                          <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDelUser(user)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {linkModal && <ResetLinkModal name={linkModal.name} link={linkModal.link} onClose={() => setLinkModal(null)} />}
      {formUser && (
        <UserForm
          user={formUser === "new" ? null : formUser}
          companies={companies ?? []}
          onClose={() => setFormUser(null)}
          onSaved={() => { setFormUser(null); refetch() }}
        />
      )}
      {delUser && (
        <ConfirmDialog
          title="Kullanıcıyı Sil"
          message={`"${delUser.name} ${delUser.surname}" adlı kullanıcı ve hesabı kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          onCancel={() => setDelUser(null)}
          onConfirm={async () => {
            try {
              await adminDeleteUser(delUser.id)
              toast.success("Kullanıcı silindi")
              setDelUser(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}

export function missingUser(u: AdminUserRow): string[] {
  const m: string[] = []
  if (!u.phone) m.push("telefon")
  if (u.companyName === "—") m.push("firma")
  if (!u.name) m.push("ad")
  return m
}

export function UserForm({ user, companies, onClose, onSaved }: {
  user: AdminUserRow | null
  companies: Company[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!user
  const [name, setName] = useState(user?.name ?? "")
  const [surname, setSurname] = useState(user?.surname ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState(user?.role ?? "company_admin")
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [companyId, setCompanyId] = useState<string>(user?.companyId ?? "")
  const [newCompany, setNewCompany] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { toast.error("Ad gerekli"); return }
    if (!isEdit && !email.trim()) { toast.error("E-posta gerekli"); return }
    setSaving(true)
    try {
      if (isEdit && user) {
        await updateUserByAdmin(user.id, {
          name, surname, phone, role, isActive,
          companyId: companyId || undefined,
        })
        toast.success("Kullanıcı güncellendi")
      } else {
        await adminCreateUser({
          email, name, surname, phone, role,
          companyId: companyId || undefined,
          companyName: !companyId && newCompany ? newCompany : undefined,
        })
        toast.success("Kullanıcı oluşturuldu")
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"} icon={isEdit ? Pencil : UserPlus} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Soyad"><input value={surname} onChange={(e) => setSurname(e.target.value)} className={inputCls} /></Field>
      </div>
      {!isEdit && (
        <Field label="E-posta"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
      )}
      <Field label="Telefon"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
          </select>
        </Field>
        <Field label="Firma">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="" className="bg-card">{isEdit ? "Firma seçilmedi" : "Yeni firma…"}</option>
            {companies.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
          </select>
        </Field>
      </div>
      {!isEdit && !companyId && (
        <Field label="Yeni Firma Adı"><input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Boş bırakılırsa firmasız oluşturulur" className={inputCls} /></Field>
      )}
      {isEdit && <Toggle checked={isActive} onChange={setIsActive} label="Hesap aktif" />}
      {!isEdit && (
        <p className="text-xs text-white/40">Kullanıcı oluşturulduktan sonra listedeki &quot;Şifre linki&quot; ile şifre belirleme bağlantısı gönderin.</p>
      )}
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

export function ResetLinkModal({ name, link, onClose }: { name: string; link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    toast.success("Kopyalandı")
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Modal title="Şifre Sıfırlama Bağlantısı" subtitle={name} icon={KeyRound} onClose={onClose}>
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
    </Modal>
  )
}

// ─── Companies ────────────────────────────────────────────────────────────────

export function AdminCompanies() {
  const { data: companies, loading, refetch } = useData(() => getAllCompanies(), [])
  const [form, setForm] = useState<Company | "new" | null>(null)
  const [del, setDel] = useState<Company | null>(null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"name" | "discount" | "credit">("name")

  const cityOptions = useMemo(
    () => [...new Set((companies ?? []).map((c) => c.address?.city?.trim()).filter(Boolean) as string[])],
    [companies]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = companies ?? []
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.taxNumber.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.address?.city ?? "").toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sort === "discount") return b.discountRate - a.discountRate || a.name.localeCompare(b.name, "tr")
      if (sort === "credit") return b.creditLimit - a.creditLimit || a.name.localeCompare(b.name, "tr")
      return a.name.localeCompare(b.name, "tr")
    })
  }, [companies, search, sort])

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Building2}
        tone="accent"
        title="Şirket Yönetimi"
        subtitle={`${filtered.length} / ${companies?.length ?? 0} şirket`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Şirket</Button>}
      />

      <div className="rounded-2xl border border-border bg-card/60 p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, vergi no, e-posta, şehir ara…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={cn(inputCls, "sm:w-44 cursor-pointer")}
        >
          <option value="name" className="bg-card">Sıra: Ad</option>
          <option value="discount" className="bg-card">Sıra: İskonto</option>
          <option value="credit" className="bg-card">Sıra: Kredi</option>
        </select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (companies?.length ?? 0) === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <Building2 size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40 mb-3">Henüz şirket yok</p>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Şirket</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <Search size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Aramaya uyan şirket yok</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const missing = missingCompany(c)
            return (
              <GlassCard key={c.id} intensity="light" className="p-5 group hover:border-accent/20 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 border border-accent/20 text-accent flex items-center justify-center text-base font-bold shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white truncate group-hover:text-accent transition-colors">{c.name}</h3>
                    <p className="text-xs text-white/40 truncate">{c.email || c.phone || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(c)} />
                    <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(c)} />
                  </div>
                </div>
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">İskonto</span>
                    <span className="text-accent font-medium">%{c.discountRate}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Kredi Limiti</span>
                    <span className="text-white/70 font-medium">{formatPrice(c.creditLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Vergi No</span>
                    <span className="text-white/70 font-mono">{c.taxNumber || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">Konum</span>
                    <span className="text-white/70 truncate ml-2">{[c.address.city, c.address.district].filter(Boolean).join(", ") || "—"}</span>
                  </div>
                  {missing.length > 0 && <div className="pt-1"><Warn items={missing} /></div>}
                  <div className="flex gap-2 pt-2">
                    <Link
                      href={`${adminPath("/users")}?company=${encodeURIComponent(c.name)}`}
                      className="flex-1 text-center text-[11px] py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-accent hover:border-accent/30"
                    >
                      Kullanıcılar
                    </Link>
                    <Link
                      href={`${adminPath("/orders")}?company=${encodeURIComponent(c.name)}`}
                      className="flex-1 text-center text-[11px] py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-accent hover:border-accent/30"
                    >
                      Siparişler
                    </Link>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {form && (
        <CompanyForm
          company={form === "new" ? null : form}
          cityOptions={cityOptions}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refetch() }}
        />
      )}
      {del && (
        <ConfirmDialog
          title="Şirketi Sil"
          message={`"${del.name}" silinecek. Bağlı kullanıcılar firmasız kalabilir. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteCompany(del.id)
              toast.success("Şirket silindi")
              setDel(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}

export function missingCompany(c: Company): string[] {
  const m: string[] = []
  if (!c.taxNumber) m.push("vergi no")
  if (!c.address.city) m.push("şehir")
  if (!c.phone && !c.email) m.push("iletişim")
  return m
}

export function CompanyForm({
  company,
  cityOptions = [],
  onClose,
  onSaved,
}: {
  company: Company | null
  cityOptions?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!company
  const [name, setName] = useState(company?.name ?? "")
  const [taxNumber, setTaxNumber] = useState(company?.taxNumber ?? "")
  const [taxOffice, setTaxOffice] = useState(company?.taxOffice ?? "")
  const [phone, setPhone] = useState(company?.phone ?? "")
  const [email, setEmail] = useState(company?.email ?? "")
  const [address, setAddress] = useState<Address>(company?.address ?? emptyAddress)
  const [discountRate, setDiscountRate] = useState(String(company?.discountRate ?? 25))
  const [creditLimit, setCreditLimit] = useState(String(company?.creditLimit ?? 0))
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) { toast.error("Firma adı gerekli"); return }
    setSaving(true)
    const input: CompanyInput = {
      name, taxNumber, taxOffice, phone, email, address,
      discountRate: Number(discountRate) || 25,
      creditLimit: Number(creditLimit) || 0,
    }
    try {
      if (isEdit && company) { await updateCompany(company.id, input); toast.success("Şirket güncellendi") }
      else { await createCompany(input); toast.success("Şirket oluşturuldu") }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? "Şirketi Düzenle" : "Yeni Şirket"} icon={Building2} size="lg" onClose={onClose}>
      <Field label="Firma Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vergi No"><input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} className={inputCls} /></Field>
        <Field label="Vergi Dairesi"><input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} className={inputCls} /></Field>
        <Field label="Telefon"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
        <Field label="E-posta"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
        <Field label="İskonto Oranı (%)">
          <input type="number" min={0} max={100} step={0.5} value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Kredi Limiti (₺)">
          <input type="number" min={0} step={1000} value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <AddressFields value={address} onChange={setAddress} cityOptions={cityOptions} />
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Products ─────────────────────────────────────────────────────────────────

export { AdminProducts, ProductForm, missingProduct } from "@/components/admin/products-manager"

// ─── Orders ───────────────────────────────────────────────────────────────────

export function AdminOrders() {
  const { orders, loading, refetch } = useOrders()
  const { data: companies } = useData(() => getAllCompanies(), [])
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [delOrder, setDelOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState(searchParams.get("company") ?? "")
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of companies ?? []) map.set(c.id, c.name)
    return map
  }, [companies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (statusFilter !== "all") {
        if (statusFilter === "confirmed" && !["confirmed", "approved"].includes(o.status)) return false
        else if (statusFilter !== "confirmed" && o.status !== statusFilter) return false
      }
      if (!q) return true
      const company = (companyNameById.get(o.companyId) ?? "").toLowerCase()
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        company.includes(q) ||
        o.notes?.toLowerCase().includes(q)
      )
    })
  }, [orders, search, statusFilter, companyNameById])

  const allSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id))

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev)
        filtered.forEach((o) => next.delete(o.id))
        return next
      }
      return new Set([...prev, ...filtered.map((o) => o.id)])
    })
  }

  const selectedOrders = filtered.filter((o) => selected.has(o.id))
  const bulkNext = useMemo(() => {
    if (selectedOrders.length === 0) return null
    const first = nextStatusFor(selectedOrders[0].status)
    if (!first) return null
    if (!selectedOrders.every((o) => nextStatusFor(o.status)?.status === first.status)) return null
    return first
  }, [selectedOrders])

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

  const runBulk = async () => {
    if (!bulkNext) return
    setBulkBusy(true)
    try {
      const n = await bulkUpdateOrderStatus(selectedOrders.map((o) => o.id), bulkNext.status)
      toast.success(`${n} sipariş: ${bulkNext.label}`)
      setSelected(new Set())
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toplu işlem başarısız")
    } finally {
      setBulkBusy(false)
    }
  }

  const stageActions = (order: Order) => {
    const next = nextStatusFor(order.status)
    if (!next) return null
    const icon =
      next.status === "shipped" ? <Truck size={12} /> :
      next.status === "processing" ? <Package size={12} /> :
      <CheckCircle size={12} />
    return (
      <button
        disabled={busy === order.id}
        onClick={() => act(order.id, next.status, next.label)}
        className="text-xs px-2 py-1 rounded-lg text-success hover:bg-success/5 flex items-center gap-1"
      >
        {icon} {next.label}
      </button>
    )
  }

  const canCancel = (s: Order["status"]) => !["cancelled", "delivered", "returned"].includes(s)

  return (
    <div className="space-y-4">
      <SectionHeader icon={ShoppingBag} tone="warning" title="Sipariş Yönetimi" subtitle={`${filtered.length} / ${orders.length} sipariş`} />

      <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(new Set()) }}
              placeholder="Sipariş no veya firma ara…"
              className={cn(inputCls, "pl-9")}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ORDER_STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setStatusFilter(f.id); setSelected(new Set()) }}
              className={cn(
                "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
                statusFilter === f.id
                  ? "bg-accent/15 border-accent/40 text-accent"
                  : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <span className="text-xs text-white/45">{selected.size} seçili</span>
            {bulkNext && (
              <Button size="sm" disabled={bulkBusy} onClick={() => void runBulk()}>
                Toplu {bulkNext.label}
              </Button>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1">
              <X size={12} /> Temizle
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12"><ShoppingBag size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Henüz sipariş yok</p></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><Search size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Filtrelere uyan sipariş yok</p></div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#39ff14]" />
                  </th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Sipariş</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Firma</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Tarih</th>
                  <th className="text-left text-xs font-medium text-white/30 p-3">Durum</th>
                  <th className="text-right text-xs font-medium text-white/30 p-3">Tutar</th>
                  <th className="text-right text-xs font-medium text-white/30 p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const missing = missingOrder(order)
                  const companyName = companyNameById.get(order.companyId) || "—"
                  return (
                    <tr key={order.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleOne(order.id)}
                          className="accent-[#39ff14]"
                        />
                      </td>
                      <td className="p-3 text-sm text-white/80">
                        <a href={siteAbsoluteUrl(`/orders/${order.id}`)} className="hover:text-accent flex items-center gap-2">
                          {order.orderNumber}<Warn items={missing} />
                        </a>
                      </td>
                      <td className="p-3 text-sm text-white/55 truncate max-w-[160px]" title={companyName}>{companyName}</td>
                      <td className="p-3 text-sm text-white/50">{formatDate(order.createdAt)}</td>
                      <td className="p-3">
                        <Badge variant={order.status === "delivered" || order.status === "confirmed" ? "success" : order.status === "shipped" || order.status === "processing" ? "info" : order.status === "cancelled" ? "danger" : "default"} size="sm">
                          {orderStatusLabels[order.status] ?? order.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-sm font-medium text-white">{formatPrice(order.pricing.grandTotal)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {stageActions(order)}
                          {canCancel(order.status) && (
                            <IconBtn icon={Ban} label="İptal et" tone="danger" onClick={() => setCancelOrder(order)} />
                          )}
                          <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDelOrder(order)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelOrder && (
        <ConfirmDialog
          title="Siparişi İptal Et"
          message={`"${cancelOrder.orderNumber}" numaralı sipariş iptal edilecek. Devam edilsin mi?`}
          confirmLabel="İptal Et"
          onCancel={() => setCancelOrder(null)}
          onConfirm={async () => {
            try {
              await updateOrderStatus(cancelOrder.id, "cancelled")
              toast.success("Sipariş iptal edildi")
              setCancelOrder(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "İşlem başarısız")
            }
          }}
        />
      )}
      {delOrder && (
        <ConfirmDialog
          title="Siparişi Sil"
          message={`"${delOrder.orderNumber}" numaralı sipariş kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          onCancel={() => setDelOrder(null)}
          onConfirm={async () => {
            try {
              await deleteOrder(delOrder.id)
              toast.success("Sipariş silindi")
              setDelOrder(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}

export function missingOrder(o: Order): string[] {
  const m: string[] = []
  if (!o.items || o.items.length === 0) m.push("ürün yok")
  if (!o.pricing?.grandTotal || o.pricing.grandTotal <= 0) m.push("tutar")
  return m
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export function AdminWarehouses() {
  const { data: warehouses, loading, refetch } = useData(() => getAllWarehouses(), [])
  const { data: users } = useData(() => getAllUsers(), [])
  const [form, setForm] = useState<Warehouse | "new" | null>(null)
  const [del, setDel] = useState<Warehouse | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")

  const managerOptions = useMemo(() => {
    return (users ?? [])
      .filter((u) => u.isActive)
      .map((u) => `${u.name} ${u.surname}`.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "tr"))
  }, [users])

  const cityOptions = useMemo(
    () => [...new Set((warehouses ?? []).map((w) => w.address?.city?.trim()).filter(Boolean) as string[])],
    [warehouses]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (warehouses ?? []).filter((wh) => {
      if (status === "active" && !wh.isActive) return false
      if (status === "inactive" && wh.isActive) return false
      if (!q) return true
      return (
        wh.name.toLowerCase().includes(q) ||
        wh.code.toLowerCase().includes(q) ||
        (wh.manager || "").toLowerCase().includes(q) ||
        (wh.address?.city || "").toLowerCase().includes(q)
      )
    })
  }, [warehouses, search, status])

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={WarehouseIcon}
        tone="info"
        title="Depo Yönetimi"
        subtitle={`${filtered.length} / ${warehouses?.length ?? 0} depo`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Depo</Button>}
      />

      <div className="rounded-2xl border border-border bg-card/60 p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, kod, sorumlu, şehir ara…"
            className={cn(inputCls, "pl-9")}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={cn(inputCls, "sm:w-40 cursor-pointer")}
        >
          <option value="all" className="bg-card">Tüm durum</option>
          <option value="active" className="bg-card">Aktif</option>
          <option value="inactive" className="bg-card">Pasif</option>
        </select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (warehouses?.length ?? 0) === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <WarehouseIcon size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40 mb-3">Henüz depo bulunmuyor</p>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Depo</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <Search size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Filtrelere uyan depo yok</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wh) => {
            const pct = wh.capacity > 0 ? Math.round((wh.usedCapacity / wh.capacity) * 100) : 0
            const missing = wh.manager ? [] : ["sorumlu"]
            const barColor = pct >= 90 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-accent"
            return (
              <GlassCard key={wh.id} intensity="light" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center"><WarehouseIcon size={18} /></div>
                  <div className="flex items-center gap-1">
                    <Badge variant={wh.isActive ? "success" : "default"} size="sm">{wh.isActive ? "Aktif" : "Pasif"}</Badge>
                    <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(wh)} />
                    <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(wh)} />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">{wh.name}<Warn items={missing} /></h3>
                <p className="text-xs text-white/40 mt-1">{[wh.address.city, wh.address.district].filter(Boolean).join(" ") || "Konum yok"}</p>
                <div className="flex items-center justify-between mt-4 text-xs text-white/40">
                  <span className={cn(pct >= 80 && "text-warning font-medium")}>Kapasite: %{pct}</span>
                  <span>{wh.manager || "—"}</span>
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className={cn("absolute left-0 top-0 h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {form && (
        <WarehouseForm
          warehouse={form === "new" ? null : form}
          managerOptions={managerOptions}
          cityOptions={cityOptions}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refetch() }}
        />
      )}
      {del && (
        <ConfirmDialog
          title="Depoyu Sil"
          message={`"${del.name}" silinecek. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteWarehouse(del.id)
              toast.success("Depo silindi")
              setDel(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}

export function WarehouseForm({
  warehouse,
  managerOptions = [],
  cityOptions = [],
  onClose,
  onSaved,
}: {
  warehouse: Warehouse | null
  managerOptions?: string[]
  cityOptions?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!warehouse
  const [name, setName] = useState(warehouse?.name ?? "")
  const [code, setCode] = useState(warehouse?.code ?? "")
  const [manager, setManager] = useState(warehouse?.manager ?? "")
  const [phone, setPhone] = useState(warehouse?.phone ?? "")
  const [workingHours, setWorkingHours] = useState(warehouse?.workingHours ?? "")
  const [capacity, setCapacity] = useState(String(warehouse?.capacity ?? "0"))
  const [usedCapacity, setUsedCapacity] = useState(String(warehouse?.usedCapacity ?? "0"))
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true)
  const [address, setAddress] = useState<Address>(warehouse?.address ?? emptyAddress)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !code.trim()) { toast.error("Ad ve kod gerekli"); return }
    setSaving(true)
    const input: WarehouseInput = {
      name, code, manager, phone, workingHours,
      capacity: Number(capacity) || 0,
      usedCapacity: Number(usedCapacity) || 0,
      isActive, address,
    }
    try {
      if (isEdit && warehouse) { await updateWarehouse(warehouse.id, input); toast.success("Depo güncellendi") }
      else { await createWarehouse(input); toast.success("Depo oluşturuldu") }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  const managers = useMemo(
    () => [...new Set([...managerOptions, manager].filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [managerOptions, manager]
  )

  return (
    <Modal title={isEdit ? "Depoyu Düzenle" : "Yeni Depo"} icon={WarehouseIcon} size="lg" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Depo Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Kod"><input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} /></Field>
        <Field label="Sorumlu">
          <select value={manager} onChange={(e) => setManager(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
            <option value="" className="bg-card">Seçin veya aşağıya yazın…</option>
            {managers.map((m) => (
              <option key={m} value={m} className="bg-card">{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Sorumlu (serbest)">
          <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Listede yoksa yazın" className={inputCls} />
        </Field>
        <Field label="Telefon"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
        <Field label="Çalışma Saatleri"><input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} className={inputCls} /></Field>
        <Field label="Kapasite"><input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} /></Field>
        <Field label="Kullanılan"><input type="number" value={usedCapacity} onChange={(e) => setUsedCapacity(e.target.value)} className={inputCls} /></Field>
      </div>
      <AddressFields value={address} onChange={setAddress} cityOptions={cityOptions} />
      <Toggle checked={isActive} onChange={setIsActive} label="Depo aktif" />
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function AdminCampaigns() {
  const { data: campaigns, loading, refetch } = useData(() => getAllCampaigns(), [])
  const { data: categoryOptions } = useData(() => getCategories(), [])
  const { data: vehicleBrandOptions } = useData(() => getVehicleBrands(), [])
  const [form, setForm] = useState<Campaign | "new" | null>(null)
  const [del, setDel] = useState<Campaign | null>(null)
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "expired" | "upcoming">("all")

  const now = Date.now()

  const filtered = useMemo(() => {
    const list = campaigns ?? []
    return list.filter((c) => {
      const start = new Date(c.startDate).getTime()
      const end = new Date(c.endDate).getTime()
      if (filter === "active") return c.isActive && start <= now && end >= now
      if (filter === "inactive") return !c.isActive
      if (filter === "expired") return end < now
      if (filter === "upcoming") return start > now
      return true
    })
  }, [campaigns, filter, now])

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
        subtitle={`${filtered.length} / ${campaigns?.length ?? 0} kampanya`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Kampanya</Button>}
      />

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "all" as const, label: "Tümü" },
            { id: "active" as const, label: "Aktif" },
            { id: "inactive" as const, label: "Pasif" },
            { id: "upcoming" as const, label: "Yaklaşan" },
            { id: "expired" as const, label: "Süresi dolmuş" },
          ]
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors",
              filter === f.id
                ? "bg-accent/15 border-accent/40 text-accent"
                : "border-white/10 text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : (campaigns?.length ?? 0) === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <Percent size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40 mb-3">Henüz kampanya yok</p>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Kampanya</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border bg-card/40">
          <Search size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Bu filtrede kampanya yok</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const expired = new Date(c.endDate).getTime() < now
            const targetBits = [
              c.categories?.length ? `${c.categories.length} kategori` : null,
              c.brands?.length ? `${c.brands.length} marka` : null,
            ].filter(Boolean)
            return (
              <GlassCard key={c.id} intensity="light" className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={c.isActive && !expired ? "premium" : "default"} pulsing={c.isActive && !expired}>
                      {expired ? "Süresi doldu" : c.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn("text-xs mr-1", expired ? "text-danger/70" : "text-white/30")}>
                      Bitiş: {formatDate(c.endDate)}
                    </span>
                    <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(c)} />
                    <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(c)} />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white">{c.name}</h3>
                <p className="text-sm text-white/50 mt-1">{c.description || (c.discountRate ? `%${c.discountRate} indirim` : "")}</p>
                {targetBits.length > 0 && (
                  <p className="text-[11px] text-accent/80 mt-2">{targetBits.join(" · ")}</p>
                )}
                <div className="flex items-center justify-end mt-4 text-xs">
                  <button onClick={() => toggle(c.id, c.isActive)} className={cn(c.isActive ? "text-danger/70 hover:text-danger" : "text-success hover:text-success/80")}>
                    {c.isActive ? "Devre Dışı Bırak" : "Aktifleştir"}
                  </button>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {form && (
        <CampaignForm
          campaign={form === "new" ? null : form}
          categoryOptions={categoryOptions ?? []}
          vehicleBrandOptions={vehicleBrandOptions ?? []}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refetch() }}
        />
      )}
      {del && (
        <ConfirmDialog
          title="Kampanyayı Sil"
          message={`"${del.name}" silinecek. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteCampaign(del.id)
              toast.success("Kampanya silindi")
              setDel(null)
              refetch()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Silinemedi")
            }
          }}
        />
      )}
    </div>
  )
}

export function CampaignForm({
  campaign,
  categoryOptions = [],
  vehicleBrandOptions = [],
  onClose,
  onSaved,
}: {
  campaign: Campaign | null
  categoryOptions?: string[]
  vehicleBrandOptions?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!campaign
  const [name, setName] = useState(campaign?.name ?? "")
  const [description, setDescription] = useState(campaign?.description ?? "")
  const [discountRate, setDiscountRate] = useState(String(campaign?.discountRate ?? "10"))
  const [startDate, setStartDate] = useState((campaign ? new Date(campaign.startDate) : new Date()).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState((campaign ? new Date(campaign.endDate) : new Date(Date.now() + 30 * 864e5)).toISOString().slice(0, 10))
  const [categories, setCategories] = useState<string[]>(campaign?.categories ?? [])
  const [brands, setBrands] = useState<string[]>(campaign?.brands ?? [])
  const [catQuery, setCatQuery] = useState("")
  const [brandQuery, setBrandQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const allCategories = useMemo(
    () => [...new Set([...categoryOptions, ...categories].filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [categoryOptions, categories]
  )
  const allBrands = useMemo(
    () => [...new Set([...COMMON_VEHICLE_BRANDS, ...vehicleBrandOptions, ...brands].filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [vehicleBrandOptions, brands]
  )

  const filteredCats = allCategories.filter((c) => !catQuery.trim() || c.toLowerCase().includes(catQuery.trim().toLowerCase()))
  const filteredBrands = allBrands.filter((b) => !brandQuery.trim() || b.toLowerCase().includes(brandQuery.trim().toLowerCase()))

  const toggleIn = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  }

  const submit = async () => {
    if (!name.trim()) { toast.error("Kampanya adı gerekli"); return }
    setSaving(true)
    const input: CreateCampaignInput = {
      name,
      description,
      type: "discount",
      discountRate: Number(discountRate) || 0,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      categories,
      brands,
    }
    try {
      if (isEdit && campaign) { await updateCampaign(campaign.id, input); toast.success("Kampanya güncellendi") }
      else { await createCampaign(input); toast.success("Kampanya oluşturuldu") }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? "Kampanyayı Düzenle" : "Yeni Kampanya"} icon={Percent} size="lg" onClose={onClose}>
      <Field label="Kampanya Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Açıklama"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
      <Field label="İndirim Oranı (%)"><input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Başlangıç"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Bitiş"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/50">Hedef kategoriler {categories.length > 0 && <span className="text-white/30">· {categories.length}</span>}</p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => toggleIn(categories, setCategories, c)} className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/35 text-accent inline-flex items-center gap-1">
                {c}<X size={11} />
              </button>
            ))}
          </div>
        )}
        <input value={catQuery} onChange={(e) => setCatQuery(e.target.value)} placeholder="Kategori ara…" className={inputCls} />
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border bg-white/[0.02] p-2 flex flex-wrap gap-1.5">
          {filteredCats.slice(0, 40).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleIn(categories, setCategories, c)}
              className={cn(
                "text-[11px] px-2.5 py-1.5 rounded-lg border",
                categories.includes(c) ? "bg-accent/15 border-accent/40 text-accent" : "border-white/10 text-white/55 hover:bg-white/5"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/50">Hedef araç markaları {brands.length > 0 && <span className="text-white/30">· {brands.length}</span>}</p>
        {brands.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <button key={b} type="button" onClick={() => toggleIn(brands, setBrands, b)} className="text-[11px] px-2.5 py-1 rounded-lg bg-accent/15 border border-accent/35 text-accent inline-flex items-center gap-1">
                {b}<X size={11} />
              </button>
            ))}
          </div>
        )}
        <input value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder="Araç markası ara…" className={inputCls} />
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border bg-white/[0.02] p-2 flex flex-wrap gap-1.5">
          {filteredBrands.slice(0, 40).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggleIn(brands, setBrands, b)}
              className={cn(
                "text-[11px] px-2.5 py-1.5 rounded-lg border",
                brands.includes(b) ? "bg-accent/15 border-accent/40 text-accent" : "border-white/10 text-white/55 hover:bg-white/5"
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

