'use client'

import { useAuth } from '@/contexts/auth-context'
import { getStripeCheckoutUrl, getStripePortalUrl } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AccountPage() {
  const { user, subscription, signOut } = useAuth()

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
