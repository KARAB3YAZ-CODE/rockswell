"use client"

import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { Shell } from "@/components/layout/shell"
import { GlassCard } from "@/components/effects/glass-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useUIStore } from "@/lib/store"
import { updateProfile, changePassword } from "@/lib/api"
import { Key, Save } from "lucide-react"

const inputCls = "w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40 disabled:opacity-50"

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const setCurrentUser = useUIStore((s) => s.setCurrentUser)

  const [name, setName] = useState("")
  const [surname, setSurname] = useState("")
  const [phone, setPhone] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setSurname(user.surname)
      setPhone(user.phone)
    }
  }, [user])

  const handleSaveProfile = async () => {
    if (!name.trim() || !surname.trim()) {
      toast.error("Ad ve soyad gerekli")
      return
    }
    setSavingProfile(true)
    try {
      const updated = await updateProfile({ name, surname, phone })
      setCurrentUser(updated)
      toast.success("Profil güncellendi")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor")
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(newPassword)
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Şifreniz güncellendi")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Şifre güncellenemedi")
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="max-w-3xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-60 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell>
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Ayarlar</h2>
          <p className="text-sm text-white/40">Veri bulunamadı.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Ayarlar</h2>
          <p className="text-sm text-white/40">Hesap ve güvenlik ayarları</p>
        </div>

        <GlassCard intensity="light" className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Profil Bilgileri</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40">Ad</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="text-xs text-white/40">Soyad</label>
              <input value={surname} onChange={(e) => setSurname(e.target.value)} className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="text-xs text-white/40">E-posta</label>
              <input value={user.email} disabled className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="text-xs text-white/40">Telefon</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} mt-1`} />
            </div>
          </div>
          <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Kaydediliyor..." : "Bilgileri Kaydet"}
          </Button>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key size={14} className="text-accent" /> Şifre Değiştir
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/40">Yeni Şifre</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" className={`${inputCls} mt-1`} />
            </div>
            <div>
              <label className="text-xs text-white/40">Yeni Şifre (Tekrar)</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} mt-1`} />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? "Güncelleniyor..." : "Şifreyi Güncelle"}
          </Button>
        </GlassCard>
      </div>
    </Shell>
  )
}
