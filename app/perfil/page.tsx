import { createClient } from '@/lib/supabase/server'
import { getUserAppointments } from '@/app/actions/appointments'
import { getSystemSettings } from '@/services/institutionalService'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { formatNameFromEmail } from '@/lib/security/auth-utils'
import UserProfileClient from '@/components/profile/UserProfileClient'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const cookieStore = await cookies()
  const cookieName = cookieStore.get('auth_user_name')?.value?.trim()
  const cookieEmail = cookieStore.get('auth_user_email')?.value?.trim()
  const cookieRole = cookieStore.get('auth_user_role')?.value?.trim()

  // Busca dados adicionais do perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const displayEmail = profile?.email || cookieEmail || user.email || '—'
  const displayName = profile?.full_name?.trim() || cookieName || user?.user_metadata?.full_name || formatNameFromEmail(displayEmail)
  const displayRole = profile?.role || cookieRole || user?.user_metadata?.role || 'admin'
  const isStaff = displayRole !== 'citizen'

  if (isStaff) {
    redirect('/admin')
  }

  const appointments = await getUserAppointments()
  const settings = await getSystemSettings(['second_issue_warning'])

  return (
    <UserProfileClient
      user={{
        id: user.id,
        email: displayEmail,
        full_name: displayName,
        role: displayRole,
        cpf: profile?.cpf
      }}
      appointments={appointments || []}
      secondIssueWarning={settings['second_issue_warning']}
    />
  )
}
