import { supabase } from './client'
import type { AuthUser } from './client'

export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  // Redirect email confirmation link to /auth/callback which exchanges the token
  // and then redirects to parrot:// deep link to open the Electron app
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : undefined

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  if (error) {
    return { user: null, error: error.message }
  }

  return {
    user: data.user ? { id: data.user.id, email: data.user.email!, emailConfirmed: !!data.user.email_confirmed_at } : null,
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
    user: data.user ? { id: data.user.id, email: data.user.email!, emailConfirmed: !!data.user.email_confirmed_at } : null,
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
    emailConfirmed: !!user.email_confirmed_at,
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({ id: session.user.id, email: session.user.email!, emailConfirmed: !!session.user.email_confirmed_at })
    } else {
      callback(null)
    }
  })
}