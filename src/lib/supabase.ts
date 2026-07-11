import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function authCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined
  const host = window.location.hostname
  if (host === "localhost" || host.endsWith(".localhost")) return undefined
  if (host === "rockswell.store" || host.endsWith(".rockswell.store")) return ".rockswell.store"
  return undefined
}

/** Cookie storage so admin.* and apex share the same Supabase session. */
function createCookieStorage(): SupportedStorage {
  const domain = authCookieDomain()
  const maxAge = 60 * 60 * 24 * 400

  return {
    getItem(key: string) {
      if (typeof document === "undefined") return null
      const match = document.cookie.match(new RegExp(`(?:^|; )${key.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1")}=([^;]*)`))
      if (!match) return null
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    },
    setItem(key: string, value: string) {
      if (typeof document === "undefined") return
      let cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
      if (domain) cookie += `; domain=${domain}`
      if (typeof window !== "undefined" && window.location.protocol === "https:") cookie += "; Secure"
      document.cookie = cookie
    },
    removeItem(key: string) {
      if (typeof document === "undefined") return
      let cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
      if (domain) cookie += `; domain=${domain}`
      document.cookie = cookie
    },
  }
}

let browserClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? createCookieStorage() : undefined,
        flowType: "pkce",
      },
    })
  }
  return browserClient
}

export const supabase = getSupabase()
