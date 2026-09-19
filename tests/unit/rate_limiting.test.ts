import { checkRateLimit, rateLimit, getClientIp } from '@/lib/rateLimit'

describe('Rate Limiting & Abuse Prevention', () => {
  const testKey = 'test-client-ip-123'

  beforeEach(() => {
    // Reset timer / state if needed
  })

  it('1. Deve permitir a primeira requisição e decrementar o remaining', () => {
    const key = `ip-allow-${Date.now()}`
    const res = checkRateLimit(key, { windowMs: 3000, maxRequests: 1 })
    expect(res.success).toBe(true)
    expect(res.remaining).toBe(0)
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1)
  })

  it('2. Deve bloquear requisições consecutivas dentro da janela de 3 segundos (429 Too Many Requests)', () => {
    const key = `ip-block-${Date.now()}`
    
    // 1ª Requisição -> Permitida
    const first = checkRateLimit(key, { windowMs: 3000, maxRequests: 1 })
    expect(first.success).toBe(true)

    // 2ª Requisição imediata -> Bloqueada
    const second = checkRateLimit(key, { windowMs: 3000, maxRequests: 1 })
    expect(second.success).toBe(false)
    expect(second.remaining).toBe(0)
    expect(second.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(second.retryAfterSeconds).toBeLessThanOrEqual(3)
  })

  it('3. Deve manter compatibilidade com a função legada rateLimit()', () => {
    const key = `legacy-${Date.now()}`
    expect(rateLimit(key, 2, 5000)).toBe(true)
    expect(rateLimit(key, 2, 5000)).toBe(true)
    expect(rateLimit(key, 2, 5000)).toBe(false)
  })

  it('4. Deve extrair IP corretamente dos headers da requisição', () => {
    const reqWithForwarded = new Request('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' }
    })
    expect(getClientIp(reqWithForwarded)).toBe('203.0.113.195')

    const reqWithRealIp = new Request('http://localhost:3000/api/system/sync-state', {
      headers: { 'x-real-ip': '198.51.100.22' }
    })
    expect(getClientIp(reqWithRealIp)).toBe('198.51.100.22')

    const reqDefault = new Request('http://localhost:3000/api/system/sync-state')
    expect(getClientIp(reqDefault)).toBe('127.0.0.1')
  })
})
