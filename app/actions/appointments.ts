'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { bookingEventEmitter } from '@/lib/events/bookingEvents'

export async function getUserAppointments() {
  const supabase = await createClient()

  // O próprio getUser() atua como camada de segurança
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Não autenticado')
  }

  // RLS nativo no PostgreSQL garantirá que apenas agendamentos 
  // onde citizen_id == auth.uid() sejam retornados.
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      citizen_id,
      appointment_date,
      appointment_time,
      appointment_type,
      status,
      protocol_number,
      created_at,
      services:service_id ( name )
    `)
    .eq('citizen_id', user.id)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })

  if (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return []
  }

  // Typecast para garantir que services seja visto como um objeto (relacionamento 1:N)
  return data as any[]
}

export async function cancelAppointment(appointmentId: string) {
  if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '' || appointmentId === 'undefined') {
    return { success: false, error: 'ID do agendamento é obrigatório e inválido.' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Não autenticado' }
  }

  // Soft-Delete: Mudamos o status para 'cancelled' EXCLUSIVAMENTE para o ID fornecido.
  // RLS IMPEDE que seja alterado um registro que não pertença ao usuário.
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId.trim())
    .eq('citizen_id', user.id) // Reforço adicional via aplicação
    .select('id, protocol_number')
    .single()

  if (error || !data) {
    return { success: false, error: 'Não foi possível cancelar o agendamento. Ele não existe ou você não tem permissão.' }
  }

  // Revalida a tela de perfil e admin para o React atualizar status
  revalidatePath('/perfil')
  revalidatePath('/admin')
  revalidatePath('/admin/agendamentos')

  bookingEventEmitter.emit('booking_cancelled', {
    appointmentId: data.id,
    protocol: data.protocol_number,
    timestamp: new Date().toISOString()
  })

  return { success: true }
}
