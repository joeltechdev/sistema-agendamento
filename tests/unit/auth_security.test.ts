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
import { registerUser, requestPasswordReset, executePasswordReset, deleteMyAccount } from '@/app/actions/auth'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

const mockCookieStore = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn()
}

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockImplementation(async () => mockCookieStore)
}))

// Mock Supabase DB in-memory for testing
const mockProfiles: any[] = []
const mockAuditLogs: any[] = []
const mockPasswordResets: any[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    from: jest.fn().mockImplementation((table: string) => {
      let filterEmail: string | null = null
      let filterTokenHash: string | null = null
      let filterExpiresAtGte: string | null = null
      let filterId: string | null = null
      let filterNeqId: string | null = null

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((col: string, val: any) => {
          if (col === 'email') filterEmail = val
          if (col === 'reset_token_hash') filterTokenHash = val
          if (col === 'token_hash') filterTokenHash = val
          if (col === 'id') filterId = val
          return chain
        }),
        gte: jest.fn().mockImplementation((col: string, val: any) => {
          if (col === 'reset_token_expires_at' || col === 'expires_at') filterExpiresAtGte = val
          return chain
        }),
        insert: jest.fn().mockImplementation(async (payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload]
          if (table === 'profiles') mockProfiles.push(...items)
          if (table === 'audit_logs') mockAuditLogs.push(...items)
          if (table === 'password_resets') mockPasswordResets.push(...items)
          return { error: null }
        }),
        update: jest.fn().mockImplementation((payload: any) => {
          return {
            eq: jest.fn().mockImplementation(async (col: string, val: any) => {
              if (table === 'profiles') {
                const target = mockProfiles.find(p => p[col] === val)
                if (target) Object.assign(target, payload)
              }
              if (table === 'password_resets') {
                const target = mockPasswordResets.find(r => r[col] === val)
                if (target) Object.assign(target, payload)
              }
              return { error: null }
            })
          }
        }),
        delete: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(async (col: string, val: any) => {
            if (table === 'profiles') {
              const idx = mockProfiles.findIndex(p => p[col] === val)
              if (idx >= 0) mockProfiles.splice(idx, 1)
            }
            return { error: null }
          })
        })),
        single: jest.fn().mockImplementation(async () => {
          if (table === 'profiles') {
            let found = null
            if (filterEmail) found = mockProfiles.find(p => p.email === filterEmail)
            if (filterTokenHash) found = mockProfiles.find(p => p.reset_token_hash === filterTokenHash)
            if (filterId) found = mockProfiles.find(p => p.id === filterId)
            return { data: found || null, error: null }
          }
          return { data: null, error: null }
        }),
        neq: jest.fn().mockImplementation((col: string, val: any) => {
          if (col === 'id') filterNeqId = val
          return chain
        }),
        then: jest.fn().mockImplementation((resolve: any) => {
          if (table === 'profiles') {
            let res = mockProfiles.filter(p => p.role === 'admin' && p.status !== 'inactive')
            if (filterNeqId) res = res.filter(p => p.id !== filterNeqId)
            resolve({ data: res, error: null })
          } else {
            resolve({ data: [], error: null })
          }
        })
      }
      return chain
    }),
    auth: {
      getUser: jest.fn().mockImplementation(async () => {
        const loggedInUser = mockProfiles[mockProfiles.length - 1]
        return { data: { user: loggedInUser ? { id: loggedInUser.id, email: loggedInUser.email } : null } }
      })
    }
  }))
}))

describe('Auth Security Module - Password & Token Utilities', () => {
  it('deve validar requisitos fortes de senha (min 8 chars, maiúscula, minúscula, número/símbolo)', () => {
    // Senha fraca (menos de 8 chars)
    expect(validatePasswordStrength('Ab1!').isValid).toBe(false)
    // Senha sem maiúscula
    expect(validatePasswordStrength('senha123!').isValid).toBe(false)
    // Senha sem minúscula
    expect(validatePasswordStrength('SENHA123!').isValid).toBe(false)
    // Senha sem número nem símbolo
    expect(validatePasswordStrength('SenhaSemNumero').isValid).toBe(false)
    // Senha válida forte
    expect(validatePasswordStrength('SenhaForte@2026').isValid).toBe(true)
  })

  it('deve validar formato de e-mail e sanitizar inputs', () => {
    expect(validateEmailFormat('usuario@prefeitura.gov.br')).toBe(true)
    expect(validateEmailFormat('invalido-sem-arroba')).toBe(false)
    expect(sanitizeInput('  <script>alert("xss")</script> Teste ')).toBe('scriptalert("xss")/script Teste')
  })

  it('deve criar hash bcrypt seguro (12 rounds) e verificar corretamente', async () => {
    const rawPassword = 'MinhaSenhaSegura#2026'
    const hash = await hashPassword(rawPassword, 12)
    
    expect(hash).toBeDefined()
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true)
    expect(await verifyPassword(rawPassword, hash)).toBe(true)
    expect(await verifyPassword('SenhaErrada#2026', hash)).toBe(false)
  })

  it('deve gerar token criptográfico único e hash SHA-256', () => {
    const token1 = generateSecureToken(32)
    const token2 = generateSecureToken(32)
    expect(token1).not.toBe(token2)
    expect(token1.length).toBe(64) // 32 bytes em hex = 64 chars

    const hash1 = hashTokenSha256(token1)
    expect(hash1.length).toBe(64)
    expect(hashTokenSha256(token1)).toBe(hash1)
  })
})

