import { NextResponse, type NextRequest } from 'next/server'

export const updateSession = async (request: NextRequest) => {
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
  const user = isAuthenticated && userId && userEmail ? { id: userId, email: userEmail, role: userRole } : null

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user } })
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: user ? { id: user.id, email: user.email, role: user.role } : null })
      }
      return chain
    }
  }

  return { supabaseResponse, user, supabase }
}

