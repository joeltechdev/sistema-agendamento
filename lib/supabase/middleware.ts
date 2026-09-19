import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/security/session'
import { getMockStore } from '@/lib/supabase/server'

export interface MiddlewareUser {
  id: string
  email: string
  role: string
}

export interface MiddlewareQueryChain<T> {
  select: (columns?: string) => MiddlewareQueryChain<T>
  eq: (column: string, value: unknown) => MiddlewareQueryChain<T>
  single: () => Promise<{ data: T | null }>
}

export interface MiddlewareSupabaseClient {
  auth: {
    getUser: () => Promise<{ data: { user: MiddlewareUser | null } }>
  }
  from: (table: string) => MiddlewareQueryChain<MiddlewareUser>
}

export interface UpdateSessionResult {
  supabaseResponse: NextResponse
  user: MiddlewareUser | null
  supabase: MiddlewareSupabaseClient
}

export const updateSession = async (request: NextRequest): Promise<UpdateSessionResult> => {
  const supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const isLoggedOut = request.cookies.get('logged_out')?.value === 'true'
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  let user: MiddlewareUser | null = null

  if (!isLoggedOut && sessionToken) {
    const verified = await verifySessionToken(sessionToken)
    if (verified?.sub) {
      const mockStore = getMockStore()
      const profile = mockStore.profiles?.find((p: { id: string; status?: string; role?: string; email?: string }) => p.id === verified.sub)
      if (profile && profile.status !== 'inactive') {
        user = {
          id: profile.id,
          email: profile.email || '',
          role: profile.role || 'citizen'
        }
      }
    }
  }

  const supabase: MiddlewareSupabaseClient = {
    auth: {
      getUser: async () => ({ data: { user } })
    },
    from: () => {
      const chain: MiddlewareQueryChain<MiddlewareUser> = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: user ? { id: user.id, email: user.email, role: user.role } : null })
      }
      return chain
    }
  }

  return { supabaseResponse, user, supabase }
}

