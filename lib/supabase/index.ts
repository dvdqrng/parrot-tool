export { supabase, isSupabaseConfigured } from './client'
export type { AuthUser } from './client'

export {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  onAuthStateChange,
} from './auth'
