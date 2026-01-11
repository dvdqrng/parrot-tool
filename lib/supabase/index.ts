export { supabase, isSupabaseConfigured } from './client'
export type { AuthUser } from './client'

export {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  onAuthStateChange,
} from './auth'

export {
  getSubscription,
  checkAccess,
  getStripeCheckoutUrl,
  getStripePortalUrl,
} from './subscription'
export type { Subscription, SubscriptionStatus } from './subscription'

export {
  checkForUpdates,
  getLatestVersion,
} from './updates'
export type { AppVersion, Platform } from './updates'
