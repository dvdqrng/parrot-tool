import { supabase } from './client'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export type Subscription = {
  status: SubscriptionStatus
  trialEndsAt: Date | null
  currentPeriodEndsAt: Date | null
  isActive: boolean
  daysRemaining: number | null
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching subscription:', error)
    return null
  }

  if (!data) {
    console.log('No subscription data found for user:', userId)
    return null
  }

  console.log('Subscription data:', data)

  const now = new Date()
  const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null
  const currentPeriodEndsAt = data.current_period_ends_at ? new Date(data.current_period_ends_at) : null

  // Determine if subscription is active
  let isActive = false
  let daysRemaining: number | null = null

  if (data.status === 'trialing' && trialEndsAt) {
    isActive = trialEndsAt > now
    daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } else if (data.status === 'active' && currentPeriodEndsAt) {
    isActive = currentPeriodEndsAt > now
    daysRemaining = Math.ceil((currentPeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    status: data.status as SubscriptionStatus,
    trialEndsAt,
    currentPeriodEndsAt,
    isActive,
    daysRemaining,
  }
}

export async function checkAccess(userId: string): Promise<{ hasAccess: boolean; reason: string }> {
  const subscription = await getSubscription(userId)

  if (!subscription) {
    return { hasAccess: false, reason: 'No subscription found' }
  }

  if (subscription.isActive) {
    if (subscription.status === 'trialing') {
      return { hasAccess: true, reason: `Trial: ${subscription.daysRemaining} days remaining` }
    }
    return { hasAccess: true, reason: 'Active subscription' }
  }

  if (subscription.status === 'trialing') {
    return { hasAccess: false, reason: 'Trial expired' }
  }

  if (subscription.status === 'canceled') {
    return { hasAccess: false, reason: 'Subscription canceled' }
  }

  if (subscription.status === 'past_due') {
    return { hasAccess: false, reason: 'Payment past due' }
  }

  return { hasAccess: false, reason: 'Subscription expired' }
}

export function getStripeCheckoutUrl(userId: string, email: string): string {
  // This URL will be configured in your Stripe dashboard
  // The webhook will handle subscription creation
  const baseUrl = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || ''
  return `${baseUrl}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${userId}`
}

export function getStripePortalUrl(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL || ''
}
