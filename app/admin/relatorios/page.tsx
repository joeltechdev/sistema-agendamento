import { getDashboardMetrics } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/server'
import ReportsManagementClient from '@/components/admin/ReportsManagementClient'
import { AppointmentItem } from '@/components/admin/AppointmentsManagementClient'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const [metrics, supabase] = await Promise.all([
    getDashboardMetrics(),
    createClient()
  ])

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      *,
      profiles:citizen_id ( full_name, phone, cpf )
    `)
    .order('appointment_date', { ascending: false })
    .limit(500)

  // Map to clean AppointmentItem shape
  const formattedAppointments: AppointmentItem[] = (appointments || []).map((apt: any) => {
    const prof = apt.profiles || {}
    return {
      id: apt.id,
      protocol_number: apt.protocol_number || `RG-${apt.id.substring(0, 8)}`,
      full_name: apt.full_name || prof.full_name || 'Cidadão',
      phone: apt.phone || prof.phone || '',
      sexo: apt.sexo || prof.sexo || 'Não informado',
      appointment_date: apt.appointment_date || '',
      appointment_time: apt.appointment_time || apt.start_time || '08:00',
      appointment_type: apt.appointment_type || apt.type || 'first_issue',
      status: apt.status || 'scheduled',
      origin: (apt.origin || (apt.is_walk_in ? 'presencial' : 'online')) as any,
      is_walk_in: Boolean(apt.is_walk_in),
      attendant: apt.attendant || '',
      created_at: apt.created_at || '',
      updated_at: apt.updated_at || '',
      completed_at: apt.completed_at || '',
      cpf: apt.cpf || prof.cpf || '',
      cancellation_reason: apt.cancellation_reason || '',
      cancelled_by: apt.cancelled_by || '',
      cancelled_at: apt.cancelled_at || (apt.status === 'cancelled' ? apt.updated_at : '') || ''
    }
  })

  return (
    <ReportsManagementClient 
      initialAppointments={formattedAppointments} 
      metrics={metrics} 
    />
  )
}

