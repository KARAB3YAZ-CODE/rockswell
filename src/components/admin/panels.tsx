"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton"
import { useProducts, useOrders, useData } from "@/hooks/use-data"
import {
  getAdminStats, getAllUsers, getAllCompanies, getAllCampaigns, getAllWarehouses,
  createCampaign, updateCampaign, deleteCampaign, setCampaignActive,
  setProductActive, createProduct, updateProduct, deleteProduct, uploadProductImage,
  createCompany, updateCompany, deleteCompany,
  createWarehouse, updateWarehouse, deleteWarehouse,
  updateOrderStatus, deleteOrder,
  updateUserByAdmin, adminCreateUser, adminDeleteUser,
  type CompanyInput, type ProductInput, type WarehouseInput, type CreateCampaignInput,
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
  KeyRound, Copy, Check, Pencil, Trash2, Ban, UserPlus,
  ImagePlus, Star, Link2,
} from "lucide-react"
import { ROLE_LABELS } from "@/lib/roles"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import {
  inputCls, Field, AddressFields, Toggle, Warn, IconBtn, Modal, ConfirmDialog, SectionHeader, statStyles, emptyAddress, orderStatusLabels,
} from "@/components/admin/ui"

const roleLabels = ROLE_LABELS as Record<string, string>

