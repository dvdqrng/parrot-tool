import { supabase } from './client'
import type { AuthUser } from './client'

export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  if (data.user) {
    // Create profile and start trial
    await createProfileWithTrial(data.user.id, email)
  }

  return {
    user: data.user ? { id: data.user.id, email: data.user.email! } : null,
    error: null,
  }
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return {
    user: data.user ? { id: data.user.id, email: data.user.email! } : null,
    error: null,
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut()
  return { error: error?.message || null }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return {
    id: user.id,
    email: user.email!,
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({ id: session.user.id, email: session.user.email! })
    } else {
      callback(null)
    }
  })
}

async function createProfileWithTrial(userId: string, email: string) {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 7) // 7 day trial

  // Create profile
  await supabase.from('profiles').insert({
    user_id: userId,
    email,
  })

  // Create subscription with trial
  await supabase.from('subscriptions').insert({
    user_id: userId,
    status: 'trialing',
    trial_ends_at: trialEndsAt.toISOString(),
  })
}
