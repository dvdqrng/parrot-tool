'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthScreen } from './auth-screen'
import { Paywall } from './paywall'

interface AuthGuardProps {
  children: ReactNode
}

// Routes that bypass authentication
const PUBLIC_ROUTES = ['/demo', '/sidequest']

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isAuthenticated, hasAccess } = useAuth()
  const pathname = usePathname()

  // Skip auth for public routes (e.g., /demo)
  if (PUBLIC_ROUTES.some(route => pathname?.startsWith(route))) {
    return <>{children}</>
  }

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

  // TODO: Paywall temporarily disabled
  // if (!hasAccess) {
  //   return <Paywall />
  // }

  // Authenticated and has access
  return <>{children}</>
}
