import { getDashboardMetrics, adminConfirmAttendance } from '@/app/actions/admin'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

function getTodayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const mockDbAppointments: any[] = [
  {
    id: 'apt-1',
    appointment_date: getTodayString(),
    appointment_time: '08:00:00',
    status: 'completed',
    appointment_type: 'first_issue'
  },
  {
    id: 'apt-2',
    appointment_date: getTodayString(),
    appointment_time: '08:30:00',
    status: 'completed',
    appointment_type: 'second_issue'
  },
  {
    id: 'apt-3',
    appointment_date: getTodayString(),
    appointment_time: '09:00:00',
    status: 'confirmed',
    appointment_type: 'first_issue'
  }
]

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockImplementation(async () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } } })
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
        }
      }
      if (table === 'system_settings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { value: '200' }, error: null })
        }
      }
      if (table === 'appointments') {
        return {
          select: jest.fn().mockImplementation((_cols, opts) => {
            if (opts?.head) {
              const queryObj: any = {
                _date: null,
                _statusEq: null,
                _statusNeq: null,
                eq(field: string, val: any) {
                  if (field === 'appointment_date') this._date = val
                  if (field === 'status') this._statusEq = val
                  return this
                },
                neq(field: string, val: any) {
                  if (field === 'status') this._statusNeq = val
                  return this
                },
                gte: jest.fn().mockReturnThis(),
                then(resolve: any) {
                  let filtered = mockDbAppointments
                  if (this._date) filtered = filtered.filter(a => a.appointment_date === this._date)
                  if (this._statusEq) filtered = filtered.filter(a => a.status === this._statusEq)
                  if (this._statusNeq) filtered = filtered.filter(a => a.status !== this._statusNeq)
                  return resolve({ count: filtered.length, error: null })
                }
              }
              return queryObj
            }
            return {
              neq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({ data: mockDbAppointments, error: null })
            }
          })
        }
      }
      return {}
    })
  }))
}))

describe('Dashboard Metrics - Atendimentos Concluídos e Vias RG', () => {
  it('deve contabilizar corretamente os atendimentos concluídos do dia no card do painel', async () => {
    const metrics = await getDashboardMetrics()

    // 2 atendimentos com status 'completed' hoje
    expect(metrics.completedAppointments).toBe(2)

    // Agendamentos totais ativos de hoje (2 concluídos + 1 confirmado = 3)
    expect(metrics.dailyAppointments).toBe(3)

    // Demais métricas inalteradas
    expect(metrics.limit).toBe(200)
    expect(metrics.restantes).toBe(197)
  })

  it('deve contabilizar corretamente 1ª Via e 2ª Via de RG separadamente', async () => {
    const metrics = await getDashboardMetrics()

    // mockDbAppointments has 2 first_issue (apt-1, apt-3) and 1 second_issue (apt-2)
    expect(metrics.firstIssueCount).toBe(2)
    expect(metrics.secondIssueCount).toBe(1)
    expect(metrics.dailyFirstIssue).toBe(2)
    expect(metrics.dailySecondIssue).toBe(1)
    expect(metrics.completedFirstIssue).toBe(1)
    expect(metrics.completedSecondIssue).toBe(1)
  })
})
