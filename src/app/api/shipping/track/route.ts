import { NextResponse } from "next/server"
import { lookupShipment } from "@/lib/shipment-track"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const carrier = searchParams.get("carrier") ?? ""
  const trackingNumber = searchParams.get("trackingNumber") ?? ""
  if (!trackingNumber.trim()) {
    return NextResponse.json({ error: "trackingNumber gerekli" }, { status: 400 })
  }
  const result = await lookupShipment(carrier, trackingNumber)
  return NextResponse.json(result)
}
