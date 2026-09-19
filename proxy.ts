import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16: renamed from middleware.ts to proxy.ts
// The exported function must be named `proxy` (was `middleware`)
export async function proxy(request: NextRequest) {
  // Atualizar a sessão do Supabase (renova token expirado)
  const { supabaseResponse, user, supabase } = await updateSession(request)

  const { pathname } = request.nextUrl

  // 1. Proteção de APIs Administrativas e de Sistema (/api/admin/* e /api/system/*)
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/system')) {
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado. Sessão obrigatória.' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || (user as { role?: string })?.role || 'citizen'
    if (role === 'citizen') {
      return NextResponse.json(
        { error: 'Permissão negada. Apenas profissionais autorizados.' },
        { status: 403 }
      )
    }
  }

  // 2. Proteção de páginas autenticadas (/perfil e /admin)
  if (!user && (pathname.startsWith('/perfil') || pathname.startsWith('/admin'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 3. Se o usuário já está logado e tenta ir pra login/cadastro, redireciona conforme seu papel
  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const url = request.nextUrl.clone()
    const role = (user as { role?: string })?.role || 'atendente'
    if (role === 'citizen') {
      url.pathname = '/perfil'
    } else {
      url.pathname = '/admin'
    }
    return NextResponse.redirect(url)
  }

  // 4. Validação de Role no servidor (RBAC) para páginas administrativas
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    
    // Consulta a role no banco
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || (user as { role?: string })?.role || 'citizen'

    // Cidadão não acessa /admin — redireciona para seu perfil (nunca para /login para evitar loop)
    if (role === 'citizen') {
      const url = request.nextUrl.clone()
      url.pathname = '/perfil'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - imagens genéricas, etc
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
