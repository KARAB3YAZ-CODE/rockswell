"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { canManageUsers } from "@/lib/permissions"
import { supabase } from "@/lib/supabase"
import { Users, UserPlus } from "lucide-react"
import Link from "next/link"

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"

const ROLE_OPTIONS = [
  { value: "company_admin", label: "Firma yöneticisi" },
  { value: "purchase_manager", label: "Satın alma" },
  { value: "finance_user", label: "Finans" },
  { value: "warehouse_user", label: "Depo" },
  { value: "sales_manager", label: "Satış" },
] as const

type TeamUser = {
  id: string
  name: string
  surname: string
  role: string
  phone: string
  isActive: boolean
  email: string
  createdAt: string
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  }
}

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth()
  const allowed = canManageUsers(user)
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    email: "",
    name: "",
    surname: "",
    phone: "",
    role: "purchase_manager",
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/company/users", { headers: await authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Yüklenemedi")
      setUsers(json.users ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Takım yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && allowed) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, allowed, user?.id])

  const invite = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      toast.error("E-posta ve ad gerekli")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Oluşturulamadı")
      toast.success("Kullanıcı eklendi — şifre sıfırlama ile giriş yapabilir")
      setForm({ email: "", name: "", surname: "", phone: "", role: "purchase_manager" })
      setShowForm(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Oluşturulamadı")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: TeamUser) => {
    try {
      const res = await fetch(`/api/company/users/${u.id}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Güncellenemedi")
      toast.success(u.isActive ? "Kullanıcı pasifleştirildi" : "Kullanıcı aktifleştirildi")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    }
  }

  if (authLoading) return null

  if (!allowed) {
    return (
      <Shell>
        <GlassCard intensity="light" className="p-8 text-center max-w-lg mx-auto">
          <p className="text-white/70">Takım yönetimi için firma yöneticisi olmalısınız.</p>
          <Link href="/home" className="text-accent text-sm mt-3 inline-block">Ana sayfa</Link>
        </GlassCard>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-accent" /> Takım
            </h2>
            <p className="text-sm text-white/40">Firma kullanıcılarını yönetin</p>
          </div>
          <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setShowForm((v) => !v)}>
            Kullanıcı ekle
          </Button>
        </div>

        {showForm && (
          <GlassCard intensity="light" className="p-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="E-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <select
                className={inputCls}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-card">{r.label}</option>
                ))}
              </select>
              <input className={inputCls} placeholder="Ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={inputCls} placeholder="Soyad" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
              <input className={inputCls} placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <p className="text-[11px] text-white/35">
              Geçici şifre oluşturulur. Kullanıcı “şifremi unuttum” ile kendi şifresini belirlemelidir.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={invite} disabled={saving}>{saving ? "…" : "Ekle"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Vazgeç</Button>
            </div>
          </GlassCard>
        )}

        {loading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <GlassCard intensity="light" className="divide-y divide-white/5">
            {users.length === 0 ? (
              <p className="p-6 text-sm text-white/40 text-center">Henüz kullanıcı yok</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {u.name} {u.surname}
                      {u.id === user?.id ? " (siz)" : ""}
                    </p>
                    <p className="text-xs text-white/40 truncate">{u.email || "—"}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge size="sm" variant="default">
                        {ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role}
                      </Badge>
                      <Badge size="sm" variant={u.isActive ? "success" : "danger"}>
                        {u.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                  </div>
                  {u.id !== user?.id && (
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(u)}>
                      {u.isActive ? "Pasifleştir" : "Aktifleştir"}
                    </Button>
                  )}
                </div>
              ))
            )}
          </GlassCard>
        )}
      </div>
    </Shell>
  )
}
