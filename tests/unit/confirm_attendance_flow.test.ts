import { createClient } from '@/lib/supabase/server'
import { adminConfirmAttendance, getDashboardMetrics, getCompletedAppointments } from '@/app/actions/admin'
import { createSessionToken } from '@/lib/security/session'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

let adminSessionToken: string

beforeAll(async () => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'chave-secreta-de-teste-com-32-caracteres-min'
  adminSessionToken = await createSessionToken('test')
})

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockImplementation(async () => ({
    get: (key: string) => {
      if (key === 'app_session') return { value: adminSessionToken }
      return undefined
    },
    set: jest.fn(),
    delete: jest.fn()
  }))
}))

describe('Real Flow of Confirm Attendance and Status Reflection', () => {
  it('should update the appointment in global mockData and reflect in queries', async () => {
    const supabase = await createClient()
    
    // 1. Get initial appointments
    const { data: initialApts } = await supabase
      .from('appointments')
      .select('*')
    
    expect(initialApts).toBeDefined()
    expect(initialApts.length).toBeGreaterThan(0)
    
    const targetApt = initialApts[0]
    console.log('Target appointment before update:', targetApt.id, targetApt.status)
    
    // 2. Execute adminConfirmAttendance
    const res = await adminConfirmAttendance(targetApt.id)
    console.log('adminConfirmAttendance result:', res)
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('completed')
    
    // 3. Query appointments again via fresh client
    const freshSupabase = await createClient()
    const { data: updatedApts } = await freshSupabase
      .from('appointments')
      .select('*')
    
    const found = updatedApts.find((a: any) => a.id === targetApt.id)
    console.log('Target appointment after update in DB:', found?.id, found?.status)
    expect(found?.status).toBe('completed')
    
    // 4. Check completed appointments count
    const completedList = updatedApts.filter((a: any) => a.status === 'completed')
    console.log('Completed appointments count:', completedList.length)
    expect(completedList.length).toBeGreaterThanOrEqual(1)
  })

  it('should persist completed status across full process/worker restart (F5 simulation)', async () => {
    // 1. Clear in-memory global state to simulate a new SSR process/worker on F5
    delete (globalThis as any).__schedulingMockData__

    // 2. Load from disk via fresh createClient
    const ssrSupabase = await createClient()
    const { data: ssrAppointments } = await ssrSupabase
      .from('appointments')
      .select('*')

    const completed = ssrAppointments.filter((a: any) => a.status === 'completed')
    expect(completed.length).toBeGreaterThanOrEqual(1)

    // 3. Verify getCompletedAppointments action also returns completed items
    const completedList = await getCompletedAppointments()
    expect(completedList.length).toBeGreaterThanOrEqual(1)
  })
})
