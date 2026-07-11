"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { ADMIN_PATH_PREFIX } from "@/lib/admin-host"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import { cn } from "@/lib/utils"
import {
  Activity, Users, Building2, Package, ShoppingBag,
  Warehouse, Percent, FileText, BarChart3, Settings,
  LogOut, ExternalLink, Bot, LayoutTemplate, MessageSquare, Tag, Menu, X,
} from "lucide-react"

const nav = [
  { href: "/", label: "Genel Bakış", icon: Activity },
  { href: "/assistant", label: "AI Asistan", icon: Bot },
  { href: "/home", label: "Ana Sayfa", icon: LayoutTemplate },
  { href: "/users", label: "Kullanıcılar", icon: Users },
  { href: "/companies", label: "Şirketler", icon: Building2 },
  { href: "/products", label: "Ürünler", icon: Package },
  { href: "/prices", label: "Fiyat Listeleri", icon: Tag },
  { href: "/orders", label: "Siparişler", icon: ShoppingBag },
  { href: "/warehouses", label: "Depolar", icon: Warehouse },
  { href: "/campaigns", label: "Kampanyalar", icon: Percent },
  { href: "/invoices", label: "Faturalar", icon: FileText },
  { href: "/support", label: "Destek", icon: MessageSquare },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/settings", label: "Sistem", icon: Settings },
]

function toAppPath(href: string) {
  if (href === "/") return ADMIN_PATH_PREFIX
  return `${ADMIN_PATH_PREFIX}${href}`
}

function isActive(pathname: string, href: string) {
  const full = toAppPath(href)
  if (href === "/") return pathname === ADMIN_PATH_PREFIX || pathname === `${ADMIN_PATH_PREFIX}/`
  return pathname === full || pathname.startsWith(`${full}/`)
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const Nav = (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <span className="text-black font-bold">R</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">ROCKSWELL Admin</p>
            <p className="text-[10px] text-white/40 truncate">Yönetim Paneli</p>
          </div>
        </div>
        <button
          type="button"
          className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:bg-white/5"
          onClick={() => setMobileOpen(false)}
          aria-label="Menüyü kapat"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-0.5">
        {nav.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={toAppPath(item.href)}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 min-h-11 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={16} className="shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <a
          href={siteAbsoluteUrl("/home")}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/5"
        >
          <ExternalLink size={14} /> Mağazaya git
        </a>
        <div className="px-3 py-1">
          <p className="text-xs text-white/70 truncate">{user ? `${user.name} ${user.surname}` : "—"}</p>
          <p className="text-[10px] text-white/30 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await logout()
            router.replace(`${ADMIN_PATH_PREFIX}/login`)
          }}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs text-danger/80 hover:bg-danger/10"
        >
          <LogOut size={14} /> Çıkış
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background text-white flex">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "w-60 shrink-0 border-r border-border bg-card/40 flex flex-col",
          "fixed lg:sticky top-0 h-screen z-50 transition-transform duration-300",
          "pt-[env(safe-area-inset-top)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {Nav}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-3 border-b border-border bg-background/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/5"
            aria-label="Menü"
          >
            <Menu size={20} />
          </button>
          <p className="text-sm font-semibold text-white truncate">Admin</p>
        </div>
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 overflow-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
