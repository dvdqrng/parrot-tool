"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(path)
  }

  return (
    <nav className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-medium hover:text-muted-foreground transition-colors">
            David Quiring
          </Link>

          <ul className="flex items-center gap-6">
            <li>
              <Link
                href="/"
                className={`text-sm transition-colors ${
                  isActive("/") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Work
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className={`text-sm transition-colors ${
                  isActive("/about") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className={`text-sm transition-colors ${
                  isActive("/contact") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}
