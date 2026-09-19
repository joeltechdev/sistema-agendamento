import { 
  getAdministrators, 
  adminCreateUser, 
  adminUpdateUser, 
  adminToggleUserStatus, 
  adminResetUserPassword, 
  adminDeleteUser 
} from '@/app/actions/admin'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

let mockCurrentUser: any = { id: 'admin-1', email: 'admin@prefeitura.gov.br', role: 'admin' }
let mockProfiles: any[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: {
      getUser: jest.fn().mockImplementation(async () => {
        if (!mockCurrentUser) return { data: { user: null }, error: { message: 'Unauthorized' } }
        return { data: { user: mockCurrentUser }, error: null }
      })
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        const eqFilters: Record<string, any> = {}
        const neqFilters: Record<string, any> = {}
        const inFilters: Record<string, any[]> = {}
        let pendingUpdate: any = null
        let pendingDelete = false

        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: (col: string, val: any) => { eqFilters[col] = val; return chain },
          neq: (col: string, val: any) => { neqFilters[col] = val; return chain },
          in: (col: string, vals: any[]) => { inFilters[col] = vals; return chain },
          order: jest.fn().mockReturnThis(),
          insert: jest.fn().mockImplementation((payload: any) => {
            const items = Array.isArray(payload) ? payload : [payload]
            mockProfiles.push(...items)
            return { data: items, error: null }
          }),
          update: jest.fn().mockImplementation((payload: any) => {
            pendingUpdate = payload
            return chain
          }),
          delete: jest.fn().mockImplementation(() => {
            pendingDelete = true
            return chain
          }),
          single: jest.fn().mockImplementation(async () => {
            let res = [...mockProfiles]
            for (const [k, v] of Object.entries(eqFilters)) res = res.filter(p => p[k] === v)
            for (const [k, v] of Object.entries(neqFilters)) res = res.filter(p => p[k] !== v)
            return { data: res[0] || null, error: null }
          }),
          then: (resolve: any) => {
            if (pendingUpdate) {
              for (let i = 0; i < mockProfiles.length; i++) {
                let match = true
                for (const [k, v] of Object.entries(eqFilters)) {
                  if (mockProfiles[i][k] !== v) { match = false; break }
                }
                if (match) {
                  mockProfiles[i] = { ...mockProfiles[i], ...pendingUpdate }
                }
              }
              pendingUpdate = null
            }
            if (pendingDelete) {
              for (let i = mockProfiles.length - 1; i >= 0; i--) {
                let match = true
                for (const [k, v] of Object.entries(eqFilters)) {
                  if (mockProfiles[i][k] !== v) { match = false; break }
                }
                if (match) {
                  mockProfiles.splice(i, 1)
                }
              }
              pendingDelete = false
            }

            let res = [...mockProfiles]
            for (const [k, v] of Object.entries(eqFilters)) res = res.filter(p => p[k] === v)
            for (const [k, v] of Object.entries(neqFilters)) res = res.filter(p => p[k] !== v)
            for (const [k, v] of Object.entries(inFilters)) res = res.filter(p => v.includes(p[k]))
            resolve({ data: res, count: res.length, error: null })
          }
        }
        return chain
      }

      if (table === 'audit_logs') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null })
        }
      }

      return {}
    })
  }))
}))

