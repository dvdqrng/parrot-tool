'use client'

import { useAuth } from '@/contexts/auth-context'
import { getStripeCheckoutUrl, getStripePortalUrl } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function Paywall() {
  const { user, subscription, accessReason, signOut } = useAuth()

  const handleSubscribe = () => {
    if (!user) return
    const checkoutUrl = getStripeCheckoutUrl(user.id, user.email)
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank')
    }
  }

  const handleManageSubscription = () => {
    const portalUrl = getStripePortalUrl()
    if (portalUrl) {
      window.open(portalUrl, '_blank')
    }
  }

  const getStatusMessage = () => {
    if (!subscription) {
      return 'No subscription found'
    }

    switch (subscription.status) {
      case 'trialing':
        return 'Your trial has expired'
      case 'canceled':
        return 'Your subscription has been canceled'
      case 'past_due':
        return 'Your payment is past due'
      case 'expired':
        return 'Your subscription has expired'
      default:
        return accessReason
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Subscription Required</CardTitle>
          <CardDescription>
            {getStatusMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">€500<span className="text-lg font-normal text-muted-foreground">/month</span></div>
            <p className="text-muted-foreground">
              Unlimited AI-powered messaging
            </p>
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              AI draft generation for all messages
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              Autopilot for automated responses
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              CRM contact management
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-green-500" />
              All messaging platforms supported
            </li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={handleSubscribe} className="w-full">
            Subscribe now
          </Button>
          {subscription?.status === 'canceled' && (
            <Button onClick={handleManageSubscription} variant="outline" className="w-full">
              Manage subscription
            </Button>
          )}
          <Button onClick={signOut} variant="ghost" className="w-full">
            Sign out
          </Button>
        </CardFooter>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        Signed in as {user?.email}
      </p>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
