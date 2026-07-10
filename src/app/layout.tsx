import type { Metadata } from "next"
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark h-full">
      <body className="min-h-full bg-background text-white antialiased font-sans">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  )
}
