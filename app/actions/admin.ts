'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { 
  validatePasswordStrength, 
  validateEmailFormat, 
  sanitizeInput, 
  hashPassword 
} from '@/lib/security/auth-utils'
import { bookingEventEmitter } from '@/lib/events/bookingEvents'

// Função centralizada para injetar Logs de Auditoria atrelada à ação
async function logAudit(supabase: any, userId: string, action: string, resource: string, details: string) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    resource,
    details
  })
}

// Verifica e recupera contexto Admin / Atendimento (Dry / Reusable)
async function getAdminContext(requireStrictAdmin: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const resolvedRole = profile?.role || user?.user_metadata?.role || (user as any)?.role || 'citizen'

  // Bloqueio rigoroso: Cidadãos e usuários não autorizados são bloqueados
  if (resolvedRole === 'citizen' || !['admin', 'manager', 'atendente', 'attendant'].includes(resolvedRole)) {
    throw new Error('Permissão negada. Apenas administradores e atendentes autorizados.')
  }

  // Operações restritas a Administrador Geral (ex: configurações de sistema, exclusões, gestão de administradores)
  if (requireStrictAdmin && resolvedRole === 'citizen') {
    throw new Error('Permissão negada. Apenas administradores.')
  }

  return { supabase, user, role: resolvedRole }
}

function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function getDashboardMetrics(startDate?: string, endDate?: string) {
  const { supabase } = await getAdminContext()
  
  const today = formatLocalDate(new Date())
  
  // Agendamentos do dia (nao cancelados)
  const { count: dailyAppointments } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('appointment_date', today)
    .neq('status', 'cancelled')

  // Atendimentos concluídos hoje
  const { count: completedAppointments } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('appointment_date', today)
    .eq('status', 'completed')

  // Agendamentos do Mês
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  const startStr = formatLocalDate(startOfMonth)
  
  const { count: monthlyAppointments } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .gte('appointment_date', startStr)
    .neq('status', 'cancelled')

  // Buscar limite
  const { data: limitData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'monthly_limit')
    .single()

  const limit = parseInt(limitData?.value?.toString() || '200')
  const restantes = Math.max(0, limit - (monthlyAppointments || 0))

  // Próximos agendamentos (lista e grade semanal)
  let query = supabase
    .from('appointments')
    .select(`
      *,
      profiles:citizen_id ( full_name, phone, cpf, sexo )
    `)
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: true })

  if (startDate && endDate) {
    query = query.gte('appointment_date', startDate).lte('appointment_date', endDate)
  } else {
    query = query.limit(300)
  }

  const { data: rawAppointments, error: aptError } = await query
  if (aptError) {
    console.error('Erro ao consultar agendamentos do dashboard:', aptError)
  }

  let dailyFirstIssue = 0
  let dailySecondIssue = 0
  let monthlyFirstIssue = 0
  let monthlySecondIssue = 0
  let completedFirstIssue = 0
  let completedSecondIssue = 0
  let firstIssueCount = 0
  let secondIssueCount = 0

  const upcomingAppointments = (rawAppointments || []).map((apt: any) => {
    const rawType = String(
      apt.appointment_type || 
      apt.type || 
      apt.tipo || 
      apt.categoria || 
      apt.servico || 
      apt.services?.name || 
      'first_issue'
    ).toLowerCase()
    const isSecond = rawType.includes('2') || rawType.includes('second') || rawType.includes('segunda')
    const rawTime = (apt.appointment_time || apt.start_time || apt.time || '08:00:00').toString().trim()
    const formattedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime
    const prof = apt.profiles || {}

    if (isSecond) {
      secondIssueCount++
    } else {
      firstIssueCount++
    }

    if (apt.appointment_date === today) {
      if (isSecond) dailySecondIssue++
      else dailyFirstIssue++

      if (apt.status === 'completed') {
        if (isSecond) completedSecondIssue++
        else completedFirstIssue++
      }
    }

    if (apt.appointment_date && apt.appointment_date >= startStr) {
      if (isSecond) monthlySecondIssue++
      else monthlyFirstIssue++
    }

    return {
      id: apt.id,
      citizen_id: apt.citizen_id,
      protocol_number: apt.protocol_number || apt.protocol || `RG-${apt.id?.substring(0, 8)}`,
      full_name: apt.full_name || prof.full_name || apt.name || 'Cidadão',
      phone: apt.phone || prof.phone || '',
      sexo: apt.sexo || prof.sexo || 'Não informado',
      cpf: apt.cpf || prof.cpf || '',
      appointment_date: apt.appointment_date || apt.date,
      appointment_time: formattedTime,
      appointment_type: isSecond ? 'second_issue' : 'first_issue',
      tipo: isSecond ? 'SEGUNDA_VIA' : 'PRIMEIRA_VIA',
      categoria: isSecond ? '2ª Via RG' : '1ª Via RG',
      status: apt.status || 'confirmed',
      attendant: apt.attendant || (isSecond ? 'Guichê 02 - Dr. Silva' : 'Guichê 01 - Dra. Lima'),
      origin: apt.origin,
      is_walk_in: apt.is_walk_in
    }
  })

  return {
    dailyAppointments: dailyAppointments || 0,
    completedAppointments: completedAppointments || 0,
    monthlyAppointments: monthlyAppointments || 0,
    limit,
    restantes,
    upcomingAppointments,
    firstIssueCount,
    secondIssueCount,
    dailyFirstIssue,
    dailySecondIssue,
    monthlyFirstIssue,
    monthlySecondIssue,
    completedFirstIssue,
    completedSecondIssue
  }
}

