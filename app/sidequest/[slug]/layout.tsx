import type React from "react"

export default function SidequestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        body {
          background-color: #f7f7f7 !important;
          color: black !important;
        }
        /* Override dark theme variables for this route */
        :root {
          color-scheme: light !important;
        }
      `}</style>
      {children}
    </>
  )
}
