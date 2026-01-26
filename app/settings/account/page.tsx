'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsContext } from '@/contexts/settings-context'
import { getStripeCheckoutUrl, getStripePortalUrl } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, Download, CheckCircle, Sparkles, RefreshCw } from 'lucide-react'

export default function AccountPage() {
  const { user, subscription, signOut } = useAuth()
  const { settings, updateSettings } = useSettingsContext()

  // Electron auto-updater state
  const [isElectron, setIsElectron] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
      setIsElectron(true)
      window.electron.getAppVersion().then(setAppVersion)

      const unsubscribe = window.electron.onUpdateStatus((status) => {
        setUpdateStatus(status.status)
        if (status.version) setUpdateVersion(status.version)
        if (status.status !== 'checking') setIsChecking(false)
      })

      return unsubscribe
    }
  }, [])

  const handleCheckForUpdates = async () => {
    if (window.electron) {
      setIsChecking(true)
      setUpdateStatus(null)
      await window.electron.checkForUpdates()
    }
  }

  const handleInstallUpdate = () => {
    if (window.electron) {
      window.electron.installUpdate()
    }
  }

  // AI features enabled (default to true for backwards compatibility)
  const aiEnabled = settings.aiEnabled !== false

  const handleManageSubscription = () => {
    const portalUrl = getStripePortalUrl()
    if (portalUrl) {
      window.open(portalUrl, '_blank')
    }
  }

  const handleSubscribe = () => {
    if (!user) return
    const checkoutUrl = getStripeCheckoutUrl(user.id, user.email)
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank')
    }
  }

  const getStatusBadge = () => {
    if (!subscription) {
      return <Badge variant="destructive">No subscription</Badge>
    }

    switch (subscription.status) {
      case 'trialing':
        return <Badge variant="secondary">Trial ({subscription.daysRemaining} days left)</Badge>
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'past_due':
        return <Badge variant="destructive">Past due</Badge>
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>
      default:
        return <Badge variant="destructive">Expired</Badge>
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Manage your account and subscription
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">User ID</span>
            <span className="text-sm font-mono text-muted-foreground">{user?.id.slice(0, 8)}...</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Features
          </CardTitle>
          <CardDescription>Enable AI-powered drafts, autopilot, and chat assistant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-medium">Enable AI features</span>
              <p className="text-xs text-muted-foreground">
                {aiEnabled
                  ? 'AI-powered drafts, autopilot, and chat assistant are enabled'
                  : 'Turn on to use AI-powered features'}
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={(checked) => updateSettings({ aiEnabled: checked })}
            />
          </div>
          {!aiEnabled && (
            <p className="text-xs text-muted-foreground border-t pt-4">
              When enabled, you can configure your AI provider and API keys in the settings sidebar.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
          <CardDescription>Your current plan and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge()}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className="text-sm font-medium">Parrot</span>
          </div>

          {subscription?.status === 'trialing' && subscription.trialEndsAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Trial ends</span>
              <span className="text-sm font-medium">{formatDate(subscription.trialEndsAt)}</span>
            </div>
          )}

          {subscription?.status === 'active' && subscription.currentPeriodEndsAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Next billing</span>
              <span className="text-sm font-medium">{formatDate(subscription.currentPeriodEndsAt)}</span>
            </div>
          )}

          <div className="pt-4 border-t space-y-2">
            {subscription?.status === 'trialing' ? (
              <Button onClick={handleSubscribe} className="w-full">
                Subscribe now
              </Button>
            ) : subscription?.status === 'active' ? (
              <Button onClick={handleManageSubscription} variant="outline" className="w-full">
                Manage subscription
              </Button>
            ) : (
              <Button onClick={handleSubscribe} className="w-full">
                Subscribe
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Updates card - only show in Electron */}
      {isElectron && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Updates</CardTitle>
            <CardDescription>Check for app updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current version</span>
              <span className="text-sm font-mono">{appVersion}</span>
            </div>

            {updateStatus === 'up-to-date' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                You&apos;re on the latest version
              </div>
            )}

            {updateStatus === 'available' && updateVersion && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Download className="h-4 w-4" />
                Downloading v{updateVersion}...
              </div>
            )}

            {updateStatus === 'downloading' && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading update...
              </div>
            )}

            {updateStatus === 'ready' && updateVersion && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                v{updateVersion} ready to install
              </div>
            )}

            {updateStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                Error checking for updates
              </div>
            )}

            <div className="pt-2 space-y-2">
              {updateStatus === 'ready' && updateVersion ? (
                <Button onClick={handleInstallUpdate} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Install v{updateVersion} & Restart
                </Button>
              ) : (
                <Button
                  onClick={handleCheckForUpdates}
                  variant="outline"
                  className="w-full"
                  disabled={isChecking || updateStatus === 'downloading' || updateStatus === 'available'}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : updateStatus === 'downloading' || updateStatus === 'available' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check for updates
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign out</CardTitle>
          <CardDescription>Sign out of your account on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={signOut} variant="destructive" className="w-full">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
