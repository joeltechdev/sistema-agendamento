import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigForm from './ConfigForm'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/configuracoes')
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

  const [limitRes, daysRes, hoursRes] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'monthly_limit').single(),
    supabase.from('system_settings').select('value').eq('key', 'available_days').single(),
    supabase.from('system_settings').select('value').eq('key', 'operating_hours').single()
  ])

  const currentLimit = limitRes.data?.value?.toString() || '200'

  let currentDays: number[] = [1, 2, 3, 4, 5]
  if (daysRes.data?.value) {
    try {
      currentDays = typeof daysRes.data.value === 'string' 
        ? JSON.parse(daysRes.data.value) 
        : daysRes.data.value
    } catch {
      currentDays = [1, 2, 3, 4, 5]
    }
  }

  let currentHours = {
    morning: { start: '08:00', end: '12:00', enabled: true },
    afternoon: { start: '13:00', end: '17:00', enabled: true }
  }
  if (hoursRes.data?.value) {
    try {
      const parsed = typeof hoursRes.data.value === 'string' 
        ? JSON.parse(hoursRes.data.value) 
        : hoursRes.data.value
      currentHours = { ...currentHours, ...parsed }
    } catch {
      // fallback to default
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="fw-bold mb-1 text-white" style={{ fontSize: '22px' }}>
          Configurações do Sistema
        </h2>
        <p className="mb-0" style={{ fontSize: '13px', color: '#94A3B8' }}>
          Gerenciamento de parâmetros operacionais, capacidade de atendimento e preferências visuais.
        </p>
      </div>

      <ConfigForm 
        limitValue={currentLimit} 
        initialDays={currentDays}
        initialHours={currentHours}
      />
    </div>
  )
}

