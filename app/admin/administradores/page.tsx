import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAdministrators } from '@/app/actions/admin'
import AdministradoresManagementClient from '@/components/admin/AdministradoresManagementClient'

export const dynamic = 'force-dynamic'

export default async function AdministradoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/administradores')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const resolvedRole = profile?.role || user?.user_metadata?.role || 'citizen'
  if (!['admin', 'manager'].includes(resolvedRole)) {
    redirect('/admin')
  }

  const { users, kpi } = await getAdministrators()

  return (
    <AdministradoresManagementClient
      initialUsers={users as any}
      initialKPI={kpi}
      currentAdminId={user.id}
      currentAdminEmail={user.email || profile?.email}
    />
  )
}
