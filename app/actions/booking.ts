'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { rateLimit } from '@/lib/rateLimit'

import { bookingEventEmitter } from '@/lib/events/bookingEvents'
import { TIPO_ATENDIMENTO } from '@/types/institutional'

const appointmentTypeSchema = z.preprocess((val) => {
  if (typeof val !== 'string') return val
  const s = val.toLowerCase().trim()
  if (
    s === '2_via' ||
    s.includes('second') || 
    s.includes('2') || 
    s.includes('segunda') || 
    s.includes('2a') || 
    s.includes('2ª')
  ) {
    return 'second_issue'
  }
  if (
    s === '1_via' ||
    s.includes('first') || 
    s.includes('1') || 
    s.includes('primeira') || 
    s.includes('1a') || 
    s.includes('1ª')
  ) {
    return 'first_issue'
  }
  return s
}, z.enum(['first_issue', 'second_issue']))

// Definimos o Schema do Agendamento simplificado com campo obrigatório Sexo
const sexoSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : ''),
  z.string()
    .min(1, 'Selecione o sexo')
    .refine(val => ['Masculino', 'Feminino', 'Outro / Não informado', 'Prefiro não informar', 'Outro', 'M', 'F'].includes(val), {
      message: 'Selecione o sexo'
    })
)

const bookingSchema = z.object({
  service_id: z.string().min(1, 'Serviço inválido.'),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  appointment_time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
  appointment_type: appointmentTypeSchema.optional(),
  tipo: appointmentTypeSchema.optional(),
  full_name: z.string().min(3, 'Nome completo deve ter pelo menos 3 caracteres.'),
  phone: z.string().min(10, 'Telefone inválido.').max(20, 'Telefone inválido.'),
  sexo: sexoSchema,
  address: z.string().optional(),
  cpf: z.string().optional()
}).refine(data => data.appointment_type || data.tipo, {
  message: 'Selecione se é 1ª Via ou 2ª Via do RG.',
  path: ['appointment_type']
})

type ActionState = { error?: string; success?: boolean; protocol?: string; message?: string } | undefined

