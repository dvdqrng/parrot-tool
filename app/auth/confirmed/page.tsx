'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function EmailConfirmedContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (!error) {
      // Attempt to open the Electron app via deep link
      window.location.href = 'parrot://email-confirmed'
    }
  }, [error])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Confirmation failed</CardTitle>
            <CardDescription>
              Something went wrong confirming your email.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {error === 'missing_params'
                ? 'The confirmation link appears to be invalid. Please try signing up again.'
                : error === 'config'
                  ? 'Server configuration error. Please contact support.'
                  : error}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Email confirmed!</CardTitle>
          <CardDescription>
            Your email has been verified successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Opening Parrot...
          </p>
          <Button
            onClick={() => { window.location.href = 'parrot://email-confirmed' }}
            variant="outline"
            className="w-full"
          >
            Open Parrot
          </Button>
          <p className="text-xs text-muted-foreground">
            You can close this browser tab.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function EmailConfirmedPage() {
  return (
    <Suspense>
      <EmailConfirmedContent />
    </Suspense>
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
