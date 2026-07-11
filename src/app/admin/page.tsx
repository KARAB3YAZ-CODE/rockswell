import { redirect } from "next/navigation"
import { adminAbsoluteUrl } from "@/lib/admin-host"

/** Legacy /admin → admin subdomain */
export default function LegacyAdminRedirect() {
  redirect(adminAbsoluteUrl("/"))
}
