import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { formatNameFromEmail } from '@/lib/security/auth-utils'

export const dynamic = 'force-dynamic'

function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const cookieStore = await cookies()
  const cookieName = cookieStore.get('auth_user_name')?.value?.trim()
  const cookieRole = cookieStore.get('auth_user_role')?.value?.trim()
  const cookieEmail = cookieStore.get('auth_user_email')?.value?.trim()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  // Resolução inteligente do nome: prioriza nome cadastrado no perfil, cookie de login ou formatação do e-mail
  let resolvedName = profile?.full_name?.trim() || user?.user_metadata?.full_name || cookieName || ''
  if (!resolvedName || (resolvedName === 'Administrador' && cookieName && cookieName !== 'Administrador')) {
    resolvedName = cookieName || ''
  }
  if (!resolvedName || resolvedName === 'Administrador') {
    const activeEmail = user?.email || cookieEmail
    if (activeEmail && activeEmail !== 'admin@prefeitura.gov.br') {
      resolvedName = formatNameFromEmail(activeEmail)
    }
  }
  if (!resolvedName) {
    resolvedName = 'Administrador'
  }

  const resolvedRole = profile?.role || user?.user_metadata?.role || cookieRole || 'admin'

  // Bloqueio SSR: Permitir papéis de atendimento e gestão (admin, manager, atendente)
  if (resolvedRole === 'citizen') {
    redirect('/perfil')
  }

  // Agendamentos do dia (não cancelados) para badge da sidebar
  const today = formatLocalDate(new Date())
  const { count: dailyAppointments } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('appointment_date', today)
    .neq('status', 'cancelled')

  return (
    <div 
      className="d-flex" 
      style={{ 
        height: '100vh', 
        width: '100vw', 
        overflow: 'hidden', 
        backgroundColor: 'var(--main-bg, #262626)' 
      }}
    >
      {/* Sidebar Redesenhada Slate-Navy - Fixa 100vh */}
      <AdminSidebar 
        userFullName={resolvedName}
        userRole={resolvedRole}
        initialDailyCount={dailyAppointments || 0}
      />

      {/* Conteúdo Central com Scroll Independente */}
      <main 
        className="flex-grow-1 p-3 p-lg-4 overflow-y-auto" 
        style={{ 
          height: '100vh', 
          backgroundColor: 'var(--main-bg, #262626)' 
        }}
      >
        {children}
      </main>
    </div>
  )
}
