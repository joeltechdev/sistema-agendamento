import { SignJWT } from 'jose'
import { createSessionToken, verifySessionToken } from '@/lib/security/session'
import { createClient, getMockStore } from '@/lib/supabase/server'

let currentTestCookies: Record<string, string> = {}

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockImplementation(async () => ({
    get: (name: string) => currentTestCookies[name] ? { value: currentTestCookies[name] } : undefined,
    set: jest.fn(),
    delete: jest.fn()
  }))
}))

describe('ETAPA E.3: Segurança de Sessão Criptografada (JWT & SESSION_SECRET)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    currentTestCookies = {}
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('(1) Importar o módulo lib/security/session NÃO deve lançar erro mesmo em produção sem SESSION_SECRET', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' })
    delete process.env.SESSION_SECRET

    // A função verifySessionToken com token vazio não deve falhar
    const result = await verifySessionToken('')
    expect(result).toBeNull()
  })

  it('(2) SESSION_SECRET ausente ou menor que 32 caracteres em produção deve lançar erro no PRIMEIRO USO', async () => {
    Object.assign(process.env, { NODE_ENV: 'production', SESSION_SECRET: 'curta-123' })

    await expect(createSessionToken('user-123')).rejects.toThrow(/SESSION_SECRET/i)
  })

  it('(3) Deve gerar token JWT assinado válido com sub contendo o userId', async () => {
    process.env.SESSION_SECRET = 'segredo-muito-seguro-com-mais-de-32-caracteres-para-teste'

    const token = await createSessionToken('user-uuid-456')
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    const verified = await verifySessionToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.sub).toBe('user-uuid-456')
  })

  it('(4) Token com assinatura adulterada deve ser rejeitado', async () => {
    process.env.SESSION_SECRET = 'segredo-muito-seguro-com-mais-de-32-caracteres-para-teste'

    const validToken = await createSessionToken('user-uuid-456')
    // Adulterar o primeiro caractere da assinatura para garantir que os bytes de validação sejam corrompidos
    const parts = validToken.split('.')
    const signature = parts[2]
    const tamperedSignature = (signature[0] === 'X' ? 'Y' : 'X') + signature.slice(1)
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`

    const verified = await verifySessionToken(tamperedToken)
    expect(verified).toBeNull()
  })

  it('(5) Token expirado deve ser rejeitado', async () => {
    const secret = new TextEncoder().encode('segredo-muito-seguro-com-mais-de-32-caracteres-para-teste')
    process.env.SESSION_SECRET = 'segredo-muito-seguro-com-mais-de-32-caracteres-para-teste'

    // Gerar token expirado há 1 hora
    const expiredToken = await new SignJWT({ sub: 'user-expirado' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret)

    const verified = await verifySessionToken(expiredToken)
    expect(verified).toBeNull()
  })

  it('(6) Cookie forjado auth_user_role=admin sem token app_session válido não deve autenticar', async () => {
    // Mock de cookies onde o invasor injetou auth_user_role=admin mas não possui app_session
    currentTestCookies = {
      auth_user_role: 'admin',
      auth_user_id: 'hacker-id',
      auth_user_email: 'hacker@malicioso.com'
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // O usuário DEVE ser null pois não há token app_session válido assinado
    expect(user).toBeNull()
  })

  it('(7) Usuário rebaixado de admin para atendente no banco perde acesso estrito imediatamente com o mesmo token', async () => {
    process.env.SESSION_SECRET = 'segredo-muito-seguro-com-mais-de-32-caracteres-para-teste'

    const userId = 'operador-mutavel-1'
    const mockStore = getMockStore()

    // 1. Cadastra usuário como 'admin' no banco
    const userProfile = {
      id: userId,
      email: 'operador@poranga.ce.gov.br',
      full_name: 'Operador Mutável',
      role: 'admin',
      status: 'active'
    }
    mockStore.profiles = [userProfile]

    // 2. Emite token de sessão enquanto admin
    const token = await createSessionToken(userId)

    currentTestCookies = {
      app_session: token
    }

    // 3. Verifica acesso como admin
    let supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    expect(user).not.toBeNull()
    expect(user?.role || user?.user_metadata?.role).toBe('admin')

    // 4. Rebaixa o usuário no banco para 'atendente'
    userProfile.role = 'atendente'

    // 5. Mesma requisição / cliente com o mesmo token DEVE refletir 'atendente' imediatamente
    supabase = await createClient()
    const checkAfter = await supabase.auth.getUser()
    expect(checkAfter.data.user).not.toBeNull()
    expect(checkAfter.data.user?.role || checkAfter.data.user?.user_metadata?.role).toBe('atendente')
  })
})
