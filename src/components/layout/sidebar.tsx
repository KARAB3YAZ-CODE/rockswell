"use client"

import { useAuth } from "@/lib/auth"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/store"
import { adminAbsoluteUrl } from "@/lib/admin-host"
import { allowedNavHrefs } from "@/lib/permissions"
import {
  LayoutDashboard, ShoppingBag, Package,
  FileText, Settings, HelpCircle, LogOut,
  ChevronLeft, MessageSquare, ClipboardList, Percent,
  ChevronDown, Shield, ExternalLink, Building2, BarChart3, Wallet, X, Users,
} from "lucide-react"

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
  badge?: number
  children?: { label: string; href: string }[]
}

const customerNav: NavItem[] = [
  { label: "Ana Sayfa", icon: <LayoutDashboard size={20} />, href: "/home" },
  {
    label: "Ürünler", icon: <Package size={20} />, href: "/products",
    children: [
      { label: "Tüm Ürünler", href: "/products" },
      { label: "Kategoriler", href: "/products/categories" },
      { label: "Markalar", href: "/products/brands" },
      { label: "Sık Sipariş Edilenler", href: "/products/frequent" },
      { label: "Karşılaştırma", href: "/products/compare" },
    ],
  },
  {
    label: "Siparişler", icon: <ShoppingBag size={20} />, href: "/orders",
    children: [
      { label: "Tüm Siparişler", href: "/orders" },
      { label: "Onay Bekleyen", href: "/orders?status=pending_approval" },
      { label: "Kargodakiler", href: "/orders?status=shipped" },
      { label: "İade Talepleri", href: "/orders?returns=1" },
    ],
  },
  { label: "Sepet", icon: <ClipboardList size={20} />, href: "/cart" },
  { label: "Faturalar", icon: <FileText size={20} />, href: "/account/invoices" },
  { label: "Cari / Kredi", icon: <Wallet size={20} />, href: "/account/credit" },
  { label: "Kampanyalar", icon: <Percent size={20} />, href: "/account/campaigns" },
  { label: "Raporlar", icon: <BarChart3 size={20} />, href: "/account/reports" },
  { label: "Destek", icon: <MessageSquare size={20} />, href: "/account/support" },
  { label: "Takım", icon: <Users size={20} />, href: "/account/team" },
]

const bottomItems: NavItem[] = [
  { label: "Ayarlar", icon: <Settings size={20} />, href: "/account/settings" },
  { label: "Yardım", icon: <HelpCircle size={20} />, href: "/account/help" },
]

