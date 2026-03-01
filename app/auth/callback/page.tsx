'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    handleCallback()
  }, [])

  async function handleCallback() {
    try {
      // Supabase implicit flow sends tokens in the URL hash fragment (#access_token=...&type=signup)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const queryParams = new URLSearchParams(window.location.search)

      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const code = queryParams.get('code')
      const tokenHash = queryParams.get('token_hash')
      const type = queryParams.get('type') || hashParams.get('type')

      if (accessToken && refreshToken) {
        // Implicit flow: set session directly from hash tokens
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }
      } else if (code) {
        // PKCE flow: exchange code for session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }
      } else if (tokenHash && type) {
        // Token hash flow: verify OTP
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'email' | 'signup' | 'recovery',
        })
        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }
      } else {
        setStatus('error')
        setErrorMessage('missing_params')
        return
      }

      // Success — redirect to confirmed page which triggers the deep link
      router.replace('/auth/confirmed')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold">Confirmation failed</h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong confirming your email.
          </p>
          <p className="text-sm text-muted-foreground">
            {errorMessage === 'missing_params'
              ? 'The confirmation link appears to be invalid. Please try signing up again.'
              : errorMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center space-y-4">
        <div className="animate-pulse text-muted-foreground">
          Confirming your email...
        </div>
      </div>
    </div>
  )
}
