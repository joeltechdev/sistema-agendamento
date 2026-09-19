import { generateETag, isNotModified } from '@/lib/http/etag'

describe('ETag & HTTP 304 Caching Optimization', () => {
  it('1. Deve gerar ETag consistente para o mesmo payload', () => {
    const payloadA = { metrics: { dailyAppointments: 10 }, timestamp: '2026-09-18' }
    const payloadB = { metrics: { dailyAppointments: 10 }, timestamp: '2026-09-18' }

    const etagA = generateETag(payloadA)
    const etagB = generateETag(payloadB)

    expect(etagA).toBe(etagB)
    expect(etagA.startsWith('W/"')).toBe(true)
  })

  it('2. Deve gerar ETags diferentes quando houver mutação nos dados', () => {
    const payloadBefore = { metrics: { dailyAppointments: 10 } }
    const payloadAfter = { metrics: { dailyAppointments: 11 } }

    const etagBefore = generateETag(payloadBefore)
    const etagAfter = generateETag(payloadAfter)

    expect(etagBefore).not.toBe(etagAfter)
  })

  it('3. Deve identificar corretamente se os dados NÃO foram modificados (isNotModified === true)', () => {
    const etag = 'W/"abc12345"'

    // Requisição com If-None-Match idêntico
    const reqMatching = new Request('http://localhost:3000/api/admin/metrics', {
      headers: { 'if-none-match': 'W/"abc12345"' }
    })
    expect(isNotModified(reqMatching, etag)).toBe(true)

    // Requisição sem prefixo fraco
    const reqStripped = new Request('http://localhost:3000/api/admin/metrics', {
      headers: { 'if-none-match': '"abc12345"' }
    })
    expect(isNotModified(reqStripped, etag)).toBe(true)

    // Wildcard
    const reqWildcard = new Request('http://localhost:3000/api/admin/metrics', {
      headers: { 'if-none-match': '*' }
    })
    expect(isNotModified(reqWildcard, etag)).toBe(true)
  })

  it('4. Deve identificar quando os dados foram modificados (isNotModified === false)', () => {
    const currentEtag = 'W/"def67890"'

    const reqOutdated = new Request('http://localhost:3000/api/admin/metrics', {
      headers: { 'if-none-match': 'W/"abc12345"' }
    })
    expect(isNotModified(reqOutdated, currentEtag)).toBe(false)

    const reqNoHeader = new Request('http://localhost:3000/api/admin/metrics')
    expect(isNotModified(reqNoHeader, currentEtag)).toBe(false)
  })
})
