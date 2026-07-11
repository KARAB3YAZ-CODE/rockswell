"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { ADMIN_PATH_PREFIX } from "@/lib/admin-host"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import { cn } from "@/lib/utils"
import {
  Activity, Users, Building2, Package, ShoppingBag,
  Warehouse, Percent, FileText, BarChart3, Settings,
  LogOut, ExternalLink, Bot, LayoutTemplate, MessageSquare, Tag,
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

  return (
    <div className="min-h-screen bg-background text-white flex">
      <aside className="w-60 shrink-0 border-r border-border bg-card/40 flex flex-col sticky top-0 h-screen">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-black font-bold">R</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">ROCKSWELL Admin</p>
              <p className="text-[10px] text-white/40 truncate">Yönetim Paneli</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {nav.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={toAppPath(item.href)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/5"
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
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-danger/80 hover:bg-danger/10"
          >
            <LogOut size={14} /> Çıkış
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 overflow-auto">{children}</main>
    </div>
  )
}