export async function createBooking(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()

  // 1. Contexto do usuário (opcional - cidadão autenticado ou público visitante)
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Extrair e validar dados do form
  const data: Record<string, string> = {}
  formData.forEach((value, key) => {
    data[key] = value.toString()
  })
  const result = bookingSchema.safeParse(data)

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  // 1.5. Rate Limiting de Abuso
  // Permitimos no máximo 3 tentativas de reserva por minuto por usuário/telefone
  const rateLimitKey = user ? `booking_${user.id}` : `booking_phone_${result.data.phone}`
  if (!rateLimit(rateLimitKey, 3)) {
    return { error: 'Muitas tentativas em curto período. Aguarde um minuto e tente novamente.' }
  }

  const citizenId = user?.id || '00000000-0000-0000-0000-000000000000'
  const finalType = result.data.appointment_type || result.data.tipo || 'first_issue'
  const finalTipoKey = finalType === 'second_issue' ? TIPO_ATENDIMENTO.SEGUNDA_VIA : TIPO_ATENDIMENTO.PRIMEIRA_VIA

  // 3. Chamar a RPC Transacional (Garante concorrência atômica no banco)
  let rpcData: any = null
  let rpcError: any = null

  const rpcResult = await supabase.rpc('book_appointment', {
    p_citizen_id: citizenId,
    p_service_id: result.data.service_id,
    p_appointment_date: result.data.appointment_date,
    p_appointment_time: `${result.data.appointment_time}:00`, // Cast to TIME
    p_appointment_type: finalType,
    p_full_name: result.data.full_name,
    p_cpf: result.data.cpf,
    p_phone: result.data.phone
  })

  rpcData = rpcResult.data
  rpcError = rpcResult.error

  // Atualizar perfil apenas se o usuário logado for comprovadamente um cidadão
  if (user) {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userProfile?.role === 'citizen') {
      await supabase.from('profiles').update({
        full_name: result.data.full_name,
        cpf: result.data.cpf,
        phone: result.data.phone,
        sexo: result.data.sexo
      }).eq('id', user.id)
    }
  }

  // Fallback: se a RPC não existir ou falhar por schema no ambiente, executar inserção direta
  if (rpcError && (rpcError.code === '42883' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist') || rpcError.message?.includes('schema'))) {
    console.warn('RPC book_appointment not found or failed, falling back to direct table insert:', rpcError.message)
    const protocol = `${result.data.appointment_date.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const { data: directInsert, error: directError } = await supabase
      .from('appointments')
      .insert({
        citizen_id: citizenId,
        service_id: result.data.service_id,
        appointment_date: result.data.appointment_date,
        appointment_time: `${result.data.appointment_time}:00`,
        appointment_type: finalType,
        status: 'confirmed',
        protocol_number: protocol,
        full_name: result.data.full_name,
        phone: result.data.phone,
        sexo: result.data.sexo
      })
      .select('id, protocol_number')
      .single()

    if (directError) {
      console.error('Erro na inserção direta de agendamento:', directError)
      return { error: 'Não foi possível confirmar seu agendamento no momento.' }
    }

    rpcData = { success: true, protocol: directInsert?.protocol_number || protocol, appointment_id: directInsert?.id }
    rpcError = null
  }

  // 4. Tratamento minucioso de erros do banco
  if (rpcError) {
    if (rpcError.message?.includes('MONTHLY_LIMIT_REACHED')) {
      return { error: 'O limite de agendamentos deste mês foi atingido. Por favor, tente novamente quando novas vagas forem liberadas.' }
    }
    if (rpcError.message?.includes('SLOT_ALREADY_TAKEN')) {
      return { error: 'O horário selecionado acabou de ser ocupado. Por favor, escolha outro horário.' }
    }
    console.error('Erro na RPC de agendamento:', rpcError.code, rpcError.message)
    return { error: 'Ocorreu um erro interno ao processar seu agendamento. Tente novamente.' }
  }

  // 5. Revalidação de Cache e Sucesso
  revalidatePath('/perfil')
  revalidatePath('/admin')
  revalidatePath('/agendamento')

  const bookingPayload = {
    id: rpcData?.appointment_id || `booking-${Date.now()}`,
    protocol: rpcData.protocol,
    full_name: result.data.full_name,
    appointment_date: result.data.appointment_date,
    appointment_time: result.data.appointment_time,
    appointment_type: finalType,
    tipo: finalTipoKey,
    categoria: finalType === 'second_issue' ? '2ª Via RG' : '1ª Via RG',
    phone: result.data.phone,
    sexo: result.data.sexo,
    timestamp: new Date().toISOString()
  }

  // Dispara evento em tempo real para o dashboard admin
  bookingEventEmitter.emit('new_booking', bookingPayload)

  return { 
    success: true, 
    protocol: rpcData.protocol, 
    message: 'Agendamento confirmado com sucesso!' 
  }
}

export async function createWalkInBooking(params: {
  appointment_date: string
  appointment_time: string
  appointment_type: string
  full_name: string
  phone: string
  sexo: string
  address?: string
  attendant?: string
}): Promise<{ success: boolean; protocol?: string; message?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    if (!params.full_name || params.full_name.trim().length < 3) {
      return { success: false, error: 'Nome completo deve ter no mínimo 3 caracteres.' }
    }
    if (!params.phone || params.phone.trim().length < 8) {
      return { success: false, error: 'Telefone inválido.' }
    }
    if (!params.sexo || params.sexo.trim() === '' || params.sexo === 'Selecione') {
      return { success: false, error: 'Selecione o sexo' }
    }
    if (!params.appointment_date || !params.appointment_time) {
      return { success: false, error: 'Data e horário são obrigatórios.' }
    }

    const typeStr = params.appointment_type.toLowerCase()
    const finalType = (typeStr.includes('2') || typeStr.includes('second')) ? 'second_issue' : 'first_issue'
    const finalTipoKey = finalType === 'second_issue' ? TIPO_ATENDIMENTO.SEGUNDA_VIA : TIPO_ATENDIMENTO.PRIMEIRA_VIA
    const categoria = finalType === 'second_issue' ? '2ª Via RG' : '1ª Via RG'
    const formattedTime = params.appointment_time.length === 5 ? `${params.appointment_time}:00` : params.appointment_time

    // Verificar se o slot já está ocupado
    const { data: existingSlots } = await supabase
      .from('appointments')
      .select('id')
      .eq('appointment_date', params.appointment_date)
      .eq('start_time', formattedTime)
      .neq('status', 'cancelled')

    // Also check appointment_time column if start_time differed
    const { data: existingSlotsAlt } = await supabase
      .from('appointments')
      .select('id')
      .eq('appointment_date', params.appointment_date)
      .eq('appointment_time', formattedTime)
      .neq('status', 'cancelled')

    if ((existingSlots && existingSlots.length > 0) || (existingSlotsAlt && existingSlotsAlt.length > 0)) {
      return { success: false, error: 'Este horário já possui agendamento confirmado. Escolha outro slot.' }
    }

    // Buscar serviço padrão
    const { data: serviceData } = await supabase
      .from('services')
      .select('id')
      .limit(1)
      .single()

    const serviceId = serviceData?.id || '00000000-0000-0000-0000-000000000001'
    const protocol = `PRES-${params.appointment_date.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Inserir agendamento
    const { data: insertedApt, error: insertError } = await supabase
      .from('appointments')
      .insert({
        citizen_id: user.id,
        service_id: serviceId,
        appointment_date: params.appointment_date,
        start_time: formattedTime,
        appointment_time: formattedTime,
        type: finalType,
        appointment_type: finalType,
        status: 'confirmed',
        protocol_number: protocol,
        full_name: params.full_name.trim(),
        phone: params.phone.trim(),
        sexo: params.sexo.trim()
      })
      .select('id, protocol_number')
      .single()

    if (insertError) {
      console.warn('Inserção direta inicial falhou, tentando fallback com campos base:', insertError.message)
      // Tenta fallback com campos estritos da tabela original
      const { data: fallbackApt, error: fallbackError } = await supabase
        .from('appointments')
        .insert({
          citizen_id: user.id,
          service_id: serviceId,
          appointment_date: params.appointment_date,
          start_time: formattedTime,
          type: finalType,
          status: 'confirmed'
        })
        .select('id')
        .single()

      if (fallbackError) {
        console.error('Erro ao registrar agendamento presencial:', fallbackError)
        return { success: false, error: 'Não foi possível registrar o agendamento presencial.' }
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/agendamentos')
    revalidatePath('/perfil')

    const appointmentPayload = {
      id: insertedApt?.id || `walkin-${Date.now()}`,
      protocol: protocol,
      protocol_number: protocol,
      full_name: params.full_name.trim(),
      appointment_date: params.appointment_date,
      appointment_time: params.appointment_time.substring(0, 5),
      appointment_type: finalType,
      tipo: finalTipoKey,
      categoria,
      phone: params.phone.trim(),
      sexo: params.sexo.trim(),
      attendant: params.attendant || (finalType === 'second_issue' ? 'Guichê 02 · Dr. Silva' : 'Guichê 01 · Dra. Lima'),
      origin: 'presencial',
      is_walk_in: true,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    }

    // Disparar evento para a grade em tempo real
    bookingEventEmitter.emit('new_booking', appointmentPayload)

    return {
      success: true,
      protocol,
      message: 'Agendamento presencial realizado com sucesso!'
    }
  } catch (err: any) {
    console.error('Erro inesperado em createWalkInBooking:', err)
    return { success: false, error: err.message || 'Erro interno ao realizar agendamento presencial.' }
  }
}