export function Sidebar() {
  const pathname = usePathname()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { isAdmin, company, user } = useAuth()
  const [isDesktop, setIsDesktop] = useState(false)

  const navItems = useMemo(() => {
    if (!user) return customerNav
    const allowed = allowedNavHrefs(user.role)
    let items = allowed === "all"
      ? customerNav
      : customerNav.filter((item) =>
          allowed.some((href) => item.href === href || item.href.startsWith(href))
        )
    // Takım yalnızca canManageUsers
    if (user.role !== "company_admin" && user.role !== "admin") {
      items = items.filter((item) => item.href !== "/account/team")
    }
    return items
  }, [user])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => {
      setIsDesktop(mq.matches)
      if (!mq.matches) setSidebarOpen(false)
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [setSidebarOpen])

  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false)
  }, [pathname, isDesktop, setSidebarOpen])

  const closeMobile = () => {
    if (!isDesktop) setSidebarOpen(false)
  }

  const expanded = isDesktop ? sidebarOpen : true
  const visible = isDesktop || sidebarOpen

  return (
    <>
      <AnimatePresence>
        {!isDesktop && sidebarOpen && (
          <motion.button
            type="button"
            aria-label="Menüyü kapat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-card border-r border-border flex flex-col overflow-hidden",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          !isDesktop && !sidebarOpen && "-translate-x-full pointer-events-none",
          !isDesktop && sidebarOpen && "translate-x-0 shadow-2xl",
          isDesktop && (sidebarOpen ? "w-[240px]" : "w-[72px]")
        )}
        style={!isDesktop ? { width: 280 } : undefined}
        animate={
          isDesktop
            ? { width: sidebarOpen ? 240 : 72, x: 0 }
            : { x: sidebarOpen ? 0 : -300, width: 280 }
        }
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        aria-hidden={!visible}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-border shrink-0",
            expanded ? "px-3 gap-2" : "px-0 justify-center"
          )}
        >
          {expanded ? (
            <>
              <Link href="/home" onClick={closeMobile} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-sm">R</span>
                </div>
                <span className="text-sm font-semibold text-white whitespace-nowrap truncate">ROCKSWELL</span>
              </Link>
              {isDesktop ? (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors shrink-0"
                  aria-label="Menüyü daralt"
                >
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/50 shrink-0"
                  aria-label="Menüyü kapat"
                >
                  <X size={18} />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-black hover:bg-accent/90 transition-colors"
              aria-label="Menüyü genişlet"
              title="Menüyü genişlet"
            >
              <span className="font-bold text-sm leading-none">R</span>
            </button>
          )}
        </div>

        {expanded && (
          <div className="px-3 pt-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
              <Shield size={14} className="text-accent" />
              <span className="text-xs text-accent font-medium">{isAdmin ? "Yönetici · Mağaza" : "Bayi Paneli"}</span>
            </div>
            {isAdmin && (
              <a
                href={adminAbsoluteUrl("/")}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:border-accent/30 transition-colors"
              >
                <LayoutDashboard size={14} className="text-accent" />
                Yönetim Paneli
                <ExternalLink size={12} className="ml-auto text-white/30" />
              </a>
            )}
          </div>
        )}

        <nav
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain py-3 space-y-1",
            expanded ? "px-2" : "px-2 flex flex-col items-center"
          )}
        >
          {navItems.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={!expanded}
              onNavigate={closeMobile}
            />
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-border py-3 space-y-1 shrink-0",
            expanded ? "px-2" : "px-2 flex flex-col items-center"
          )}
        >
          {bottomItems.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={!expanded}
              onNavigate={closeMobile}
            />
          ))}
          <LogoutButton collapsed={!expanded} />
        </div>

        <div
          className={cn(
            "border-t border-border shrink-0",
            expanded ? "px-3 py-3" : "px-2 py-3 flex justify-center"
          )}
        >
          {expanded ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">KURUMSAL</p>
              <p className="text-xs text-white/70 truncate">{company?.name ?? "Yükleniyor..."}</p>
              <p className="text-[10px] text-white/40">Vergi No: {company?.taxNumber ?? "---"}</p>
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center"
              title={company?.name ?? "Şirket"}
            >
              <Building2 size={16} className="text-accent" />
            </div>
          )}
        </div>
      </motion.aside>
    </>
  )
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { logout } = useAuth()

  return (
    <button
      type="button"
      title={collapsed ? "Çıkış" : undefined}
      onClick={async () => {
        await logout()
        window.location.href = "/login"
      }}
      className={cn(
        "flex items-center rounded-xl text-sm font-medium transition-colors text-white/50 hover:text-danger hover:bg-danger/5",
        collapsed
          ? "w-10 h-10 justify-center"
          : "w-full gap-3 px-3 min-h-11"
      )}
    >
      <LogOut size={20} className="shrink-0" />
      {!collapsed && <span>Çıkış</span>}
    </button>
  )
}

function NavItemComponent({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(item.children ? pathname.startsWith(item.href) : false)
  const isActive = pathname.startsWith(item.href) && item.href !== "/"

  if (collapsed) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        title={item.label}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors",
          isActive
            ? "bg-accent/15 text-accent"
            : "text-white/50 hover:text-white hover:bg-white/5"
        )}
      >
        <span className="flex items-center justify-center">{item.icon}</span>
        {item.badge ? (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-black text-[8px] font-bold rounded-full flex items-center justify-center">
            {item.badge}
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center">
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium transition-colors relative group flex-1",
            isActive
              ? "bg-accent/10 text-accent"
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5">{item.icon}</span>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span className="ml-auto bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </Link>
        {item.children && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="w-10 min-h-11 flex items-center justify-center text-white/30 hover:text-white/60"
            aria-label="Alt menü"
          >
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent rounded-full" />
      )}
      {item.children && open && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              className={cn(
                "block px-3 py-2.5 rounded-lg text-xs transition-colors",
                pathname === child.href ? "text-accent bg-accent/5" : "text-white/40 hover:text-white/70 hover:bg-white/5"
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
