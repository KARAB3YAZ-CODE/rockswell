"use client"

import { useAuth } from "@/lib/auth"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/store"
import { adminAbsoluteUrl } from "@/lib/admin-host"
import {
  LayoutDashboard, ShoppingBag, Package,
  FileText, Settings, HelpCircle, LogOut,
  ChevronLeft, MessageSquare, ClipboardList, Percent,
  ChevronDown, Shield, ExternalLink, Building2, BarChart3,
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
  { label: "Kampanyalar", icon: <Percent size={20} />, href: "/account/campaigns" },
  { label: "Raporlar", icon: <BarChart3 size={20} />, href: "/account/reports" },
  { label: "Destek", icon: <MessageSquare size={20} />, href: "/account/support" },
]

const bottomItems: NavItem[] = [
  { label: "Ayarlar", icon: <Settings size={20} />, href: "/account/settings" },
  { label: "Yardım", icon: <HelpCircle size={20} />, href: "/account/support" },
]

export function Sidebar() {
  const pathname = usePathname()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const { isAdmin, company } = useAuth()
  const navItems = customerNav

  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border flex flex-col",
        sidebarOpen ? "w-[240px]" : "w-[72px]"
      )}
      animate={{ width: sidebarOpen ? 240 : 72 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex items-center h-16 px-4 border-b border-border">
        <Link href="/home" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <span className="text-black font-bold text-sm">R</span>
          </div>
          <AnimatePresence mode="wait">
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <span className="text-sm font-semibold text-white whitespace-nowrap">ROCKSWELL</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft size={14} className={cn("transition-transform duration-300", !sidebarOpen && "rotate-180")} />
        </button>
      </div>

      {sidebarOpen && (
        <div className="px-3 pt-3 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
            <Shield size={14} className="text-accent" />
            <span className="text-xs text-accent font-medium">{isAdmin ? "Yönetici · Mağaza" : "Bayi Paneli"}</span>
          </div>
          {isAdmin && (
            <a
              href={adminAbsoluteUrl("/")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 hover:text-white hover:border-accent/30 transition-colors"
            >
              <LayoutDashboard size={14} className="text-accent" />
              Yönetim Paneli
              <ExternalLink size={12} className="ml-auto text-white/30" />
            </a>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={!sidebarOpen}
          />
        ))}
      </nav>

      <div className="border-t border-border py-3 px-2 space-y-1">
        {bottomItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={!sidebarOpen}
          />
        ))}
        <LogoutButton collapsed={!sidebarOpen} />
      </div>

      <div className="border-t border-border px-3 py-3">
        {sidebarOpen ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider">KURUMSAL</p>
            <p className="text-xs text-white/70 truncate">{company?.name ?? "Yükleniyor..."}</p>
            <p className="text-[10px] text-white/40">Vergi No: {company?.taxNumber ?? "---"}</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center" title={company?.name ?? "Şirket"}>
              <Building2 size={16} className="text-accent" />
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { logout } = useAuth()

  return (
    <button
      onClick={async () => {
        await logout()
        window.location.href = "/login"
      }}
      className={cn(
        "flex items-center gap-3 w-full px-3 h-10 rounded-xl text-sm font-medium transition-all duration-200 text-white/50 hover:text-danger hover:bg-danger/5",
        collapsed && "justify-center px-0"
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
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const [expanded, setExpanded] = useState(item.children ? pathname.startsWith(item.href) : false)
  const isActive = pathname.startsWith(item.href) && item.href !== "/"

  return (
    <div className="relative">
      <div className="flex items-center">
        <Link
          href={item.href}
          className={cn(
            "flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all duration-200 relative group flex-1",
            isActive
              ? "bg-accent/10 text-accent"
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </>
          )}
          {collapsed && item.badge && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-black text-[8px] font-bold rounded-full flex items-center justify-center">
              {item.badge}
            </span>
          )}
        </Link>
        {item.children && !collapsed && (
          <button onClick={() => setExpanded(!expanded)} className="w-6 h-10 flex items-center justify-center text-white/30 hover:text-white/60">
            <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-0 w-0.5 h-full bg-accent rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      {item.children && expanded && !collapsed && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block px-3 py-1.5 rounded-lg text-xs transition-colors",
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
