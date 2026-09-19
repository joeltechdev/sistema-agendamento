import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { updateSession } from '@/lib/supabase/middleware'

describe('ETAPA 1: Segurança do Middleware e Proxy contra Acesso Anônimo', () => {
  it('(a) Requisição sem cookie para /admin deve ser bloqueada e redirecionada para /login', async () => {
    const req = new NextRequest('http://localhost:3000/admin')
    const response = await proxy(req)

    expect(response).toBeDefined()
    // Deve redirecionar para /login (status 307 ou 302, ou Location header para /login)
    const location = response.headers.get('location') || ''
    const isRedirect = response.status === 307 || response.status === 302 || response.status === 308
    expect(isRedirect).toBe(true)
    expect(location).toContain('/login')
  })

  it('(b) Requisição sem cookie e sem logged_out não deve virar admin no updateSession', async () => {
    const req = new NextRequest('http://localhost:3000/admin')
    const { user } = await updateSession(req)

    // O usuário anônimo NÃO deve virar admin nem ter sessão
    expect(user).toBeNull()
  })

  it('(c1) Requisição sem sessão para /api/admin/events deve retornar HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/events')
    const response = await proxy(req)

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toMatch(/não autenticado|unauthorized/i)
  })

  it('(c2) Requisição sem sessão para /api/admin/metrics deve retornar HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/metrics')
    const response = await proxy(req)

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toMatch(/não autenticado|unauthorized/i)
  })

  it('(c3) Requisição sem sessão para /api/system/settings deve retornar HTTP 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/system/settings')
    const response = await proxy(req)

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toMatch(/não autenticado|unauthorized/i)
  })
})