export function AdminOverview() {
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
                        <a href={siteAbsoluteUrl(`/orders/${order.id}`)} className="hover:text-accent">{order.orderNumber}</a>
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

// ─── Users ────────────────────────────────────────────────────────────────────

export function AdminUsers() {
  const { data: users, loading, refetch } = useData(() => getAllUsers(), [])
  const { data: companies } = useData(() => getAllCompanies(), [])
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState<{ name: string; link: string } | null>(null)
  const [formUser, setFormUser] = useState<AdminUserRow | "new" | null>(null)
  const [delUser, setDelUser] = useState<AdminUserRow | null>(null)

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
      <SectionHeader
        icon={Users}
        tone="info"
        title="Kullanıcı Yönetimi"
        subtitle={`${users?.length ?? 0} kullanıcı`}
        action={<Button size="sm" icon={<UserPlus size={14} />} onClick={() => setFormUser("new")}>Yeni Kullanıcı</Button>}
      />
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
                <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const missing = missingUser(user)
                return (
                <tr key={user.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
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
                  <td className="p-4 text-sm text-white/60">{user.companyName}</td>
                  <td className="p-4 text-sm text-white/60">{roleLabels[user.role] ?? user.role}</td>
                  <td className="p-4">
                    <Badge variant={user.isActive ? "success" : "default"} size="sm">{user.isActive ? "Aktif" : "Pasif"}</Badge>
                  </td>
                  <td className="p-4">
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
  const [companyId, setCompanyId] = useState<string>("")
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
            <option value="" className="bg-card">{isEdit ? "Değiştirme" : "Yeni firma…"}</option>
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

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Building2}
        tone="accent"
        title="Şirket Yönetimi"
        subtitle={`${companies?.length ?? 0} şirket`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Şirket</Button>}
      />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (companies?.length ?? 0) === 0 ? (
        <div className="text-center py-12"><Building2 size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Şirket bulunamadı</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies!.map((c) => {
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
              </div>
            </GlassCard>
            )
          })}
        </div>
      )}

      {form && (
        <CompanyForm company={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refetch() }} />
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

export function CompanyForm({ company, onClose, onSaved }: { company: Company | null; onClose: () => void; onSaved: () => void }) {
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
      <AddressFields value={address} onChange={setAddress} />
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function AdminProducts() {
  const { products, loading, refetch } = useProducts()
  const [productSearch, setProductSearch] = useState("")
  const [form, setForm] = useState<Product | "new" | null>(null)
  const [del, setDel] = useState<Product | null>(null)

  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
    .slice(0, 40)

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
      <SectionHeader
        icon={Package}
        tone="success"
        title="Ürün Yönetimi"
        subtitle={`${products.length} ürün`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Ürün</Button>}
      />
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
                  <th className="text-center text-xs font-medium text-white/30 p-4">Durum</th>
                  <th className="text-right text-xs font-medium text-white/30 p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const missing = missingProduct(product)
                  return (
                  <tr key={product.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                          {product.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.images[0]} alt="" className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <Package size={14} className="text-white/30" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-white/80 flex items-center gap-2">{product.name}<Warn items={missing} /></span>
                          <span className="text-xs text-white/30">{product.brand || "Marka yok"} · {product.category || "Kategori yok"}{product.images.length ? ` · ${product.images.length} foto` : ""}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-white/40 font-mono">{product.sku}</td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(product.basePrice)}</td>
                    <td className="p-4 text-right text-sm text-white/60">{product.stock[0]?.available || 0}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => toggleActive(product.id, product.isActive)} title={product.isActive ? "Pasife al" : "Aktifleştir"}>
                        <Badge variant={product.isActive ? "success" : "default"} size="sm">{product.isActive ? "Aktif" : "Pasif"}</Badge>
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <a href={siteAbsoluteUrl(`/products/${product.id}`)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5"><Eye size={14} /></a>
                        <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(product)} />
                        <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(product)} />
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

      {form && (
        <ProductForm product={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refetch() }} />
      )}
      {del && (
        <ConfirmDialog
          title="Ürünü Sil"
          message={`"${del.name}" kalıcı olarak silinecek. Devam edilsin mi?`}
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            try {
              await deleteProduct(del.id)
              toast.success("Ürün silindi")
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

export function missingProduct(p: Product): string[] {
  const m: string[] = []
  if (!p.basePrice || p.basePrice <= 0) m.push("fiyat")
  if (!p.brand) m.push("marka")
  if (!p.category) m.push("kategori")
  if (!p.images?.length) m.push("fotoğraf")
  return m
}

export function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!product
  const [sku, setSku] = useState(product?.sku ?? "")
  const [name, setName] = useState(product?.name ?? "")
  const [brand, setBrand] = useState(product?.brand ?? "")
  const [category, setCategory] = useState(product?.category ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [basePrice, setBasePrice] = useState(String(product?.basePrice ?? ""))
  const [stockQuantity, setStockQuantity] = useState(String(product?.stock[0]?.available ?? "0"))
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const folderKey = product?.id || sku || "new"

  const addUrl = () => {
    const url = imageUrl.trim()
    if (!url) return
    try {
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      toast.error("Geçerli bir görsel URL girin")
      return
    }
    if (images.includes(url)) {
      toast.error("Bu görsel zaten ekli")
      return
    }
    setImages((prev) => [...prev, url])
    setImageUrl("")
  }

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file, folderKey)
        uploaded.push(url)
      }
      setImages((prev) => [...prev, ...uploaded])
      toast.success(`${uploaded.length} fotoğraf yüklendi`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yükleme başarısız")
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url))
  const makePrimary = (url: string) =>
    setImages((prev) => [url, ...prev.filter((u) => u !== url)])

  const submit = async () => {
    if (!name.trim() || !sku.trim()) { toast.error("Ad ve SKU gerekli"); return }
    setSaving(true)
    const input: ProductInput = {
      sku, name, brand, category, description,
      basePrice: Number(basePrice) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      isActive,
      images,
    }
    try {
      if (isEdit && product) { await updateProduct(product.id, input); toast.success("Ürün güncellendi") }
      else { await createProduct(input); toast.success("Ürün oluşturuldu") }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? "Ürünü Düzenle" : "Yeni Ürün"} icon={Package} size="lg" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ürün Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} /></Field>
        <Field label="Marka"><input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} /></Field>
        <Field label="Kategori"><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} /></Field>
        <Field label="Fiyat (₺)"><input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={inputCls} /></Field>
        <Field label="Stok Adedi"><input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Açıklama"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(inputCls, "h-auto py-2 resize-none")} /></Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/50">Fotoğraflar ({images.length})</p>
          <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent cursor-pointer hover:bg-accent/15">
            <ImagePlus size={13} />
            {uploading ? "Yükleniyor…" : "Dosya yükle"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void onUpload(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <Package size={28} className="mx-auto text-white/20 mb-2" />
            <p className="text-xs text-white/40">Henüz fotoğraf yok. Dosya yükleyin veya URL ekleyin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((url, i) => (
              <div key={url} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-contain p-1.5" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 text-[9px] px-1.5 py-0.5 rounded bg-accent text-black font-medium">
                    Ana
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent">
                  {i !== 0 && (
                    <button
                      type="button"
                      title="Ana fotoğraf yap"
                      onClick={() => makePrimary(url)}
                      className="flex-1 h-7 rounded-md bg-white/10 hover:bg-accent/30 text-white flex items-center justify-center"
                    >
                      <Star size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Kaldır"
                    onClick={() => removeImage(url)}
                    className="flex-1 h-7 rounded-md bg-danger/20 hover:bg-danger/40 text-danger flex items-center justify-center"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl() } }}
              placeholder="veya görsel URL yapıştır…"
              className={cn(inputCls, "pl-9")}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addUrl}>Ekle</Button>
        </div>
        <p className="text-[11px] text-white/30">İlk fotoğraf mağazada ana görsel olur. JPG/PNG/WebP, max 5 MB.</p>
      </div>

      <Toggle checked={isActive} onChange={setIsActive} label="Ürün aktif (mağazada görünür)" />
      <Button className="w-full" onClick={submit} disabled={saving || uploading}>
        {saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}
      </Button>
    </Modal>
  )
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export function AdminOrders() {
  const { orders, loading, refetch } = useOrders()
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)
  const [delOrder, setDelOrder] = useState<Order | null>(null)

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

  const stageActions = (order: Order) => {
    switch (order.status) {
      case "pending_approval":
      case "quotation":
        return (
          <button disabled={busy === order.id} onClick={() => act(order.id, "confirmed", "Sipariş onaylandı")} className="text-xs px-2 py-1 rounded-lg text-success hover:bg-success/5 flex items-center gap-1"><CheckCircle size={12} /> Onayla</button>
        )
      case "confirmed":
      case "approved":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "processing", "Hazırlığa alındı")} className="text-xs px-2 py-1 rounded-lg text-info hover:bg-info/5 flex items-center gap-1"><Package size={12} /> Hazırlığa Al</button>
      case "processing":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "shipped", "Kargoya verildi")} className="text-xs px-2 py-1 rounded-lg text-info hover:bg-info/5 flex items-center gap-1"><Truck size={12} /> Kargola</button>
      case "shipped":
        return <button disabled={busy === order.id} onClick={() => act(order.id, "delivered", "Teslim edildi")} className="text-xs px-2 py-1 rounded-lg text-success hover:bg-success/5 flex items-center gap-1"><CheckCircle size={12} /> Teslim Et</button>
      default:
        return null
    }
  }

  const canCancel = (s: Order["status"]) => !["cancelled", "delivered", "returned"].includes(s)

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
                {orders.map((order) => {
                  const missing = missingOrder(order)
                  return (
                  <tr key={order.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm text-white/80">
                      <a href={siteAbsoluteUrl(`/orders/${order.id}`)} className="hover:text-accent flex items-center gap-2">{order.orderNumber}<Warn items={missing} /></a>
                    </td>
                    <td className="p-4 text-sm text-white/50">{formatDate(order.createdAt)}</td>
                    <td className="p-4">
                      <Badge variant={order.status === "delivered" || order.status === "confirmed" ? "success" : order.status === "shipped" || order.status === "processing" ? "info" : order.status === "cancelled" ? "danger" : "default"} size="sm">
                        {orderStatusLabels[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right text-sm font-medium text-white">{formatPrice(order.pricing.grandTotal)}</td>
                    <td className="p-4">
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
  const [form, setForm] = useState<Warehouse | "new" | null>(null)
  const [del, setDel] = useState<Warehouse | null>(null)

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={WarehouseIcon}
        tone="info"
        title="Depo Yönetimi"
        subtitle={`${warehouses?.length ?? 0} depo`}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Depo</Button>}
      />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (warehouses?.length ?? 0) === 0 ? (
        <div className="text-center py-12"><WarehouseIcon size={32} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Henüz depo bulunmuyor</p></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses!.map((wh) => {
            const pct = wh.capacity > 0 ? Math.round((wh.usedCapacity / wh.capacity) * 100) : 0
            const missing = wh.manager ? [] : ["sorumlu"]
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
                  <span>Kapasite: %{pct}</span>
                  <span>{wh.manager || "—"}</span>
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="absolute left-0 top-0 h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}

      {form && (
        <WarehouseForm warehouse={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refetch() }} />
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

export function WarehouseForm({ warehouse, onClose, onSaved }: { warehouse: Warehouse | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!warehouse
  const [name, setName] = useState(warehouse?.name ?? "")
  const [code, setCode] = useState(warehouse?.code ?? "")
  const [manager, setManager] = useState(warehouse?.manager ?? "")
  const [phone, setPhone] = useState(warehouse?.phone ?? "")
  const [workingHours, setWorkingHours] = useState(warehouse?.workingHours ?? "")
  const [capacity, setCapacity] = useState(String(warehouse?.capacity ?? "0"))
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true)
  const [address, setAddress] = useState<Address>(warehouse?.address ?? emptyAddress)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim() || !code.trim()) { toast.error("Ad ve kod gerekli"); return }
    setSaving(true)
    const input: WarehouseInput = { name, code, manager, phone, workingHours, capacity: Number(capacity) || 0, isActive, address }
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

  return (
    <Modal title={isEdit ? "Depoyu Düzenle" : "Yeni Depo"} icon={WarehouseIcon} size="lg" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Depo Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Kod"><input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} /></Field>
        <Field label="Sorumlu"><input value={manager} onChange={(e) => setManager(e.target.value)} className={inputCls} /></Field>
        <Field label="Telefon"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></Field>
        <Field label="Çalışma Saatleri"><input value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} className={inputCls} /></Field>
        <Field label="Kapasite"><input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} /></Field>
      </div>
      <AddressFields value={address} onChange={setAddress} />
      <Toggle checked={isActive} onChange={setIsActive} label="Depo aktif" />
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function AdminCampaigns() {
  const { data: campaigns, loading, refetch } = useData(() => getAllCampaigns(), [])
  const [form, setForm] = useState<Campaign | "new" | null>(null)
  const [del, setDel] = useState<Campaign | null>(null)

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
        action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setForm("new")}>Yeni Kampanya</Button>}
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
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/30 mr-1">Bitiş: {formatDate(c.endDate)}</span>
                  <IconBtn icon={Pencil} label="Düzenle" onClick={() => setForm(c)} />
                  <IconBtn icon={Trash2} label="Sil" tone="danger" onClick={() => setDel(c)} />
                </div>
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

      {form && (
        <CampaignForm campaign={form === "new" ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refetch() }} />
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

export function CampaignForm({ campaign, onClose, onSaved }: { campaign: Campaign | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!campaign
  const [name, setName] = useState(campaign?.name ?? "")
  const [description, setDescription] = useState(campaign?.description ?? "")
  const [discountRate, setDiscountRate] = useState(String(campaign?.discountRate ?? "10"))
  const [startDate, setStartDate] = useState((campaign ? new Date(campaign.startDate) : new Date()).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState((campaign ? new Date(campaign.endDate) : new Date(Date.now() + 30 * 864e5)).toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

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
    <Modal title={isEdit ? "Kampanyayı Düzenle" : "Yeni Kampanya"} icon={Percent} onClose={onClose}>
      <Field label="Kampanya Adı"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Açıklama"><input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></Field>
      <Field label="İndirim Oranı (%)"><input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Başlangıç"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Bitiş"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></Field>
      </div>
      <Button className="w-full" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Oluştur"}</Button>
    </Modal>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

