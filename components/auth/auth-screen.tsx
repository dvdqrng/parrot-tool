'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Parrot</h1>
        <p className="text-muted-foreground">
          AI-powered messaging assistant
        </p>
      </div>

      {mode === 'login' ? (
        <LoginForm onToggleMode={() => setMode('signup')} />
      ) : (
        <SignupForm onToggleMode={() => setMode('login')} />
      )}
    </div>
  )
}