export async function updateSystemSetting(key: string, value: string, description: string) {
  const { supabase, user } = await getAdminContext(true)

  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value, description }, { onConflict: 'key' })

  if (error) {
    return { success: false, error: 'Erro ao atualizar configuração.' }
  }

  // Auditar ação
  await logAudit(supabase, user.id, 'UPDATE_SETTING', 'system_settings', `Alterou a chave ${key} para o valor ${value}`)

  bookingEventEmitter.emit('system_sync', { key, value, updated_at: new Date().toISOString() })

  revalidatePath('/admin/configuracoes')
  return { success: true }
}

export async function adminUpdateAppointmentStatus(
  appointmentId: string, 
  status: 'confirmed' | 'completed' | 'cancelled' | 'scheduled' | 'no_show'
) {
  if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '' || appointmentId === 'undefined') {
    return { success: false, error: 'ID do agendamento é obrigatório e inválido.' }
  }

  const { supabase, user } = await getAdminContext()
  const cleanId = appointmentId.trim()

  const payload: any = { status, updated_at: new Date().toISOString() }
  if (status === 'completed') {
    payload.completed_at = new Date().toISOString()
  } else if (status === 'cancelled') {
    payload.cancelled_at = new Date().toISOString()
  }

  let { data, error } = await supabase
    .from('appointments')
    .update(payload)
    .eq('id', cleanId)
    .select('id, protocol_number, appointment_date, appointment_time, full_name, status')
    .single()

  // Fallback: se não encontrar por ID, tentar por protocol_number
  if (!data) {
    const fallback = await supabase
      .from('appointments')
      .update(payload)
      .eq('protocol_number', cleanId)
      .select('id, protocol_number, appointment_date, appointment_time, full_name, status')
      .single()
    if (fallback.data) {
      data = fallback.data
      error = fallback.error
    }
  }

  if (error || !data) {
    console.error('Erro ao atualizar status do agendamento:', error)
    return { success: false, error: 'Não foi possível atualizar o status do agendamento.' }
  }

  // Auditar ação
  await logAudit(
    supabase, 
    user.id, 
    'UPDATE_APPOINTMENT_STATUS', 
    'appointments', 
    `Alterou o status do agendamento ${data.protocol_number || appointmentId} para ${status}`
  )

  // Emitir evento em tempo real para sincronizar o painel e os clientes conectados
  bookingEventEmitter.emit('status_updated', {
    appointmentId: data.id || cleanId,
    protocol: data.protocol_number,
    status,
    updated_at: new Date().toISOString()
  })

  revalidatePath('/admin')
  revalidatePath('/admin/agendamentos')
  revalidatePath('/admin/relatorios')
  revalidatePath('/perfil')

  return { success: true, data }
}

