import type React from "react"
import type { Metadata } from "next/metadata"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "David Quiring - Design Portfolio",
  description: "A curated collection of iconic designs and collaborations",
  generator: "v0.app",
  icons: {
    icon: "/professional-headshot.jpg",
    apple: "/professional-headshot.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-sm">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
