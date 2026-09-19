import { login } from '@/app/actions/auth'
import { hashPassword } from '@/lib/security/auth-utils'

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

interface MockProfile {
  id: string
  email: string
  full_name: string
  password_hash: string | null
  role: string
}

const mockProfiles: MockProfile[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    from: jest.fn().mockImplementation((table: string) => {
      let filterEmail: string | null = null
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((col: string, val: string) => {
          if (col === 'email') filterEmail = val
          return chain
        }),
        single: jest.fn().mockImplementation(async () => {
          if (table === 'profiles') {
            const found = mockProfiles.find(p => p.email === filterEmail)
            return { data: found || null, error: null }
          }
          return { data: null, error: null }
        }),
        insert: jest.fn().mockImplementation(async (payload: MockProfile | MockProfile[]) => {
          const items = Array.isArray(payload) ? payload : [payload]
          if (table === 'profiles') mockProfiles.push(...items)
          return { error: null }
        }),
        update: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(async () => ({ error: null }))
        }))
      }
      return chain
    })
  }))
}))

describe('ETAPA E.1: Segurança de Login sem Password Hash (Eliminação de Bypass)', () => {
  beforeEach(() => {
    mockProfiles.length = 0
    mockCookieStore.set.mockClear()
  })

  it('1. Deve recusar login com erro genérico se usuário existe mas tem password_hash nulo', async () => {
    mockProfiles.push({
      id: 'usr-sem-hash',
      email: 'semhash@poranga.ce.gov.br',
      full_name: 'Usuario Sem Hash',
      password_hash: null,
      role: 'atendente'
    })

    const formData = new FormData()
    formData.set('email', 'semhash@poranga.ce.gov.br')
    formData.set('password', '123456')

    const result = await login(undefined, formData)

    expect(result?.error).toBe('Credenciais inválidas. Verifique seu e-mail e senha.')
    expect(mockCookieStore.set).not.toHaveBeenCalled()
  })

  it('2. Deve recusar login com erro genérico se usuário não existe na base', async () => {
    const formData = new FormData()
    formData.set('email', 'inexistente@poranga.ce.gov.br')
    formData.set('password', 'SenhaQualquer123')

    const result = await login(undefined, formData)

    expect(result?.error).toBe('Credenciais inválidas. Verifique seu e-mail e senha.')
    expect(mockCookieStore.set).not.toHaveBeenCalled()
    // Não deve criar usuário automaticamente no banco
    expect(mockProfiles.some(p => p.email === 'inexistente@poranga.ce.gov.br')).toBe(false)
  })

  it('3. Deve recusar login se usuário possui hash válido mas senha está incorreta', async () => {
    const validHash = await hashPassword('SenhaCorreta#2026', 6)
    mockProfiles.push({
      id: 'usr-com-hash',
      email: 'valido@poranga.ce.gov.br',
      full_name: 'Usuario Com Hash',
      password_hash: validHash,
      role: 'atendente'
    })

    const formData = new FormData()
    formData.set('email', 'valido@poranga.ce.gov.br')
    formData.set('password', 'SenhaErrada#9999')

    const result = await login(undefined, formData)

    expect(result?.error).toBe('Credenciais inválidas. Verifique seu e-mail e senha.')
    expect(mockCookieStore.set).not.toHaveBeenCalled()
  })

  it('4. Deve autenticar com sucesso se usuário possui hash válido e senha correta', async () => {
    const validHash = await hashPassword('SenhaCorreta#2026', 6)
    mockProfiles.push({
      id: 'usr-com-hash-ok',
      email: 'sucesso@poranga.ce.gov.br',
      full_name: 'Usuario Sucesso',
      password_hash: validHash,
      role: 'admin'
    })

    const formData = new FormData()
    formData.set('email', 'sucesso@poranga.ce.gov.br')
    formData.set('password', 'SenhaCorreta#2026')

    const result = await login(undefined, formData)

    expect(result?.error).toBeUndefined()
  })
})