describe('Rate Limiter Module', () => {
  it('deve bloquear requisições que excederem o limite (5 tentativas por janela)', () => {
    const key = 'test-ip-rate-limit-1'
    resetRateLimit(key)

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(key, 5, 60000)
      expect(res.allowed).toBe(true)
    }

    // 6ª tentativa deve ser bloqueada
    const blocked = checkRateLimit(key, 5, 60000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })
})

describe('Fluxo 1: Cadastro de Novo Usuário (Self-Signup)', () => {
  beforeEach(() => {
    mockProfiles.length = 0
    mockAuditLogs.length = 0
  })

  it('deve cadastrar um novo usuário com papel padrão "atendente", senha com hash bcrypt e log de auditoria', async () => {
    const formData = new FormData()
    formData.set('name', 'Atendente Silva')
    formData.set('email', 'silva.atendente@poranga.ce.gov.br')
    formData.set('password', 'SenhaForte#2026')
    formData.set('confirmPassword', 'SenhaForte#2026')

    const result = await registerUser(undefined, formData)
    expect(result?.error).toBeUndefined()

    // Verifica que o perfil foi inserido com role 'atendente'
    const createdProfile = mockProfiles.find(p => p.email === 'silva.atendente@poranga.ce.gov.br')
    expect(createdProfile).toBeDefined()
    expect(createdProfile.role).toBe('atendente')
    expect(createdProfile.password_hash).not.toBe('SenhaForte#2026')
    expect(await verifyPassword('SenhaForte#2026', createdProfile.password_hash)).toBe(true)

    // Verifica log de auditoria
    const audit = mockAuditLogs.find(l => l.action === 'REGISTER_USER')
    expect(audit).toBeDefined()
  })

  it('deve impedir cadastro duplicado sem expor dados (evitar enumeração)', async () => {
    mockProfiles.push({
      id: 'existing-1',
      full_name: 'Usuário Existente',
      email: 'duplicado@poranga.ce.gov.br',
      role: 'atendente'
    })

    const formData = new FormData()
    formData.set('name', 'Outro Nome')
    formData.set('email', 'duplicado@poranga.ce.gov.br')
    formData.set('password', 'OutraSenhaForte#2026')

    const result = await registerUser(undefined, formData)
    expect(result?.error).toBeDefined()
  })
})

