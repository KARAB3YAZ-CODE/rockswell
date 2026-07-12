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
import { supabase } from "@/lib/supabase"
import { MIN_PASSWORD_LENGTH, passwordPolicyHint } from "@/lib/password"
import { Key, Save, Shield } from "lucide-react"

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

  const [mfaFactors, setMfaFactors] = useState<{ id: string; friendly_name?: string }[]>([])
  const [enrollQr, setEnrollQr] = useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [enrollCode, setEnrollCode] = useState("")
  const [mfaBusy, setMfaBusy] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setSurname(user.surname)
      setPhone(user.phone)
    }
  }, [user])

  const refreshMfa = async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors()
      setMfaFactors((data?.totp ?? []).map((f) => ({ id: f.id, friendly_name: f.friendly_name })))
    } catch {
      setMfaFactors([])
    }
  }

  useEffect(() => {
    if (user) void refreshMfa()
  }, [user?.id])

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
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
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

  const startEnroll = async () => {
    setMfaBusy(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      })
      if (error) throw error
      setEnrollFactorId(data.id)
      setEnrollQr(data.totp.qr_code)
      toast.success("QR kodu authenticator uygulamanızla tarayın")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MFA etkinleştirilemedi (projede TOTP açık olmalı)")
    } finally {
      setMfaBusy(false)
    }
  }

  const confirmEnroll = async () => {
    if (!enrollFactorId || !/^\d{6}$/.test(enrollCode.trim())) {
      toast.error("6 haneli kod girin")
      return
    }
    setMfaBusy(true)
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      })
      if (cErr || !challenge) throw cErr ?? new Error("Challenge başarısız")
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.id,
        code: enrollCode.trim(),
      })
      if (vErr) throw vErr
      toast.success("İki adımlı doğrulama açıldı")
      setEnrollQr(null)
      setEnrollFactorId(null)
      setEnrollCode("")
      await refreshMfa()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Doğrulama başarısız")
    } finally {
      setMfaBusy(false)
    }
  }

  const unenroll = async (factorId: string) => {
    if (!window.confirm("İki adımlı doğrulamayı kapatmak istiyor musunuz?")) return
    setMfaBusy(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
      toast.success("MFA kapatıldı")
      await refreshMfa()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kapatılamadı")
    } finally {
      setMfaBusy(false)
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
              <label className="text-xs text-white/40">Yeni şifre</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={passwordPolicyHint()}
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs text-white/40">Şifre tekrar</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </div>
          </div>
          <Button size="sm" onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? "Kaydediliyor..." : "Şifreyi Güncelle"}
          </Button>
        </GlassCard>

        <GlassCard intensity="light" className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={14} className="text-accent" /> İki adımlı doğrulama (TOTP)
          </h3>
          <p className="text-xs text-white/40">
            Authenticator uygulaması (Google Authenticator, 1Password vb.) ile girişte ek kod isteyin.
          </p>
          {mfaFactors.length > 0 ? (
            <div className="space-y-2">
              {mfaFactors.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-white/70">{f.friendly_name || "Authenticator"} · aktif</span>
                  <Button size="sm" variant="secondary" disabled={mfaBusy} onClick={() => unenroll(f.id)}>
                    Kapat
                  </Button>
                </div>
              ))}
            </div>
          ) : enrollQr ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollQr} alt="MFA QR" className="w-48 h-48 rounded-lg bg-white p-2" />
              <input
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value)}
                placeholder="Uygulamadaki 6 haneli kod"
                className={inputCls}
                maxLength={6}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={mfaBusy} onClick={confirmEnroll}>
                  Doğrula ve aç
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEnrollQr(null)
                    setEnrollFactorId(null)
                  }}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" disabled={mfaBusy} onClick={startEnroll}>
              MFA etkinleştir
            </Button>
          )}
        </GlassCard>
      </div>
    </Shell>
  )
}