export async function adminConfirmAttendance(appointmentId: string) {
  return adminUpdateAppointmentStatus(appointmentId, 'completed')
}

export async function adminDeleteAppointment(appointmentId: string) {
  if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '' || appointmentId === 'undefined') {
    return { success: false, error: 'ID do agendamento é obrigatório e inválido.' }
  }

  const { supabase, user } = await getAdminContext(true)

  // Buscar dados antes de deletar para auditoria
  const { data: aptData } = await supabase
    .from('appointments')
    .select('id, protocol_number, full_name')
    .eq('id', appointmentId.trim())
    .single()

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId.trim())

  if (error) {
    console.error('Erro ao excluir agendamento:', error)
    return { success: false, error: 'Não foi possível excluir o agendamento.' }
  }

  // Auditar ação de exclusão
  await logAudit(
    supabase, 
    user.id, 
    'DELETE_APPOINTMENT', 
    'appointments', 
    `Excluiu o agendamento ${aptData?.protocol_number || appointmentId}`
  )

  bookingEventEmitter.emit('booking_cancelled', {
    appointmentId: appointmentId.trim(),
    protocol: aptData?.protocol_number,
    reason: 'Excluído pelo administrador'
  })

  revalidatePath('/admin')
  revalidatePath('/admin/agendamentos')

  return { success: true }
}

export async function getCompletedAppointments(dateFilter?: string) {
  const { supabase } = await getAdminContext()

  let query = supabase
    .from('appointments')
    .select(`
      *,
      profiles:citizen_id ( full_name, phone, cpf, sexo )
    `)
    .eq('status', 'completed')
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })

  if (dateFilter) {
    query = query.eq('appointment_date', dateFilter)
  } else {
    query = query.limit(200)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar atendimentos realizados:', error)
    return []
  }

  return (data || []).map((apt: any) => {
    const rawType = apt.appointment_type || apt.type || apt.tipo || 'first_issue'
    const isSecond = String(rawType).toLowerCase().includes('2') || String(rawType).toLowerCase().includes('second')
    const prof = apt.profiles || {}

    return {
      id: apt.id,
      protocol_number: apt.protocol_number || `RG-${apt.id?.substring(0, 8)}`,
      full_name: apt.full_name || prof.full_name || 'Cidadão',
      phone: apt.phone || prof.phone || '',
      sexo: apt.sexo || prof.sexo || 'Não informado',
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time || apt.start_time || '08:00',
      appointment_type: rawType,
      tipo: isSecond ? 'SEGUNDA_VIA' : 'PRIMEIRA_VIA',
      categoria: isSecond ? '2ª Via RG' : '1ª Via RG',
      status: 'completed',
      attendant: apt.attendant || (isSecond ? 'Dr. Silva' : 'Dra. Lima'),
      origin: apt.origin || (apt.is_walk_in ? 'presencial' : 'online'),
      completed_at: apt.updated_at || apt.created_at
    }
  })
}

export async function getAuditLogs(page: number = 1, limit: number = 20) {
  const { supabase } = await getAdminContext(true)
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      resource,
      details,
      created_at,
      profiles:user_id ( full_name, email )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Erro Auditoria', error)
    return { logs: [], totalCount: 0 }
  }

  return {
    logs: data || [],
    totalCount: count || 0
  }
}

/**
 * Listagem paginada e filtrada de administradores e atendentes
 */
