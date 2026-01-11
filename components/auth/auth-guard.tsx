'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { AuthScreen } from './auth-screen'
import { Paywall } from './paywall'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isAuthenticated, hasAccess } = useAuth()

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not logged in - show auth screen
  if (!isAuthenticated) {
    return <AuthScreen />
  }

  // Logged in but no access (trial expired, subscription canceled, etc.)
  if (!hasAccess) {
    return <Paywall />
  }

  // Authenticated and has access
  return <>{children}</>
}
