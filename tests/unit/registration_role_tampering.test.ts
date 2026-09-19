import { registerUser } from '@/app/actions/auth'
import { POST as registerRouteHandler } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'
import { getMockStore } from '@/lib/supabase/server'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn()
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockImplementation(async () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  }))
}))

describe('ETAPA F: Imutabilidade de Perfil no Autocadastro Público', () => {
  beforeEach(() => {
    delete (globalThis as Record<string, unknown>).__schedulingMockData__
    const store = getMockStore()
    store.profiles = (store.profiles || []).filter((p: { email?: string }) => !p.email?.includes('hacker'))
  })

  it('deve ignorar tentativa de injeção de role=admin via FormData em registerUser', async () => {
    const maliciousEmail = 'hacker.form@tentativa.com'
    const formData = new FormData()
    formData.set('name', 'Invasor FormData')
    formData.set('email', maliciousEmail)
    formData.set('password', 'SenhaForte#2026')
    formData.set('confirmPassword', 'SenhaForte#2026')
    // Tentativa de injeção de privilégio
    formData.set('role', 'admin')
    formData.set('user_metadata[role]', 'admin')
    formData.set('is_admin', 'true')

    await registerUser(undefined, formData)

    const mockStore = getMockStore()
    const createdProfile = mockStore.profiles?.find((p: { email?: string; role?: string }) => p.email === maliciousEmail)

    expect(createdProfile).toBeDefined()
    expect(createdProfile?.role).not.toBe('admin')
    expect(createdProfile?.role).not.toBe('manager')
  })

  it('deve ignorar tentativa de injeção de role=admin via payload JSON em /api/auth/register', async () => {
    const maliciousEmail = 'hacker.json@tentativa.com'
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invasor API JSON',
        email: maliciousEmail,
        password: 'SenhaForte#2026',
        confirmPassword: 'SenhaForte#2026',
        role: 'admin',
        is_admin: true,
        status: 'active'
      })
    })

    const response = await registerRouteHandler(request)
    expect(response.status).toBe(201)

    const mockStore = getMockStore()
    const createdProfile = mockStore.profiles?.find((p: { email?: string; role?: string }) => p.email === maliciousEmail)

    expect(createdProfile).toBeDefined()
    expect(createdProfile?.role).not.toBe('admin')
    expect(createdProfile?.role).not.toBe('manager')
  })
})