export async function getAdministrators(params?: {
  page?: number
  limit?: number
  search?: string
  role?: string
  status?: string
}) {
  const { supabase } = await getAdminContext(true)
  const page = Math.max(1, params?.page || 1)
  const limit = Math.max(1, Math.min(100, params?.limit || 20))
  const search = sanitizeInput(params?.search || '').toLowerCase().trim()
  const roleFilter = params?.role || 'all'
  const statusFilter = params?.status || 'all'

  // Buscar todos os perfis administrativos (admin, manager, atendente, attendant)
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, phone, status, created_at, updated_at')
    .in('role', ['admin', 'manager', 'atendente', 'attendant'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar administradores:', error)
    return { users: [], totalCount: 0, kpi: { total: 0, admins: 0, attendants: 0, active: 0, inactive: 0 } }
  }

  interface AdminUserItem {
    id: string
    full_name: string
    email: string
    role: string
    phone: string
    status: string
    created_at: string
  }

  let filtered: AdminUserItem[] = (allProfiles || []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name || 'Usuário',
    email: p.email || '—',
    role: p.role === 'attendant' ? 'atendente' : (p.role || 'atendente'),
    phone: p.phone || '—',
    status: p.status === 'inactive' ? 'inactive' : 'active',
    created_at: p.created_at || new Date().toISOString()
  }))

  const kpi = {
    total: filtered.length,
    admins: filtered.filter((u: AdminUserItem) => u.role === 'admin').length,
    attendants: filtered.filter((u: AdminUserItem) => u.role === 'atendente' || u.role === 'manager').length,
    active: filtered.filter((u: AdminUserItem) => u.status === 'active').length,
    inactive: filtered.filter((u: AdminUserItem) => u.status === 'inactive').length
  }

  if (roleFilter !== 'all') {
    filtered = filtered.filter((u: AdminUserItem) => u.role === roleFilter)
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter((u: AdminUserItem) => u.status === statusFilter)
  }

  if (search) {
    filtered = filtered.filter((u: AdminUserItem) => 
      u.full_name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.phone.toLowerCase().includes(search)
    )
  }

  const totalCount = filtered.length
  const startIndex = (page - 1) * limit
  const paginated = filtered.slice(startIndex, startIndex + limit)

  return {
    users: paginated,
    totalCount,
    kpi
  }
}

/**
 * Criação de usuário executada por Administrador
 * - Opera sob contexto autenticado de getAdminContext(true)
 * - Valida força de senha e formatação
 * - Hash com bcrypt (12 rounds)
 * - NUNCA altera ou sobrescreve a sessão do administrador
 */
export async function adminCreateUser(formData: FormData) {
  const { supabase, user: adminUser } = await getAdminContext(true)

  const nameRaw = formData.get('name') || formData.get('full_name') || formData.get('nome')
  const emailRaw = formData.get('email')
  const passwordRaw = formData.get('password') || formData.get('senha')
  const roleRaw = formData.get('role') || 'atendente'
  const phoneRaw = formData.get('phone') || formData.get('telefone')
  const statusRaw = formData.get('status') || 'active'

  const name = sanitizeInput(String(nameRaw || '')).trim()
  const email = sanitizeInput(String(emailRaw || '')).toLowerCase().trim()
  const password = String(passwordRaw || '')
  const role = ['admin', 'manager', 'atendente'].includes(String(roleRaw)) ? String(roleRaw) : 'atendente'
  const phone = sanitizeInput(String(phoneRaw || '')).trim()
  const status = statusRaw === 'inactive' ? 'inactive' : 'active'

  if (!name || name.length < 3) {
    return { error: 'O nome completo deve conter no mínimo 3 caracteres.' }
  }

  if (!validateEmailFormat(email)) {
    return { error: 'Formato de e-mail inválido.' }
  }

  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.isValid) {
    return { error: passwordValidation.errors[0] }
  }

  // Verificar se o e-mail já existe
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingUser) {
    return { error: 'Já existe um usuário cadastrado com este e-mail.' }
  }

  const password_hash = await hashPassword(password, 12)
  const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: newUserId,
      full_name: name,
      email,
      phone: phone || null,
      password_hash,
      role,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('[Admin:CreateUser] Erro ao inserir usuário:', insertError)
    return { error: 'Erro ao cadastrar usuário no banco de dados.' }
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_CREATE_USER',
    'profiles',
    `Administrador criou o usuário ${name} (${email}) com perfil '${role}'`
  )

  revalidatePath('/admin')
  revalidatePath('/admin/administradores')

  return { success: true, message: 'Usuário cadastrado com sucesso.' }
}

