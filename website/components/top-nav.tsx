"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

type SidequestItem = {
  name: string
  slug: string
}

type TopNavProps = {
  activeTab?: string
  onTabChange?: (tab: string) => void
  tabs?: string[]
  currentPage?: string
  sidequests?: SidequestItem[]
}

export function TopNav({ activeTab, onTabChange, tabs, currentPage, sidequests }: TopNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <nav className="flex items-center gap-6 mb-12">
      <Link href="/" className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
        <Image src="/professional-headshot.jpg" alt="David Quiring" width={32} height={32} />
      </Link>

      {tabs && (
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = currentPage ? false : activeTab === tab
            const isClickable = onTabChange && !currentPage

            if (isClickable) {
              return (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  className={`transition-opacity ${
                    isActive ? "opacity-100 font-medium" : "opacity-40 hover:opacity-60"
                  }`}
                >
                  {tab}
                </button>
              )
            }

            return (
              <Link
                key={tab}
                href={tab === "timeline" ? "/" : `/?tab=${tab}`}
                className="opacity-40 hover:opacity-60 transition-opacity"
              >
                {tab}
              </Link>
            )
          })}

          {currentPage && sidequests && sidequests.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <button className="font-medium">
                {currentPage}
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {sidequests.map((sq) => (
                      <Link
                        key={sq.slug}
                        href={`/sidequest/${sq.slug}`}
                        className={`block px-4 py-2 transition-colors ${
                          sq.name.toLowerCase() === currentPage
                            ? "font-medium bg-zinc-100"
                            : "opacity-60 hover:opacity-100 hover:bg-zinc-50"
                        }`}
                      >
                        {sq.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentPage && (!sidequests || sidequests.length === 0) && (
            <span className="font-medium">{currentPage}</span>
          )}
        </div>
      )}
    </nav>
  )
}
