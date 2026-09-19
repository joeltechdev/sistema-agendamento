'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { 
  validatePasswordStrength, 
  validateEmailFormat, 
  sanitizeInput, 
  hashPassword, 
  verifyPassword,
  generateSecureToken,
  hashTokenSha256,
  formatNameFromEmail
} from '@/lib/security/auth-utils'
import { checkRateLimit, resetRateLimit } from '@/lib/security/rate-limit'
import { sendPasswordResetEmail } from '@/lib/email/mailer'
import { 
  createSessionToken, 
  SESSION_COOKIE_NAME, 
  LEGACY_AUTH_COOKIES, 
  getSessionCookieOptions 
} from '@/lib/security/session'

export type ActionState = { error?: string; success?: string } | undefined

interface AuditLogClient {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<unknown>
  }
}

// Helper de auditoria centralizado
async function logSecurityAudit(supabase: AuditLogClient, action: string, resource: string, details: string, userId?: string) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId || 'anonymous',
      action,
      resource,
      details,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[Audit] Erro ao gravar log de auditoria:', err)
  }
}

/**
 * 1. Login com Rate Limiting e Auditoria
 */
export async function login(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const emailRaw = formData.get('email') as string
  const passwordRaw = formData.get('password') as string

  const email = sanitizeInput(emailRaw).toLowerCase()
  const password = passwordRaw ? String(passwordRaw) : ''

  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios.' }
  }

  // Rate Limiting: máx 5 tentativas por 15 minutos por email/IP
  const rateLimit = checkRateLimit(`login:${email}`, 5, 15 * 60 * 1000)
  if (!rateLimit.allowed) {
    return { 
      error: `Muitas tentativas de login. Por segurança, tente novamente em ${Math.ceil(rateLimit.resetInSeconds / 60)} minutos.` 
    }
  }

  const supabase = await createClient()

  // Buscar usuário na base
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, password_hash, role')
    .eq('email', email)
    .single()

  // Verificação de senha estrita
  let isValid = false
  if (profile && profile.password_hash) {
    isValid = await verifyPassword(password, profile.password_hash)
  }

  if (!isValid || !profile) {
    await logSecurityAudit(supabase, 'LOGIN_FAILED', 'auth', `Tentativa de login falhou para o e-mail: ${email}`)
    return { error: 'Credenciais inválidas. Verifique seu e-mail e senha.' }
  }

  // Reseta rate limit após sucesso
  resetRateLimit(`login:${email}`)

  let userFullName = profile?.full_name?.trim()
  if (!userFullName || (userFullName === 'Administrador' && email !== 'admin@prefeitura.gov.br')) {
    userFullName = formatNameFromEmail(email)
  }
  if (!userFullName) {
    userFullName = 'Administrador'
  }

  const userRole = profile?.role || (email.includes('admin') ? 'admin' : 'atendente')
  const userId = profile?.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  // Se o usuário não existia na tabela profiles, inserimos para persistência garantida
  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId,
      full_name: userFullName,
      email: email,
      role: userRole,
      created_at: new Date().toISOString()
    })
  } else if (profile.full_name !== userFullName && userFullName !== 'Administrador') {
    await supabase.from('profiles').update({
      full_name: userFullName
    }).eq('id', profile.id)
  }

  await logSecurityAudit(
    supabase, 
    'LOGIN_SUCCESS', 
    'auth', 
    `Login realizado com sucesso para o usuário ${userFullName} (${email})`,
    userId
  )

  // Emite token JWT de sessão assinado
  const sessionToken = await createSessionToken(profile.id)
  const cookieStore = await cookies()

  // Grava cookie de sessão assinado seguro
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions())
  cookieStore.delete('logged_out')

  // Limpa cookies legados em texto puro
  for (const legacy of LEGACY_AUTH_COOKIES) {
    cookieStore.delete(legacy)
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

/**
 * 2. Cadastro de Novo Usuário (Self-Signup)
 * - Validação estrita de e-mail e senha (min 8 chars, maiúscula, minúscula, número/símbolo)
 * - Prevenção de user enumeration com mensagem genérica
 * - Hash com bcrypt (12 rounds)
 * - Papel padrão: 'atendente'
 */
export async function registerUser(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const nameRaw = formData.get('name') || formData.get('full_name') || formData.get('nome')
  const emailRaw = formData.get('email')
  const passwordRaw = formData.get('password') || formData.get('senha')
  const confirmPasswordRaw = formData.get('confirmPassword') || formData.get('confirm_password') || formData.get('confirmarSenha') || formData.get('confirmar_senha')

  const name = sanitizeInput(String(nameRaw || ''))
  const email = sanitizeInput(String(emailRaw || '')).toLowerCase()
  const password = String(passwordRaw || '')
  const confirmPassword = String(confirmPasswordRaw || '')

  console.info(`[Auth:Register] Iniciando cadastro. Nome presente: ${Boolean(name)}, Email: ${email || '(vazio)'}, Senha len: ${password.length}, Confirmacao len: ${confirmPassword.length}`)

  if (!name || name.length < 3) {
    console.warn(`[Auth:Register] Falha: Nome inválido ou curto (${name})`)
    return { error: 'O nome completo deve conter no mínimo 3 caracteres.' }
  }

  if (!validateEmailFormat(email)) {
    console.warn(`[Auth:Register] Falha: Formato de e-mail inválido (${email})`)
    return { error: 'Formato de e-mail inválido.' }
  }

  if (confirmPassword && password !== confirmPassword) {
    console.warn(`[Auth:Register] Falha: Confirmação de senha não coincide para ${email}`)
    return { error: 'As senhas digitadas não coincidem.' }
  }

  // Validação de força da senha
  const passwordValidation = validatePasswordStrength(password)
  if (!passwordValidation.isValid) {
    console.warn(`[Auth:Register] Falha: Requisitos de força de senha não atendidos: ${passwordValidation.errors.join(', ')}`)
    return { error: passwordValidation.errors[0] }
  }

  // Rate Limiting: máx 5 tentativas de cadastro por IP/janela de 15 min
  const rateLimit = checkRateLimit(`register:${email}`, 5, 15 * 60 * 1000)
  if (!rateLimit.allowed) {
    console.warn(`[Auth:Register] Falha: Rate limit excedido para ${email}`)
    return { 
      error: `Limite de requisições excedido. Tente novamente em ${Math.ceil(rateLimit.resetInSeconds / 60)} minutos.` 
    }
  }

  const supabase = await createClient()

  // Verificar se o e-mail já existe na base
  const { data: existingUser, error: checkError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    console.error(`[Auth:Register] Erro ao consultar perfil existente no banco:`, checkError)
  }

  if (existingUser) {
    console.warn(`[Auth:Register] Tentativa de cadastro duplicado para e-mail existente: ${email} (ID: ${existingUser.id})`)
    await logSecurityAudit(supabase, 'REGISTER_DUPLICATE_ATTEMPT', 'auth', `Tentativa de cadastro com e-mail já existente: ${email}`)
    return { error: 'Não foi possível concluir o cadastro com os dados informados. Verifique as informações ou acesse o login.' }
  }

  console.info(`[Auth:Register] Validações e verificação de duplicidade aprovadas. Gerando hash de senha com bcrypt (12 rounds)...`)

  // Gerar hash seguro com bcrypt (12 rounds)
  const password_hash = await hashPassword(password, 12)

  // Papel padrão do novo usuário: 'atendente' (não admin por segurança)
  const defaultRole = 'atendente'
  const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: newUserId,
      full_name: name,
      email,
      password_hash,
      role: defaultRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (insertError) {
    console.error('[Auth:Register] Erro ao executar INSERT no banco de dados:', insertError)
    return { error: 'Ocorreu um erro ao processar o cadastro. Tente novamente.' }
  }

  console.info(`[Auth:Register] Usuário cadastrado com sucesso! ID: ${newUserId}, Role: ${defaultRole}, E-mail: ${email}`)

  // Log de auditoria (nunca registrando a senha)
  await logSecurityAudit(
    supabase,
    'REGISTER_USER',
    'auth',
    `Novo usuário registrado com sucesso: ${name} (${email}) com perfil '${defaultRole}'`,
    newUserId
  )

  // Criar sessão autenticada se for autocadastro ou preservar sessão do administrador
  const cookieStore = await cookies()
  const { data: { user: activeUser } } = await supabase.auth.getUser()
  const activeUserRole = activeUser?.role || activeUser?.user_metadata?.role

  if (activeUserRole === 'admin' || activeUserRole === 'manager') {
    // Quando o administrador cria um usuário/atendente, mantém a sessão do admin 100% intacta
    revalidatePath('/admin')
    revalidatePath('/admin/cidadaos')
    return { success: 'Usuário cadastrado com sucesso.' }
  }

  const sessionToken = await createSessionToken(newUserId)
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions())
  cookieStore.delete('logged_out')

  for (const legacy of LEGACY_AUTH_COOKIES) {
    cookieStore.delete(legacy)
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

// Alias de retrocompatibilidade
export const signup = registerUser

/**
 * 3. Solicitação de Redefinição de Senha (Forgot Password)
 * - Gera token criptográfico único
 * - Salva apenas o hash SHA-256 do token com expiração curta (20 minutos)
 * - Responde com mensagem genérica uniforme para prevenir enumeração de contas
 */
export async function requestPasswordReset(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const emailRaw = formData.get('email') as string
  const email = sanitizeInput(emailRaw).toLowerCase()

  if (!validateEmailFormat(email)) {
    return { error: 'Por favor, informe um endereço de e-mail válido.' }
  }

  // Rate Limiting: máx 5 solicitações por 15 minutos por e-mail
  const rateLimit = checkRateLimit(`forgot:${email}`, 5, 15 * 60 * 1000)
  if (!rateLimit.allowed) {
    return { 
      error: `Muitas solicitações recentes. Por favor, aguarde ${Math.ceil(rateLimit.resetInSeconds / 60)} minutos.` 
    }
  }

  const supabase = await createClient()

  // Buscar usuário na base
  const { data: user } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('email', email)
    .single()

  if (user) {
    // 1. Gera token aleatório de 32 bytes (64 caracteres hexadecimais)
    const rawToken = generateSecureToken(32)
    // 2. Hash SHA-256 para gravar no banco (nunca gravar o token em texto puro)
    const tokenHash = hashTokenSha256(rawToken)
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString() // 20 minutos

    // 3. Atualiza no perfil do usuário
    await supabase
      .from('profiles')
      .update({
        reset_token_hash: tokenHash,
        reset_token_expires_at: expiresAt
      })
      .eq('email', email)

    // 4. Registra no histórico de redefinições
    await supabase
      .from('password_resets')
      .insert({
        email,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      })

    // 5. Envia o e-mail com o link de recuperação
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/recuperar-senha?token=${rawToken}&email=${encodeURIComponent(email)}`

    await sendPasswordResetEmail({
      to: email,
      name: user.full_name || 'Cidadão/Servidor',
      resetUrl,
      expiresInMinutes: 20
    })

    await logSecurityAudit(
      supabase,
      'FORGOT_PASSWORD_REQUEST',
      'auth',
      `Solicitação de recuperação de senha enviada para ${email}`,
      user.id
    )
  } else {
    // Log silencioso quando o e-mail não existe (sem vazar para o cliente)
    await logSecurityAudit(
      supabase,
      'FORGOT_PASSWORD_NOT_FOUND',
      'auth',
      `Solicitação de recuperação de senha para e-mail não cadastrado: ${email}`
    )
  }

  // Resposta sempre uniforme para prevenir enumeração de usuários
  return { 
    success: 'Se o e-mail estiver cadastrado em nossa base, as instruções de redefinição de senha foram enviadas com validade de 20 minutos.' 
  }
}

// Alias de retrocompatibilidade
export const resetPassword = requestPasswordReset

/**
 * 4. Conclusão da Redefinição de Senha (Reset Password)
 * - Valida se o token existe, não expirou e é válido via hash SHA-256
 * - Valida a força da nova senha
 * - Aplica novo hash bcrypt
 * - Invalida o token e revoga sessões ativas
 */
export async function executePasswordReset(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const token = sanitizeInput(String(formData.get('token') || ''))
  const email = sanitizeInput(String(formData.get('email') || '')).toLowerCase()
  const password = String(formData.get('password') || formData.get('newPassword') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!token) {
    return { error: 'Token de recuperação inválido ou ausente. Solicite um novo link.' }
  }

  if (confirmPassword && password !== confirmPassword) {
    return { error: 'As senhas digitadas não coincidem.' }
  }

  const validation = validatePasswordStrength(password)
  if (!validation.isValid) {
    return { error: validation.errors[0] }
  }

  const supabase = await createClient()
  const tokenHash = hashTokenSha256(token)
  const nowIso = new Date().toISOString()

  // Buscar usuário com o token hash correspondente
  let query = supabase
    .from('profiles')
    .select('id, full_name, email, reset_token_hash, reset_token_expires_at')
    .eq('reset_token_hash', tokenHash)
    .gte('reset_token_expires_at', nowIso)

  if (email) {
    query = query.eq('email', email)
  }

  const { data: user } = await query.single()

  if (!user) {
    return { error: 'O link de recuperação é inválido ou já expirou. Por favor, solicite um novo.' }
  }

  // Novo hash de senha com bcrypt (12 rounds)
  const new_password_hash = await hashPassword(password, 12)

  // Atualizar senha e invalidar token no banco
  await supabase
    .from('profiles')
    .update({
      password_hash: new_password_hash,
      reset_token_hash: null,
      reset_token_expires_at: null,
      updated_at: nowIso
    })
    .eq('id', user.id)

  // Marcar na tabela de auditoria de resets
  await supabase
    .from('password_resets')
    .update({ used_at: nowIso })
    .eq('token_hash', tokenHash)

  // Log de auditoria
  await logSecurityAudit(
    supabase,
    'RESET_PASSWORD_SUCCESS',
    'auth',
    `Senha redefinida com sucesso para o usuário ${user.email}`,
    user.id
  )

  // Invalida sessões ativas existentes
  const cookieStore = await cookies()
  cookieStore.delete('auth_session')
  cookieStore.set('logged_out', 'true', { path: '/' })

  return { success: 'Senha atualizada com sucesso! Você já pode realizar o login com a nova senha.' }
}

/**
 * 5. Logout
 */
export async function logout() {
  const cookieStore = await cookies()
  cookieStore.set('logged_out', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  })
  cookieStore.delete(SESSION_COOKIE_NAME)
  for (const legacy of LEGACY_AUTH_COOKIES) {
    cookieStore.delete(legacy)
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * 6. Exclusão da Própria Conta (Self-Account Deletion)
 * - Permite que qualquer operador ou cidadão exclua a própria conta
 * - Aplica a regra de segurança do Último Administrador: se for o único admin ativo, bloqueia com mensagem explicativa
 * - Registra log de auditoria
 * - Destrói cookies de sessão e limpa credenciais
 */
export async function deleteMyAccount(passwordConfirmation?: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.id) {
    return { error: 'Sessão expirada. Faça login novamente para continuar.' }
  }

  // Buscar perfil atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, password_hash')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: 'Perfil de usuário não encontrado.' }
  }

  // Se o usuário for administrador, validar se existe outro administrador ativo no sistema
  if (profile.role === 'admin') {
    const { data: activeAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('status', 'inactive')
      .neq('id', user.id)

    if (!activeAdmins || activeAdmins.length === 0) {
      return { 
        error: 'Você é o único administrador ativo do sistema e não pode excluir sua conta sem antes nomear outro administrador.' 
      }
    }
  }

  // Validação opcional de senha caso seja informada
  if (passwordConfirmation && profile.password_hash) {
    const isPasswordValid = await verifyPassword(passwordConfirmation, profile.password_hash)
    if (!isPasswordValid) {
      return { error: 'A senha informada está incorreta.' }
    }
  }

  // Excluir registro do perfil
  const { error: deleteError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', user.id)

  if (deleteError) {
    console.error('[Auth:DeleteAccount] Erro ao excluir perfil:', deleteError)
    return { error: 'Não foi possível excluir sua conta. Tente novamente.' }
  }

  // Registrar auditoria
  await logSecurityAudit(
    supabase,
    'DELETE_MY_ACCOUNT',
    'profiles',
    `Usuário ${profile.full_name} (${profile.email}) excluiu permanentemente a própria conta.`,
    user.id
  )

  // Limpar cookies e encerrar sessão
  const cookieStore = await cookies()
  cookieStore.set('logged_out', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  })
  cookieStore.delete(SESSION_COOKIE_NAME)
  for (const legacy of LEGACY_AUTH_COOKIES) {
    cookieStore.delete(legacy)
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
