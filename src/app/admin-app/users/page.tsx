"use client"

import { Suspense } from "react"
import { AdminUsers } from "@/components/admin/panels"
import { TableSkeleton } from "@/components/ui/skeleton"

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="p-4"><TableSkeleton rows={5} /></div>}>
      <AdminUsers />
    </Suspense>
  )
}
