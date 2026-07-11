"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { AdminShell } from "@/components/admin/admin-shell"
import { ADMIN_PATH_PREFIX } from "@/lib/admin-host"
import { siteAbsoluteUrl } from "@/lib/admin-host"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isAuthenticated, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLogin = pathname === `${ADMIN_PATH_PREFIX}/login` || pathname.endsWith("/login")

  useEffect(() => {
    if (loading) return
    if (isLogin) {
      if (isAuthenticated && isAdmin) router.replace(ADMIN_PATH_PREFIX)
      return
    }
    if (!isAuthenticated) {
      router.replace(`${ADMIN_PATH_PREFIX}/login`)
      return
    }
    if (!isAdmin) {
      window.location.href = siteAbsoluteUrl("/home")
    }
  }, [loading, isAuthenticated, isAdmin, isLogin, router])

  if (isLogin) {
    return <>{children}</>
  }

  if (loading || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return <AdminShell>{children}</AdminShell>
}
