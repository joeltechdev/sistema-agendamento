import { 
  adminCreateUser, 
  adminUpdateUser, 
  adminDeleteUser, 
  updateSystemSetting 
} from '@/app/actions/admin'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

let mockCurrentUser: { id: string; email: string; role: string } | null = null
let mockUserRoleInDb: string | null = null

interface MockQueryChain {
  select: jest.Mock
  eq: jest.Mock
  single: jest.Mock
  insert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
  upsert: jest.Mock
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: {
      getUser: jest.fn().mockImplementation(async () => {
        if (!mockCurrentUser) return { data: { user: null }, error: { message: 'Not authenticated' } }
        return { data: { user: mockCurrentUser }, error: null }
      })
    },
    from: jest.fn().mockImplementation((table: string) => {
      const chain: MockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(async () => {
          if (table === 'profiles' && mockCurrentUser) {
            return { 
              data: { 
                id: mockCurrentUser.id, 
                role: mockUserRoleInDb || mockCurrentUser.role,
                full_name: 'Usuario Teste',
                email: mockCurrentUser.email 
              }, 
              error: null 
            }
          }
          return { data: null, error: null }
        }),
        insert: jest.fn().mockImplementation(async () => ({ data: [], error: null })),
        update: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(async () => ({ data: [], error: null }))
        })),
        delete: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockImplementation(async () => ({ data: [], error: null }))
        })),
        upsert: jest.fn().mockImplementation(async () => ({ error: null }))
      }
      return chain
    })
  }))
}))

describe('ETAPA E.2: Matriz de Autorização Rigorosa (RBAC Estrito)', () => {
  beforeEach(() => {
    mockCurrentUser = null
    mockUserRoleInDb = null
  })

  // 1. ATENDENTE TENTANDO AÇÕES ESTRITAS DE ADMIN
  describe('Atendente tentando executar ações de gestão administrativa', () => {
    beforeEach(() => {
      mockCurrentUser = { id: 'atendente-1', email: 'atendente@poranga.ce.gov.br', role: 'atendente' }
      mockUserRoleInDb = 'atendente'
    })

    it('Atendente chamando adminCreateUser deve ser rejeitado', async () => {
      const formData = new FormData()
      formData.set('name', 'Novo Admin')
      formData.set('email', 'novoadmin@poranga.ce.gov.br')
      formData.set('role', 'admin')
      formData.set('password', 'SenhaForte#2026')

      await expect(adminCreateUser(formData)).rejects.toThrow(/Permissão negada/i)
    })

    it('Atendente chamando adminUpdateUser deve ser rejeitado', async () => {
      await expect(adminUpdateUser('alvo-1', { full_name: 'Novo Nome' })).rejects.toThrow(/Permissão negada/i)
    })

    it('Atendente chamando adminDeleteUser deve ser rejeitado', async () => {
      await expect(adminDeleteUser('alvo-1')).rejects.toThrow(/Permissão negada/i)
    })

    it('Atendente chamando updateSystemSetting deve ser rejeitado', async () => {
      await expect(updateSystemSetting('monthly_limit', '300', 'desc')).rejects.toThrow(/Permissão negada/i)
    })
  })

  // 2. CIDADÃO TENTANDO AÇÕES ESTRITAS DE ADMIN
  describe('Cidadão tentando executar ações de gestão administrativa', () => {
    beforeEach(() => {
      mockCurrentUser = { id: 'cidadao-1', email: 'cidadao@gmail.com', role: 'citizen' }
      mockUserRoleInDb = 'citizen'
    })

    it('Cidadão chamando adminCreateUser deve ser rejeitado', async () => {
      await expect(adminCreateUser(new FormData())).rejects.toThrow(/Permissão negada/i)
    })

    it('Cidadão chamando adminUpdateUser deve ser rejeitado', async () => {
      await expect(adminUpdateUser('alvo-1', {})).rejects.toThrow(/Permissão negada/i)
    })

    it('Cidadão chamando adminDeleteUser deve ser rejeitado', async () => {
      await expect(adminDeleteUser('alvo-1')).rejects.toThrow(/Permissão negada/i)
    })

    it('Cidadão chamando updateSystemSetting deve ser rejeitado', async () => {
      await expect(updateSystemSetting('monthly_limit', '300', 'desc')).rejects.toThrow(/Permissão negada/i)
    })
  })

  // 3. REQUISIÇÃO SEM SESSÃO
  describe('Requisição sem sessão tentando executar ações de gestão', () => {
    beforeEach(() => {
      mockCurrentUser = null
      mockUserRoleInDb = null
    })

    it('Sem sessão chamando adminCreateUser deve falhar', async () => {
      await expect(adminCreateUser(new FormData())).rejects.toThrow(/Não autenticado/i)
    })

    it('Sem sessão chamando updateSystemSetting deve falhar', async () => {
      await expect(updateSystemSetting('monthly_limit', '300', 'desc')).rejects.toThrow(/Não autenticado/i)
    })
  })

  // 4. ADMINISTRADOR AUTORIZADO
  describe('Administrador autorizado executando ações de gestão', () => {
    beforeEach(() => {
      mockCurrentUser = { id: 'admin-1', email: 'admin@prefeitura.gov.br', role: 'admin' }
      mockUserRoleInDb = 'admin'
    })

    it('Admin chamando updateSystemSetting deve ser aprovado com sucesso', async () => {
      const result = await updateSystemSetting('monthly_limit', '250', 'desc')
      expect(result.success).toBe(true)
    })
  })
})
