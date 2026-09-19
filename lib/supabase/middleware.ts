import { NextResponse, type NextRequest } from 'next/server'

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
  const hasSession = request.cookies.get('auth_session')?.value === 'active' || Boolean(request.cookies.get('app_session')?.value)
  const userId = request.cookies.get('auth_user_id')?.value
  const userEmail = request.cookies.get('auth_user_email')?.value
  const rawRole = request.cookies.get('auth_user_role')?.value

  // Autenticado estritamente se não estiver com flag de logout e tiver sessão explícita com dados de usuário
  const isAuthenticated = !isLoggedOut && Boolean(hasSession && userId && userEmail)

  const userRole = rawRole || 'citizen'
  const user: MiddlewareUser | null = isAuthenticated && userId && userEmail ? { id: userId, email: userEmail, role: userRole } : null

  const supabase: MiddlewareSupabaseClient = {
    auth: {
      getUser: async () => ({ data: { user } })
    },
    from: (_table: string) => {
      const chain: MiddlewareQueryChain<MiddlewareUser> = {
        select: (_columns?: string) => chain,
        eq: (_column: string, _value: unknown) => chain,
        single: async () => ({ data: user ? { id: user.id, email: user.email, role: user.role } : null })
      }
      return chain
    }
  }

  return { supabaseResponse, user, supabase }
}

