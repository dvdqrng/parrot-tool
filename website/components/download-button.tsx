"use client"

import { useEffect, useState } from "react"

type Platform = "mac-arm" | "mac-intel" | "windows" | "other"

const GITHUB_REPO = "dvdqrng/parrot-tool"
const FALLBACK_URL = `https://github.com/${GITHUB_REPO}/releases/latest`

interface DownloadUrls {
  "mac-arm": string
  "mac-intel": string
  "windows": string
  "other": string
}

async function fetchLatestReleaseUrls(): Promise<DownloadUrls> {
  const defaultUrls: DownloadUrls = {
    "mac-arm": FALLBACK_URL,
    "mac-intel": FALLBACK_URL,
    "windows": FALLBACK_URL,
    "other": FALLBACK_URL,
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (!response.ok) return defaultUrls

    const release = await response.json()
    const assets = release.assets || []

    for (const asset of assets) {
      const name = asset.name.toLowerCase()
      const url = asset.browser_download_url

      if (name.includes("arm64") && name.endsWith(".dmg")) {
        defaultUrls["mac-arm"] = url
      } else if (name.endsWith(".dmg") && !name.includes("arm64")) {
        defaultUrls["mac-intel"] = url
      } else if (name.endsWith(".exe")) {
        defaultUrls["windows"] = url
      }
    }

    return defaultUrls
  } catch {
    return defaultUrls
  }
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other"

  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform?.toLowerCase() || ""

  // Check for macOS
  if (platform.includes("mac") || userAgent.includes("macintosh")) {
    // Check for Apple Silicon (ARM)
    // Modern browsers on ARM Macs report this in userAgent or we can check via canvas
    if (
      userAgent.includes("arm") ||
      // @ts-expect-error - userAgentData is not in all browsers
      navigator.userAgentData?.platform === "macOS" &&
      // @ts-expect-error - userAgentData is not in all browsers
      navigator.userAgentData?.architecture === "arm"
    ) {
      return "mac-arm"
    }
    // Default to ARM for newer Macs (most common now)
    // We can also try to detect via WebGL renderer
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info")
        if (debugInfo) {
          const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          if (renderer.toLowerCase().includes("apple m") || renderer.toLowerCase().includes("apple gpu")) {
            return "mac-arm"
          }
        }
      }
    } catch {
      // Fall through to default
    }
    // Default to ARM since most Macs sold since 2020 are ARM
    return "mac-arm"
  }

  // Check for Windows
  if (platform.includes("win") || userAgent.includes("windows")) {
    return "windows"
  }

  return "other"
}

export function DownloadButton() {
  const [platform, setPlatform] = useState<Platform>("other")
  const [downloadUrls, setDownloadUrls] = useState<DownloadUrls>({
    "mac-arm": FALLBACK_URL,
    "mac-intel": FALLBACK_URL,
    "windows": FALLBACK_URL,
    "other": FALLBACK_URL,
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setMounted(true)
    fetchLatestReleaseUrls().then(setDownloadUrls)
  }, [])

  const downloadUrl = downloadUrls[platform]

  const label = mounted ? (
    platform === "mac-arm" || platform === "mac-intel" ? "Download for Mac" :
    platform === "windows" ? "Download for Windows" :
    "Download"
  ) : "Download"

  return (
    <a
      href={downloadUrl}
      className="inline-flex items-center gap-2 bg-black text-white rounded-full px-5 py-3 hover:bg-zinc-800 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      <span>{label}</span>
    </a>
  )
}
