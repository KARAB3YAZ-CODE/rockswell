import type { Metadata, Viewport } from "next"
import { Toaster } from "react-hot-toast"
import { Providers } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "ROCKSWELL | B2B Otomotiv Yedek Parça Platformu",
  description: "Profesyonel B2B otomotiv yedek parça dağıtım platformu. Gerçek zamanlı stok, canlı fiyatlandırma ve kurumsal ERP entegrasyonu.",
  keywords: "yedek parça, otomotiv, B2B, distribütör, toptan parça, OEM, VIN sorgulama",
  openGraph: {
    title: "ROCKSWELL | B2B Otomotiv Yedek Parça Platformu",
    description: "Profesyonel otomotiv yedek parça dağıtım platformu",
    type: "website",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0E0E0E",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark h-full">
      <body className="min-h-full bg-background text-white antialiased font-sans overflow-x-hidden">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-center"
          reverseOrder={false}
          gutter={8}
          containerStyle={{
            bottom: "max(16px, env(safe-area-inset-bottom))",
          }}
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
              maxWidth: "min(420px, calc(100vw - 24px))",
            },
          }}
        />
      </body>
    </html>
  )
}
