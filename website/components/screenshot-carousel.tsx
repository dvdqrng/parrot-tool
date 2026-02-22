"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

type ScreenshotCarouselProps = {
  screenshots: string[]
  title: string
}

export function ScreenshotCarousel({ screenshots, title }: ScreenshotCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)")
    setIsMobile(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Duplicate screenshots for seamless infinite loop
  const displayScreenshots = isMobile ? [...screenshots, ...screenshots] : screenshots

  return (
    <div className="mb-6" ref={containerRef}>
      {isMobile ? (
        <div className="overflow-hidden pb-6">
          <div
            className="flex gap-4 animate-scroll"
            style={{
              width: "max-content",
            }}
          >
            {displayScreenshots.map((screenshot, index) => (
              <div
                key={index}
                className="relative w-[200px] aspect-[9/19] rounded-[1.5rem] bg-zinc-800 shadow-lg overflow-hidden shrink-0"
              >
                <Image
                  src={screenshot}
                  alt={`${title} screenshot ${(index % screenshots.length) + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {screenshots.map((screenshot, index) => (
            <div
              key={index}
              className="relative w-[240px] md:w-[280px] aspect-[9/19] rounded-[1.5rem] bg-zinc-800 shadow-lg overflow-hidden shrink-0"
            >
              <Image
                src={screenshot}
                alt={`${title} screenshot ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
      `}</style>
    </div>
  )
}
