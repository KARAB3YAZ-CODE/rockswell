"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Address } from "@/lib/types"
import { AlertTriangle, X } from "lucide-react"

export const emptyAddress: Address = { street: "", city: "", district: "", country: "Türkiye", zipCode: "" }

export const orderStatusLabels: Record<string, string> = {
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

export const statStyles: Record<string, { text: string; chip: string; glow: string; from: string }> = {
  info: { text: "text-info", chip: "bg-info/10 text-info border-info/20", glow: "shadow-info/10", from: "from-info/10" },
  accent: { text: "text-accent", chip: "bg-accent/10 text-accent border-accent/20", glow: "shadow-accent/10", from: "from-accent/10" },
  success: { text: "text-success", chip: "bg-success/10 text-success border-success/20", glow: "shadow-success/10", from: "from-success/10" },
  warning: { text: "text-warning", chip: "bg-warning/10 text-warning border-warning/20", glow: "shadow-warning/10", from: "from-warning/10" },
}

export const inputCls = "w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-accent/40"

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function AddressFields({
  value,
  onChange,
  cityOptions = [],
}: {
  value: Address
  onChange: (a: Address) => void
  cityOptions?: string[]
}) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v })
  const cities = [...new Set(cityOptions.map((c) => c.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr")
  )
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="İl">
        <input
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          list={cities.length ? "admin-city-options" : undefined}
          className={inputCls}
          placeholder="İl seçin veya yazın"
        />
        {cities.length > 0 && (
          <datalist id="admin-city-options">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </Field>
      <Field label="İlçe"><input value={value.district} onChange={(e) => set("district", e.target.value)} className={inputCls} /></Field>
      <div className="col-span-2"><Field label="Açık Adres"><input value={value.street} onChange={(e) => set("street", e.target.value)} className={inputCls} /></Field></div>
      <Field label="Posta Kodu"><input value={value.zipCode} onChange={(e) => set("zipCode", e.target.value)} className={inputCls} /></Field>
      <Field label="Ülke"><input value={value.country} onChange={(e) => set("country", e.target.value)} className={inputCls} /></Field>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <span className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0", checked ? "bg-accent" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      <span className="text-sm text-white/70">{label}</span>
    </button>
  )
}

export function Warn({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <span title={`Eksik: ${items.join(", ")}`} className="inline-flex items-center gap-1 text-[10px] text-warning bg-warning/10 border border-warning/20 rounded px-1.5 py-0.5 whitespace-nowrap">
      <AlertTriangle size={10} /> Eksik: {items.join(", ")}
    </span>
  )
}

export function IconBtn({ icon: Icon, label, onClick, tone = "default", disabled }: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
  tone?: "default" | "danger"
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40",
        tone === "danger" ? "text-white/30 hover:text-danger hover:bg-danger/10" : "text-white/30 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon size={14} />
    </button>
  )
}

export function Modal({ title, subtitle, icon: Icon, onClose, children, size = "md" }: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ size?: number }>
  onClose: () => void
  children: React.ReactNode
  size?: "md" | "lg"
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={cn("w-full bg-card border border-border rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-auto", size === "lg" ? "max-w-3xl" : "max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><Icon size={16} /></div>}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">{title}</h3>
              {subtitle && <p className="text-xs text-white/40 truncate">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white shrink-0"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = "Sil", onConfirm, onCancel }: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onCancel()}>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0"><AlertTriangle size={16} /></div>
          <h3 className="text-base font-bold text-white">{title}</h3>
        </div>
        <p className="text-sm text-white/60">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Vazgeç</Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}
          >
            {busy ? "İşleniyor..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SectionHeader({
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
