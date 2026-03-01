'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  getCurrentUser,
  onAuthStateChange,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  isSupabaseConfigured,
  type AuthUser,
} from '@/lib/supabase'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Skip auth initialization if Supabase is not configured (e.g., during build)
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }

    const init = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()

    const { data: { subscription: authSubscription } } = onAuthStateChange(async (authUser) => {
      setUser(authUser)
    })

    return () => {
      authSubscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { user: authUser, error } = await authSignIn(email, password)
    if (authUser) {
      setUser(authUser)
    }
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { user: authUser, error } = await authSignUp(email, password)
    if (authUser) {
      setUser(authUser)
    }
    return { error }
  }

  const signOut = async () => {
    await authSignOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
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
