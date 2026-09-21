import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/security/session'
import { getMockStore } from '@/lib/supabase/server'
import { adminDeleteAppointment } from '@/app/actions/admin'
import { createBooking } from '@/app/actions/booking'
import { cookies } from 'next/headers'

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

describe('Persistência de Exclusão de Agendamentos (Bug Fix: Registro não deve voltar ao atualizar)', () => {
  const adminId = 'admin-delete-test-user'
  const attendantId = 'attendant-delete-test-user'
  const mockCookiesStore: Record<string, string> = {}

  beforeAll(async () => {
    const store = getMockStore()
    
    // Configura admin no mock store
    if (!store.profiles.find((p: any) => p.id === adminId)) {
      store.profiles.push({
        id: adminId,
        full_name: 'Administrador Geral',
        email: 'admin.delete@prefeitura.gov.br',
        role: 'admin',
        status: 'active'
      })
    }

    // Configura atendente no mock store
    if (!store.profiles.find((p: any) => p.id === attendantId)) {
      store.profiles.push({
        id: attendantId,
        full_name: 'Atendente Silva',
        email: 'silva.atendente@prefeitura.gov.br',
        role: 'atendente',
        status: 'active'
      })
    }

    (cookies as unknown as jest.Mock).mockResolvedValue({
      get: (name: string) => (mockCookiesStore[name] ? { name, value: mockCookiesStore[name] } : undefined),
      set: (name: string, value: string) => { mockCookiesStore[name] = value },
      delete: (name: string) => { delete mockCookiesStore[name] }
    })
  })

  it('1. Deve excluir permanentemente um agendamento sem que ele reapareça após recarga (F5 / getMockStore)', async () => {
    // 1. Cria agendamento de teste
    const formData = new FormData()
    formData.append('service_id', '00000000-0000-0000-0000-000000000001')
    formData.append('appointment_date', '2026-09-22')
    formData.append('appointment_time', '11:00')
    formData.append('appointment_type', 'first_issue')
    formData.append('tipo', 'first_issue')
    formData.append('full_name', 'Cidadão Teste Delete')
    formData.append('phone', '(88) 99999-1111')
    formData.append('sexo', 'Masculino')

    const createRes = await createBooking(undefined, formData)
    expect(createRes?.success).toBe(true)
    const protocol = createRes?.protocol

    const store = getMockStore()
    const createdApt = store.appointments.find((a: any) => a.protocol_number === protocol)
    expect(createdApt).toBeDefined()
    const aptId = createdApt.id

    // 2. Autentica como Admin e executa exclusão
    const token = await createSessionToken(adminId)
    mockCookiesStore[SESSION_COOKIE_NAME] = token

    const deleteRes = await adminDeleteAppointment(aptId)
    expect(deleteRes.success).toBe(true)

    // 3. Verifica que foi removido do mock store
    const aptAfterDelete = store.appointments.find((a: any) => a.id === aptId)
    expect(aptAfterDelete).toBeUndefined()

    // 4. Simula recarga de página (F5): busca do mock store / query
    const freshStore = getMockStore()
    const aptInFreshStore = freshStore.appointments.find((a: any) => a.id === aptId || a.protocol_number === protocol)
    expect(aptInFreshStore).toBeUndefined()
  })

  it('2. Atendente autenticado também deve conseguir excluir agendamento na gestão de atendimentos', async () => {
    // 1. Cria agendamento de teste
    const formData = new FormData()
    formData.append('service_id', '00000000-0000-0000-0000-000000000001')
    formData.append('appointment_date', '2026-09-23')
    formData.append('appointment_time', '14:00')
    formData.append('appointment_type', 'second_issue')
    formData.append('tipo', 'second_issue')
    formData.append('full_name', 'Cidadão Teste Atendente Delete')
    formData.append('phone', '(88) 99999-2222')
    formData.append('sexo', 'Feminino')

    const createRes = await createBooking(undefined, formData)
    expect(createRes?.success).toBe(true)
    const protocol = createRes?.protocol

    const store = getMockStore()
    const createdApt = store.appointments.find((a: any) => a.protocol_number === protocol)
    expect(createdApt).toBeDefined()
    const aptId = createdApt.id

    // 2. Autentica como Atendente
    const token = await createSessionToken(attendantId)
    mockCookiesStore[SESSION_COOKIE_NAME] = token

    const deleteRes = await adminDeleteAppointment(aptId)
    expect(deleteRes.success).toBe(true)

    // 3. Simula recarga de página (F5)
    const freshStore = getMockStore()
    const aptInFreshStore = freshStore.appointments.find((a: any) => a.id === aptId)
    expect(aptInFreshStore).toBeUndefined()
  })
})