/**
 * Atualização de dados cadastrais de um Administrador ou Atendente
 */
export async function adminUpdateUser(
  userId: string,
  data: {
    full_name?: string
    email?: string
    phone?: string
    role?: string
    status?: 'active' | 'inactive'
  }
) {
  const { supabase, user: adminUser } = await getAdminContext(true)

  if (!userId || typeof userId !== 'string') {
    return { error: 'ID de usuário inválido.' }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return { error: 'Usuário não encontrado.' }
  }

  const name = data.full_name ? sanitizeInput(data.full_name).trim() : targetProfile.full_name
  const email = data.email ? sanitizeInput(data.email).toLowerCase().trim() : targetProfile.email
  const phone = data.phone !== undefined ? sanitizeInput(data.phone).trim() : targetProfile.phone
  const role = data.role && ['admin', 'manager', 'atendente'].includes(data.role) ? data.role : targetProfile.role
  const status = data.status === 'inactive' ? 'inactive' : 'active'

  if (!name || name.length < 3) {
    return { error: 'O nome deve ter no mínimo 3 caracteres.' }
  }

  if (email && !validateEmailFormat(email)) {
    return { error: 'Formato de e-mail inválido.' }
  }

  // Se o e-mail mudou, verificar se outro usuário já o utiliza
  if (email && email !== targetProfile.email) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .neq('id', userId)
      .single()

    if (existingUser) {
      return { error: 'Este e-mail já está sendo utilizado por outro usuário.' }
    }
  }

  // Regra de Auto-Proteção: O admin logado não pode desativar a si próprio nem rebaixar seu papel se for o único admin ativo
  if (userId === adminUser.id) {
    if (status === 'inactive') {
      return { error: 'Você não pode desativar a sua própria conta ativa.' }
    }
    if (role !== 'admin' && targetProfile.role === 'admin') {
      return { error: 'Você não pode revogar seus próprios privilégios de administrador.' }
    }
  }

  // Regra do Último Administrador: Verificar se há outro admin ativo antes de rebaixar ou desativar
  if (targetProfile.role === 'admin' && (role !== 'admin' || status === 'inactive')) {
    const { data: activeAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('status', 'inactive')
      .neq('id', userId)

    if (!activeAdmins || activeAdmins.length === 0) {
      return { error: 'Não é possível desativar ou alterar o papel do único administrador ativo do sistema.' }
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name: name,
      email,
      phone: phone || null,
      role,
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (updateError) {
    console.error('[Admin:UpdateUser] Erro ao atualizar usuário:', updateError)
    return { error: 'Erro ao salvar alterações do usuário.' }
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_UPDATE_USER',
    'profiles',
    `Administrador atualizou dados do usuário ${name} (${userId})`
  )

  revalidatePath('/admin')
  revalidatePath('/admin/administradores')

  return { success: true, message: 'Usuário atualizado com sucesso.' }
}

/**
 * Alternar status ativo / inativo com proteção de auto-bloqueio e último admin
 */
export async function adminToggleUserStatus(userId: string, newStatus: 'active' | 'inactive') {
  const { supabase, user: adminUser } = await getAdminContext(true)

  if (!userId) return { error: 'ID de usuário obrigatório.' }

  if (userId === adminUser.id && newStatus === 'inactive') {
    return { error: 'Você não pode desativar a sua própria conta.' }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, full_name, role, status')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return { error: 'Usuário não encontrado.' }
  }

  if (targetProfile.role === 'admin' && newStatus === 'inactive') {
    const { data: activeAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('status', 'inactive')
      .neq('id', userId)

    if (!activeAdmins || activeAdmins.length === 0) {
      return { error: 'Não é possível desativar o único administrador ativo do sistema.' }
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (updateError) {
    return { error: 'Erro ao alterar status do usuário.' }
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_TOGGLE_USER_STATUS',
    'profiles',
    `Alterou o status de ${targetProfile.full_name} para '${newStatus}'`
  )

  revalidatePath('/admin/administradores')
  return { success: true, message: `Usuário ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso.` }
}

/**
 * Redefinição direta de senha de operador por Administrador
 */
export async function adminResetUserPassword(userId: string, newPasswordRaw: string) {
  const { supabase, user: adminUser } = await getAdminContext(true)

  if (!userId) return { error: 'ID de usuário obrigatório.' }

  const password = String(newPasswordRaw || '')
  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.isValid) {
    return { error: passwordValidation.errors[0] }
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return { error: 'Usuário não encontrado.' }
  }

  const password_hash = await hashPassword(password, 12)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      password_hash,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (updateError) {
    return { error: 'Erro ao redefinir senha do usuário.' }
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_RESET_USER_PASSWORD',
    'profiles',
    `Administrador redefiniu a senha do usuário ${targetProfile.full_name} (${targetProfile.email})`
  )

  revalidatePath('/admin/administradores')
  return { success: true, message: 'Senha redefinida com sucesso.' }
}

/**
 * Exclusão de administrador ou atendente
 */
export async function adminDeleteUser(userId: string) {
  const { supabase, user: adminUser } = await getAdminContext(true)

  if (!userId) return { error: 'ID de usuário obrigatório.' }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', userId)
    .single()

  if (!targetProfile) {
    return { error: 'Usuário não encontrado.' }
  }

  // Se for admin, verifica se há outro admin ativo antes de permitir exclusão
  if (targetProfile.role === 'admin') {
    const { data: activeAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('status', 'inactive')
      .neq('id', userId)

    if (!activeAdmins || activeAdmins.length === 0) {
      return { error: 'Não é possível excluir o único administrador ativo do sistema.' }
    }
  }

  const { error: deleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (deleteError) {
    return { error: 'Erro ao excluir usuário.' }
  }

  const isSelf = userId === adminUser.id

  if (isSelf) {
    try {
      const cookieStore = await cookies()
      cookieStore.set('logged_out', 'true', { path: '/', httpOnly: true, sameSite: 'lax' })
      cookieStore.delete('auth_session')
      cookieStore.delete('auth_user_id')
      cookieStore.delete('auth_user_email')
      cookieStore.delete('auth_user_name')
      cookieStore.delete('auth_user_role')
    } catch {}
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_DELETE_USER',
    'profiles',
    `Excluiu o usuário ${targetProfile.full_name} (${targetProfile.email})`
  )

  revalidatePath('/admin/administradores')
  revalidatePath('/admin/cidadaos')
  return { success: true, isSelf, message: 'Usuário excluído com sucesso.' }
}

/**
 * Exclusão de cidadão/usuário do cadastro geral
 */
export async function adminDeleteCitizen(citizenId: string) {
  const { supabase, user: adminUser } = await getAdminContext(false)

  if (!citizenId) return { error: 'ID do cidadão obrigatório.' }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', citizenId)
    .single()

  if (!target) {
    return { error: 'Cidadão não encontrado na base de dados.' }
  }

  // Não permitir exclusão de administradores gerais por este endpoint
  if (target.role === 'admin') {
    return { error: 'Administradores devem ser gerenciados no módulo de Administradores.' }
  }

  const { error: deleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', citizenId)

  if (deleteError) {
    return { error: 'Erro ao remover cidadão da base de dados.' }
  }

  await logAudit(
    supabase,
    adminUser.id,
    'ADMIN_DELETE_CITIZEN',
    'profiles',
    `Removeu o cidadão ${target.full_name || target.email} (ID: ${citizenId})`
  )

  revalidatePath('/admin/cidadaos')
  return { success: true, message: 'Cidadão removido com sucesso.' }
}

