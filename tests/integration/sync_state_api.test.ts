import { GET as syncStateGET } from '@/app/api/system/sync-state/route'
import { GET as metricsGET } from '@/app/api/admin/metrics/route'
import { NextRequest } from 'next/server'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}))

jest.mock('@/lib/supabase/server', () => {
  return {
    createClient: jest.fn().mockImplementation(async () => {
      return {
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
            const chain: any = {
              eq: jest.fn().mockReturnThis(),
              neq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'apt-1',
                    protocol_number: 'RG-2026-001',
                    appointment_date: '2026-09-18',
                    appointment_time: '08:00:00',
                    status: 'confirmed',
                    full_name: 'Maria Silva'
                  }
                ],
                error: null
              }),
              then: (resolve: any) => resolve({ count: 5, data: [], error: null })
            }
            return {
              select: jest.fn().mockImplementation((cols: string, opts?: any) => {
                if (opts?.head) {
                  return chain
                }
                return chain
              }),
              eq: jest.fn().mockReturnValue(chain),
              neq: jest.fn().mockReturnValue(chain)
            }
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis()
          }
        })
      }
    })
  }
})

describe('BFF Aggregator & Global State Sync API', () => {
  it('1. GET /api/system/sync-state deve retornar estado consolidado com ETag e 200 OK', async () => {
    const req = new NextRequest('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-forwarded-for': '10.0.0.1' }
    })

    const res = await syncStateGET(req)
    expect(res.status).toBe(200)

    const etag = res.headers.get('ETag')
    expect(etag).toBeDefined()
    expect(etag?.startsWith('W/"')).toBe(true)

    const body = await res.json()
    expect(body.metrics).toBeDefined()
    expect(body.completedAppointments).toBeDefined()
    expect(body.systemStatus).toBeDefined()
    expect(body.systemStatus.status).toBe('online')
  })

  it('2. GET /api/system/sync-state deve retornar HTTP 304 Not Modified se o ETag corresponder', async () => {
    // 1ª Chamada para obter ETag
    const req1 = new NextRequest('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-forwarded-for': '10.0.0.2' }
    })
    const res1 = await syncStateGET(req1)
    const etag = res1.headers.get('ETag')!

    // 2ª Chamada com If-None-Match e IP diferente para não cair no rate limit de 3s
    const req2 = new NextRequest('http://localhost:3000/api/system/sync-state', {
      headers: {
        'x-forwarded-for': '10.0.0.3',
        'if-none-match': etag
      }
    })
    const res2 = await syncStateGET(req2)
    expect(res2.status).toBe(304)
  })

  it('3. Deve acionar Rate Limiting (429 Too Many Requests) em caso de cliques repetidos em menos de 3s', async () => {
    const clientIp = '10.0.0.99'

    // 1ª Chamada -> OK
    const req1 = new NextRequest('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-forwarded-for': clientIp }
    })
    const res1 = await syncStateGET(req1)
    expect(res1.status).toBe(200)

    // 2ª Chamada imediata pelo mesmo cliente -> 429
    const req2 = new NextRequest('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-forwarded-for': clientIp }
    })
    const res2 = await syncStateGET(req2)
    expect(res2.status).toBe(429)

    const body = await res2.json()
    expect(body.error).toContain('Limite de sincronização')
    expect(res2.headers.get('Retry-After')).toBeDefined()
  })
})
