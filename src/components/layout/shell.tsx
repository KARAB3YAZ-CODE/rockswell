"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { MouseGlowVariant } from "@/components/effects/mouse-glow"
import { useAuth } from "@/lib/auth"
import { useUIStore } from "@/lib/store"
import { useData } from "@/hooks/use-data"
import { getSiteSettings } from "@/lib/api"
import { cn } from "@/lib/utils"
import { canAccessPath } from "@/lib/permissions"
import { Wrench, Tag } from "lucide-react"

function formatTrDate(iso: string | null): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-warning/15 border border-warning/30 flex items-center justify-center">
          <Wrench size={28} className="text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Bakım Modu</h1>
          <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        <p className="text-xs text-white/30">ROCKSWELL · Sistem geçici olarak kapalı</p>
      </div>
    </div>
  )
}

function PriceUpdateBanner({
  date,
  message,
}: {
  date: string | null
  message: string
}) {
  const dateLabel = formatTrDate(date)
  const text =
    message.trim() ||
    (dateLabel
      ? `Fiyatlarımız ${dateLabel} tarihinde güncellenecektir.`
      : "Fiyatlarımız yakında güncellenecektir.")

  return (
    <div className="mx-4 lg:mx-6 mt-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 flex items-start gap-3">
      <Tag size={16} className="text-accent shrink-0 mt-0.5" />
      <p className="text-sm text-accent/95 leading-snug">{text}</p>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isAdmin, loading, user } = useAuth()
  const { sidebarOpen } = useUIStore()
  const { data: settings } = useData(
    () => (isAuthenticated ? getSiteSettings() : Promise.resolve(null)),
    [isAuthenticated]
  )

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (loading || !isAuthenticated || !user || isAdmin) return
    if (!canAccessPath(user, pathname)) {
      router.replace("/home")
    }
  }, [loading, isAuthenticated, user, isAdmin, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-black font-bold text-sm">R</span>
          </div>
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const maintenanceOn = Boolean(settings?.maintenanceEnabled) && !isAdmin
  if (maintenanceOn) {
    return (
      <MaintenanceScreen
        message={settings?.maintenanceMessage || "Sistemimiz şu an bakımda. Lütfen daha sonra tekrar deneyin."}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-white antialiased">
      <MouseGlowVariant />
      <Sidebar />
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          sidebarOpen ? "lg:ml-[240px]" : "lg:ml-[72px]"
        )}
      >
        <Header />
        {settings?.priceUpdateEnabled && (
          <PriceUpdateBanner date={settings.priceUpdateDate} message={settings.priceUpdateMessage} />
        )}
        {settings?.maintenanceEnabled && isAdmin && (
          <div className="mx-4 lg:mx-6 mt-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-2.5 text-sm text-warning/90">
            Bakım modu açık — firmalar mağazayı göremez. Siz admin olarak erişiyorsunuz.
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <footer className="px-4 lg:px-6 pb-4 pt-1">
          <a
            href="https://karabeyaz.net"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/karabeyaz.png"
              alt="karabeyaz.net"
              className="h-5 w-auto opacity-70 group-hover:opacity-90 transition-opacity"
            />
            <span className="text-[10px] sm:text-[11px] leading-snug text-white/35 group-hover:text-white/50 transition-colors text-center">
              B2B sistemi{" "}
              <span className="text-white/55 group-hover:text-white/70">karabeyaz.net</span>
              {" "}tarafından kurulmuştur · uçtan uca şifrelenmiştir
            </span>
          </a>
        </footer>
      </div>
    </div>
  )
}
