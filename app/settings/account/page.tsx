'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSettingsContext } from '@/contexts/settings-context'
import { useUpdateCheck } from '@/hooks/use-update-check'
import { getStripeCheckoutUrl, getStripePortalUrl } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, Download, CheckCircle, Sparkles } from 'lucide-react'

export default function AccountPage() {
  const { user, subscription, signOut } = useAuth()
  const { settings, updateSettings } = useSettingsContext()
  const { updateAvailable, latestVersion, isChecking, checkNow, currentVersion } = useUpdateCheck()
  const [lastCheckResult, setLastCheckResult] = useState<'none' | 'up-to-date' | 'update-available'>('none')

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Updates</CardTitle>
          <CardDescription>Check for app updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current version</span>
            <span className="text-sm font-mono">{currentVersion}</span>
          </div>

          {latestVersion && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Latest release</span>
              <span className="text-sm font-mono">{latestVersion.tag}</span>
            </div>
          )}

          {updateAvailable ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <Download className="h-4 w-4" />
              Update available
            </div>
          ) : lastCheckResult === 'up-to-date' && latestVersion && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              You're on the latest version
            </div>
          )}

          <div className="pt-2 space-y-2">
            <Button
              onClick={async () => {
                await checkNow()
                setLastCheckResult(updateAvailable ? 'update-available' : 'up-to-date')
              }}
              variant="outline"
              className="w-full"
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check for updates'
              )}
            </Button>

            {updateAvailable && (
              <Button
                onClick={() => window.open(updateAvailable.downloadUrl, '_blank')}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download {updateAvailable.tag}
              </Button>
            )}
          </div>

          {updateAvailable?.releaseNotes && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Release notes:</p>
              <p className="text-sm whitespace-pre-wrap">{updateAvailable.releaseNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
