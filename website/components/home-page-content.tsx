"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { TopNav } from "@/components/top-nav"

const tabs = ["timeline", "sidequests"] as const
type Tab = (typeof tabs)[number]

type TimelineItem = {
  years: string
  title: string
  subtitle?: string
  link?: string
}

type SidequestItem = {
  name: string
  tagline: string
  category: string
  status: string
  dateFormatted: string
  slug: string
}

type HomePageContentProps = {
  timelineData: TimelineItem[]
  sidequestsData: SidequestItem[]
}

export function HomePageContent({ timelineData, sidequestsData }: HomePageContentProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const initialTab = tabs.includes(tabParam as Tab) ? (tabParam as Tab) : "timeline"
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useEffect(() => {
    if (tabParam && tabs.includes(tabParam as Tab)) {
      setActiveTab(tabParam as Tab)
    }
  }, [tabParam])

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <TopNav
          tabs={[...tabs]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as Tab)}
        />

        {/* Timeline content */}
        {activeTab === "timeline" && (
          <div className="space-y-8">
            {timelineData.map((item, index) => (
              <div key={index} className="grid grid-cols-[140px_1fr] gap-6">
                <div className="opacity-40">{item.years}</div>
                <div className="space-y-1">
                  <h2 className="font-medium">{item.title}</h2>
                  {item.subtitle && <p className="opacity-40">{item.subtitle}</p>}
                  {item.link && (
                    <a
                      href={`https://${item.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-40 hover:opacity-60 transition-opacity inline-block"
                    >
                      {item.link}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sidequests content */}
        {activeTab === "sidequests" && (
          <div className="space-y-6 sm:space-y-4">
            {sidequestsData.map((sidequest, index) => (
              <a
                key={index}
                href={`/sidequest/${sidequest.slug}`}
                className="block sm:grid sm:grid-cols-[100px_1fr_160px_120px_80px] sm:gap-8 sm:items-baseline hover:opacity-60 transition-opacity"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:contents">
                  <span className="font-medium">{sidequest.name}</span>
                  <span className="opacity-40 hidden sm:inline">{sidequest.tagline}</span>
                  <span className="opacity-40">{sidequest.status}</span>
                  <span className="opacity-40">{sidequest.category}</span>
                  <span className="opacity-40">{sidequest.dateFormatted}</span>
                </div>
                <p className="opacity-40 mt-1 sm:hidden">{sidequest.tagline}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
