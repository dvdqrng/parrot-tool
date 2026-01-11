'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  getCurrentUser,
  onAuthStateChange,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getSubscription,
  checkAccess,
  isSupabaseConfigured,
  type AuthUser,
  type Subscription,
} from '@/lib/supabase'

interface AuthContextValue {
  user: AuthUser | null
  subscription: Subscription | null
  isLoading: boolean
  isAuthenticated: boolean
  hasAccess: boolean
  accessReason: string
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshSubscription: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [accessReason, setAccessReason] = useState('')

  const refreshSubscription = async () => {
    if (!user) {
      setSubscription(null)
      setHasAccess(false)
      setAccessReason('Not authenticated')
      return
    }

    const sub = await getSubscription(user.id)
    setSubscription(sub)

    const access = await checkAccess(user.id)
    setHasAccess(access.hasAccess)
    setAccessReason(access.reason)
  }

  useEffect(() => {
    // Skip auth initialization if Supabase is not configured (e.g., during build)
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      setHasAccess(true) // Allow access when auth is disabled
      setAccessReason('Auth disabled')
      return
    }

    const init = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)

        if (currentUser) {
          const sub = await getSubscription(currentUser.id)
          setSubscription(sub)

          const access = await checkAccess(currentUser.id)
          setHasAccess(access.hasAccess)
          setAccessReason(access.reason)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()

    const { data: { subscription: authSubscription } } = onAuthStateChange(async (authUser) => {
      setUser(authUser)

      if (authUser) {
        const sub = await getSubscription(authUser.id)
        setSubscription(sub)

        const access = await checkAccess(authUser.id)
        setHasAccess(access.hasAccess)
        setAccessReason(access.reason)
      } else {
        setSubscription(null)
        setHasAccess(false)
        setAccessReason('Not authenticated')
      }
    })

    return () => {
      authSubscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { user: authUser, error } = await authSignIn(email, password)
    if (authUser) {
      setUser(authUser)
      await refreshSubscription()
    }
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { user: authUser, error } = await authSignUp(email, password)
    if (authUser) {
      setUser(authUser)
      await refreshSubscription()
    }
    return { error }
  }

  const signOut = async () => {
    await authSignOut()
    setUser(null)
    setSubscription(null)
    setHasAccess(false)
    setAccessReason('Not authenticated')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isLoading,
        isAuthenticated: !!user,
        hasAccess,
        accessReason,
        signIn,
        signUp,
        signOut,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
