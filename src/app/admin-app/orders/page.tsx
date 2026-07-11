"use client"

import { Suspense } from "react"
import { AdminOrders } from "@/components/admin/panels"
import { TableSkeleton } from "@/components/ui/skeleton"

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="p-4"><TableSkeleton rows={6} /></div>}>
      <AdminOrders />
    </Suspense>
  )
}
