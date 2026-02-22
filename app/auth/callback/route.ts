import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Supabase sends either a `code` (PKCE) or `token_hash` + `type` (magic link / email confirm)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/auth/confirmed?error=config', request.url))
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  if (code) {
    // PKCE flow: exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL(`/auth/confirmed?error=${encodeURIComponent(error.message)}`, request.url))
    }
  } else if (tokenHash && type) {
    // Token hash flow: verify OTP
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email' | 'signup' | 'recovery',
    })
    if (error) {
      return NextResponse.redirect(new URL(`/auth/confirmed?error=${encodeURIComponent(error.message)}`, request.url))
    }
  } else {
    return NextResponse.redirect(new URL('/auth/confirmed?error=missing_params', request.url))
  }

  // Redirect to the confirmed page which will open the Electron app
  return NextResponse.redirect(new URL('/auth/confirmed', request.url))
}