describe('Fluxo 2: Redefinição de Senha (Forgot Password & Reset)', () => {
  beforeEach(() => {
    mockProfiles.length = 0
    mockPasswordResets.length = 0
    mockAuditLogs.length = 0
  })

  it('deve solicitar recuperação de senha, gerar hash SHA-256 do token e responder com mensagem segura', async () => {
    mockProfiles.push({
      id: 'user-rec-1',
      full_name: 'Maria Servidora',
      email: 'maria@poranga.ce.gov.br',
      password_hash: await hashPassword('AntigaSenha#1', 12)
    })

    const formData = new FormData()
    formData.set('email', 'maria@poranga.ce.gov.br')

    const result = await requestPasswordReset(undefined, formData)
    expect(result?.success).toContain('as instruções de redefinição de senha foram enviadas')

    // Verifica que o token hash foi salvo no perfil
    const user = mockProfiles.find(p => p.email === 'maria@poranga.ce.gov.br')
    expect(user.reset_token_hash).toBeDefined()
    expect(user.reset_token_expires_at).toBeDefined()
  })

  it('deve executar a redefinição de senha com sucesso, atualizar hash e invalidar o token', async () => {
    const rawToken = 'test-secret-recovery-token-xyz-12345'
    const tokenHash = hashTokenSha256(rawToken)

    mockProfiles.push({
      id: 'user-rec-2',
      full_name: 'Carlos Atendente',
      email: 'carlos@poranga.ce.gov.br',
      password_hash: await hashPassword('SenhaVelha#123', 12),
      reset_token_hash: tokenHash,
      reset_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    })

    const resetFormData = new FormData()
    resetFormData.set('token', rawToken)
    resetFormData.set('email', 'carlos@poranga.ce.gov.br')
    resetFormData.set('password', 'NovaSenhaSegura#2026')
    resetFormData.set('confirmPassword', 'NovaSenhaSegura#2026')

    const resetResult = await executePasswordReset(undefined, resetFormData)
    expect(resetResult?.success).toContain('Senha atualizada com sucesso')

    // Verifica que o usuário agora tem a nova senha e o token foi invalidado
    const updatedUser = mockProfiles.find(p => p.email === 'carlos@poranga.ce.gov.br')
    expect(await verifyPassword('NovaSenhaSegura#2026', updatedUser.password_hash)).toBe(true)
    expect(updatedUser.reset_token_hash).toBeNull()

    // Verifica logout / limpeza de sessão
    expect(mockCookieStore.delete).toHaveBeenCalledWith('auth_session')
  })

  it('deve armazenar os dados do usuário autenticado nos cookies de sessão no login e no registro', async () => {
    const formData = new FormData()
    formData.set('name', 'Antônio Roberto')
    formData.set('email', 'antonio.roberto@poranga.ce.gov.br')
    formData.set('password', 'SenhaForte#2026')
    formData.set('confirmPassword', 'SenhaForte#2026')

    await registerUser(undefined, formData)

    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_session', 'active', expect.any(Object))
    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_name', 'Antônio Roberto', expect.any(Object))
    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_email', 'antonio.roberto@poranga.ce.gov.br', expect.any(Object))
    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_role', 'atendente', expect.any(Object))
  })

  it('deve preservar os cookies e a sessão do administrador ao cadastrar um novo atendente', async () => {
    mockCookieStore.get.mockImplementation((key: string) => {
      if (key === 'auth_user_role') return { value: 'admin' }
      if (key === 'auth_user_id') return { value: 'admin-id-123' }
      return undefined
    })

    const formData = new FormData()
    formData.set('name', 'Nova Atendente Juliana')
    formData.set('email', 'juliana.atendente@poranga.ce.gov.br')
    formData.set('password', 'SenhaForte#2026')
    formData.set('confirmPassword', 'SenhaForte#2026')

    mockCookieStore.set.mockClear()
    const result = await registerUser(undefined, formData)

    expect(result?.success).toBe('Usuário cadastrado com sucesso.')
    // Não deve ter sobrescrito os cookies da sessão ativa do admin
    expect(mockCookieStore.set).not.toHaveBeenCalledWith('auth_user_role', 'atendente', expect.any(Object))
  })

  it('deve formatar corretamente nomes a partir do e-mail quando o nome completo não foi informado', () => {
    expect(formatNameFromEmail('joao.silva@prefeitura.gov.br')).toBe('Joao Silva')
    expect(formatNameFromEmail('carlos_eduardo@poranga.ce.gov.br')).toBe('Carlos Eduardo')
    expect(formatNameFromEmail('maria-helena@gmail.com')).toBe('Maria Helena')
    expect(formatNameFromEmail('ana@gov.br')).toBe('Ana')
  })

  it('deve gravar o nome real do usuário nos cookies de sessão ao realizar login com sucesso', async () => {
    // Adiciona perfil mock com nome real
    mockProfiles.push({
      id: 'prof-roberto-1',
      email: 'roberto.almeida@poranga.ce.gov.br',
      full_name: 'Roberto Almeida',
      password_hash: await hashPassword('SenhaSecreta#123', 6),
      role: 'admin'
    })

    mockCookieStore.set.mockClear()

    const formData = new FormData()
    formData.set('email', 'roberto.almeida@poranga.ce.gov.br')
    formData.set('password', 'SenhaSecreta#123')

    const { login } = await import('@/app/actions/auth')
    await login(undefined, formData)

    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_name', 'Roberto Almeida', expect.any(Object))
    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_email', 'roberto.almeida@poranga.ce.gov.br', expect.any(Object))
    expect(mockCookieStore.set).toHaveBeenCalledWith('auth_user_role', 'admin', expect.any(Object))
  })

  it('deve permitir que um usuário/atendente exclua sua própria conta e limpe os cookies de sessão', async () => {
    const userId = 'user-atendente-del-1'
    mockProfiles.push({
      id: userId,
      email: 'atendente.excluir@poranga.ce.gov.br',
      full_name: 'Atendente Para Excluir',
      role: 'atendente',
      password_hash: await hashPassword('SenhaForte#2026', 6)
    })

    mockCookieStore.set.mockClear()
    mockCookieStore.delete.mockClear()

    const result = await deleteMyAccount()

    expect(result.success).toBe(true)
    expect(mockCookieStore.set).toHaveBeenCalledWith('logged_out', 'true', expect.any(Object))
    expect(mockCookieStore.delete).toHaveBeenCalledWith('auth_session')
    expect(mockCookieStore.delete).toHaveBeenCalledWith('auth_user_id')
    expect(mockCookieStore.delete).toHaveBeenCalledWith('auth_user_email')
  })

  it('deve bloquear a exclusão da própria conta se o usuário for o único administrador ativo', async () => {
    // Configura apenas 1 administrador no mock
    mockProfiles.length = 0
    const singleAdminId = 'admin-solitario-1'
    mockProfiles.push({
      id: singleAdminId,
      email: 'admin.unico@poranga.ce.gov.br',
      full_name: 'Admin Único',
      role: 'admin',
      status: 'active',
      password_hash: await hashPassword('SenhaForte#2026', 6)
    })

    const result = await deleteMyAccount()

    expect(result.error).toContain('único administrador ativo do sistema')
  })
})


