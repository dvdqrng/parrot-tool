export type Platform = 'mac' | 'win' | 'linux'

export type AppVersion = {
  version: string
  tag: string
  platform: Platform
  downloadUrl: string
  releaseNotes: string | null
  isRequired: boolean
}

// GitHub repo for releases - configure via env var
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'yourusername/parrot'

type GitHubRelease = {
  tag_name: string
  name: string
  body: string
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

function getAssetPattern(platform: Platform): RegExp {
  switch (platform) {
    case 'mac':
      return /\.dmg$/i
    case 'win':
      return /\.(exe|msi)$/i
    case 'linux':
      return /\.(AppImage|deb)$/i
  }
}

export async function checkForUpdates(currentVersion: string, platform: Platform): Promise<AppVersion | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch GitHub release:', response.status)
      return null
    }

    const release: GitHubRelease = await response.json()
    const latestVersion = release.tag_name.replace(/^v/, '')

    if (!isNewerVersion(latestVersion, currentVersion)) {
      return null
    }

    // Find the asset for this platform
    const assetPattern = getAssetPattern(platform)
    const asset = release.assets.find(a => assetPattern.test(a.name))

    if (!asset) {
      console.warn(`No ${platform} asset found in release ${latestVersion}`)
      return null
    }

    return {
      version: latestVersion,
      tag: release.tag_name,
      platform,
      downloadUrl: asset.browser_download_url,
      releaseNotes: release.body,
      isRequired: false,
    }
  } catch (error) {
    console.error('Failed to check for updates:', error)
    return null
  }
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
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      return null
    }

    const release: GitHubRelease = await response.json()
    const version = release.tag_name.replace(/^v/, '')

    const assetPattern = getAssetPattern(platform)
    const asset = release.assets.find(a => assetPattern.test(a.name))

    if (!asset) {
      return null
    }

    return {
      version,
      tag: release.tag_name,
      platform,
      downloadUrl: asset.browser_download_url,
      releaseNotes: release.body,
      isRequired: false,
    }
  } catch {
    return null
  }
}
