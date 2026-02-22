'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function EmailConfirmation() {
  const { user, signOut } = useAuth()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    if (!user?.email) return
    setResending(true)
    await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    })
    setResending(false)
    setResent(true)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <MailIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to
          </CardDescription>
          <p className="text-sm font-medium mt-1">{user?.email}</p>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account and get started. If you don&apos;t see it, check your spam folder.
          </p>
          {resent && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Confirmation email resent!
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={handleResend} variant="outline" className="w-full" disabled={resending}>
            {resending ? 'Resending...' : 'Resend confirmation email'}
          </Button>
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

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}
