import { trackingUrl } from "./shipping"

export type ShipmentLookup = {
  carrier: string
  trackingNumber: string
  trackingUrl: string | null
  status: "unknown" | "in_transit" | "delivered" | "exception"
  detail: string
}

/**
 * Carrier tracking lookup.
 * Without carrier API keys we return a deep-link + heuristic status.
 * Set YURTICI_API_KEY / ARAS_API_KEY later to enable live polling adapters.
 */
export async function lookupShipment(
  carrier: string,
  trackingNumber: string
): Promise<ShipmentLookup> {
  const code = trackingNumber.trim()
  const url = trackingUrl(carrier, code)
  const c = carrier.toLocaleLowerCase("tr")

  // Live adapters (optional env)
  if (process.env.YURTICI_API_KEY && (c.includes("yurtiçi") || c.includes("yurtici") || !c)) {
    try {
      // Placeholder for official API — keep contract stable
      const live = await fetchYurticiStub(code)
      if (live) return live
    } catch {
      /* fall through */
    }
  }

  return {
    carrier: carrier || "Kargo",
    trackingNumber: code,
    trackingUrl: url,
    status: "unknown",
    detail: url
      ? "Takip sayfasını açarak güncel durumu kontrol edin. Canlı API anahtarı tanımlanırsa otomatik durum burada görünür."
      : "Bu kargo firması için otomatik takip linki yok; numarayı firmanın sitesinde sorgulayın.",
  }
}

async function fetchYurticiStub(_code: string): Promise<ShipmentLookup | null> {
  // Reserved for real Yurtiçi Integration when YURTICI_API_KEY is set.
  return null
}
