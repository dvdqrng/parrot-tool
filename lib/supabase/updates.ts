import { supabase } from './client'

export type Platform = 'mac' | 'win' | 'linux'

export type AppVersion = {
  version: string
  platform: Platform
  downloadUrl: string
  releaseNotes: string | null
  isRequired: boolean
}

export async function checkForUpdates(currentVersion: string, platform: Platform): Promise<AppVersion | null> {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .eq('platform', platform)
    .eq('is_latest', true)
    .single()

  if (error || !data) {
    return null
  }

  // Compare versions
  if (isNewerVersion(data.version, currentVersion)) {
    return {
      version: data.version,
      platform: data.platform as Platform,
      downloadUrl: data.download_url,
      releaseNotes: data.release_notes,
      isRequired: data.is_required,
    }
  }

  return null
}

function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number)
  const currentParts = current.split('.').map(Number)

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0
    const c = currentParts[i] || 0
    if (l > c) return true
    if (l < c) return false
  }

  return false
}

export async function getLatestVersion(platform: Platform): Promise<AppVersion | null> {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .eq('platform', platform)
    .eq('is_latest', true)
    .single()

  if (error || !data) {
    return null
  }

  return {
    version: data.version,
    platform: data.platform as Platform,
    downloadUrl: data.download_url,
    releaseNotes: data.release_notes,
    isRequired: data.is_required,
  }
}
