import { useState, useEffect, useCallback } from 'react'
import { checkForUpdates, getLatestVersion, type AppVersion, type Platform } from '@/lib/supabase'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'mac'

  const userAgent = navigator.userAgent.toLowerCase()
  if (userAgent.includes('win')) return 'win'
  if (userAgent.includes('linux')) return 'linux'
  return 'mac'
}

interface UseUpdateCheckResult {
  updateAvailable: AppVersion | null
  latestVersion: AppVersion | null
  isChecking: boolean
  checkNow: () => Promise<void>
  dismissUpdate: () => void
  currentVersion: string
}

export function useUpdateCheck(): UseUpdateCheckResult {
  const [updateAvailable, setUpdateAvailable] = useState<AppVersion | null>(null)
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const checkNow = useCallback(async () => {
    setIsChecking(true)
    try {
      const platform = getPlatform()

      // Always fetch latest version info
      const latest = await getLatestVersion(platform)
      setLatestVersion(latest)

      // Check if it's newer than current
      const update = await checkForUpdates(APP_VERSION, platform)
      if (update && !dismissed) {
        setUpdateAvailable(update)
      } else {
        setUpdateAvailable(null)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setIsChecking(false)
    }
  }, [dismissed])

  const dismissUpdate = useCallback(() => {
    setDismissed(true)
    setUpdateAvailable(null)
  }, [])

  // Check on mount and then every hour
  useEffect(() => {
    checkNow()

    const interval = setInterval(checkNow, 60 * 60 * 1000) // 1 hour

    return () => clearInterval(interval)
  }, [checkNow])

  return {
    updateAvailable: dismissed ? null : updateAvailable,
    latestVersion,
    isChecking,
    checkNow,
    dismissUpdate,
    currentVersion: APP_VERSION,
  }
}