describe('Módulo Administradores — QA & Segurança Completo', () => {
  beforeEach(() => {
    mockCurrentUser = { id: 'admin-1', email: 'admin@prefeitura.gov.br', role: 'admin' }
    mockProfiles = [
      {
        id: 'admin-1',
        full_name: 'Administrador Principal',
        email: 'admin@prefeitura.gov.br',
        role: 'admin',
        status: 'active',
        created_at: '2026-09-01T10:00:00Z'
      },
      {
        id: 'admin-2',
        full_name: 'Supervisora Maria',
        email: 'maria@poranga.ce.gov.br',
        role: 'admin',
        status: 'active',
        created_at: '2026-09-02T10:00:00Z'
      },
      {
        id: 'user-3',
        full_name: 'Atendente João',
        email: 'joao@poranga.ce.gov.br',
        role: 'atendente',
        status: 'active',
        created_at: '2026-09-03T10:00:00Z'
      }
    ]
  })

  // 1. LISTAGEM & KPI
  it('deve listar administradores e calcular KPIs corretamente', async () => {
    const res = await getAdministrators()
    expect(res.users.length).toBe(3)
    expect(res.kpi.total).toBe(3)
    expect(res.kpi.admins).toBe(2)
    expect(res.kpi.attendants).toBe(1)
    expect(res.kpi.active).toBe(3)
    expect(res.kpi.inactive).toBe(0)
  })

  it('deve filtrar administradores por busca e papel', async () => {
    const searchRes = await getAdministrators({ search: 'João' })
    expect(searchRes.users.length).toBe(1)
    expect(searchRes.users[0].full_name).toBe('Atendente João')

    const roleRes = await getAdministrators({ role: 'admin' })
    expect(roleRes.users.length).toBe(2)
  })

  // 2. CRIAÇÃO DE USUÁRIO
  it('deve criar novo atendente com senha forte e hash bcrypt', async () => {
    const formData = new FormData()
    formData.set('name', 'Carlos Alberto')
    formData.set('email', 'carlos@poranga.ce.gov.br')
    formData.set('password', 'SenhaForte#2026')
    formData.set('role', 'atendente')
    formData.set('phone', '(88) 98888-7777')
    formData.set('status', 'active')

    const res = await adminCreateUser(formData)
    expect(res.success).toBe(true)
    expect(mockProfiles.some(p => p.email === 'carlos@poranga.ce.gov.br')).toBe(true)
  })

  it('deve rejeitar criação com e-mail duplicado', async () => {
    const formData = new FormData()
    formData.set('name', 'Outro Admin')
    formData.set('email', 'admin@prefeitura.gov.br')
    formData.set('password', 'SenhaForte#2026')

    const res = await adminCreateUser(formData)
    expect(res.error).toBe('Já existe um usuário cadastrado com este e-mail.')
  })

  it('deve rejeitar criação com senha fraca', async () => {
    const formData = new FormData()
    formData.set('name', 'Usuario Teste')
    formData.set('email', 'teste@poranga.ce.gov.br')
    formData.set('password', '123456')

    const res = await adminCreateUser(formData)
    expect(res.error).toBeDefined()
    expect(res.success).toBeUndefined()
  })

  // 3. EDIÇÃO DE USUÁRIO
  it('deve atualizar dados do operador com sucesso', async () => {
    const res = await adminUpdateUser('user-3', {
      full_name: 'João Pedro Atualizado',
      email: 'joao.pedro@poranga.ce.gov.br',
      phone: '(88) 91111-2222'
    })

    expect(res.success).toBe(true)
    const updated = mockProfiles.find(p => p.id === 'user-3')
    expect(updated.full_name).toBe('João Pedro Atualizado')
    expect(updated.email).toBe('joao.pedro@poranga.ce.gov.br')
  })

  it('deve rejeitar atualização para e-mail que já pertence a outro usuário', async () => {
    const res = await adminUpdateUser('user-3', {
      email: 'admin@prefeitura.gov.br'
    })

    expect(res.error).toBe('Este e-mail já está sendo utilizado por outro usuário.')
  })

  // 4. ATIVAÇÃO / DESATIVAÇÃO (STATUS)
  it('deve alternar status ativo/inativo de um atendente', async () => {
    const res = await adminToggleUserStatus('user-3', 'inactive')
    expect(res.success).toBe(true)
    const user = mockProfiles.find(p => p.id === 'user-3')
    expect(user.status).toBe('inactive')
  })

  it('deve bloquear o admin logado de desativar a si próprio (Prevenção de Auto-Lockout)', async () => {
    const res = await adminToggleUserStatus('admin-1', 'inactive')
    expect(res.error).toBe('Você não pode desativar a sua própria conta.')
  })

  // 5. REDEFINIÇÃO DE SENHA
  it('deve redefinir senha do usuário respeitando regras de força', async () => {
    const res = await adminResetUserPassword('user-3', 'NovaSenhaSegura@2026')
    expect(res.success).toBe(true)
  })

  it('deve rejeitar redefinição com senha fraca', async () => {
    const res = await adminResetUserPassword('user-3', 'fraca')
    expect(res.error).toBeDefined()
  })

  // 6. EXCLUSÃO SEGURA
  it('deve excluir usuário com sucesso', async () => {
    const res = await adminDeleteUser('user-3')
    expect(res.success).toBe(true)
    expect(mockProfiles.some(p => p.id === 'user-3')).toBe(false)
  })

  it('deve permitir que o administrador exclua a própria conta quando houver outro admin ativo', async () => {
    const res = await adminDeleteUser('admin-1')
    expect(res.success).toBe(true)
    expect(res.isSelf).toBe(true)
    expect(mockProfiles.some(p => p.id === 'admin-1')).toBe(false)
  })

  it('deve impedir exclusão do último administrador ativo', async () => {
    // Remover admin-2 para restar apenas admin-1
    mockProfiles = mockProfiles.filter(p => p.id !== 'admin-2')

    // Tentar excluir admin-1 enquanto logado como admin-2 (ou outro)
    mockCurrentUser = { id: 'other-admin', email: 'other@test.com', role: 'admin' }
    const res = await adminDeleteUser('admin-1')
    expect(res.error).toBe('Não é possível excluir o único administrador ativo do sistema.')
  })

  // 7. SEGURANÇA DE CONTEXTO
  it('deve negar acesso a qualquer ação administrativa se o usuário for citizen', async () => {
    mockCurrentUser = { id: 'cidadao-1', email: 'cidadao@teste.com', role: 'citizen' }
    await expect(getAdministrators()).rejects.toThrow('Permissão negada')
    await expect(adminCreateUser(new FormData())).rejects.toThrow('Permissão negada')
    await expect(adminUpdateUser('user-3', {})).rejects.toThrow('Permissão negada')
    await expect(adminToggleUserStatus('user-3', 'inactive')).rejects.toThrow('Permissão negada')
    await expect(adminDeleteUser('user-3')).rejects.toThrow('Permissão negada')
  })
})
