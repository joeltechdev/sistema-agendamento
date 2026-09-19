import { NextRequest, NextResponse } from 'next/server'
import { getDashboardMetrics, getCompletedAppointments } from '@/app/actions/admin'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { generateETag, isNotModified } from '@/lib/http/etag'

export const dynamic = 'force-dynamic'

/**
 * BFF Aggregator Endpoint for Global State Synchronization
 * Supports Rate Limiting (1 request / 3s per client), ETag, and HTTP 304 Not Modified.
 */
export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req)
    const rateLimitKey = `sync:${clientIp}`

    // 1. Rate Limiting Check (1 request every 3 seconds)
    const rateLimitResult = checkRateLimit(rateLimitKey, {
      windowMs: 3000,
      maxRequests: 1
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Limite de sincronização global excedido. Por favor, aguarde alguns segundos.',
          retryAfter: rateLimitResult.retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfterSeconds),
            'Cache-Control': 'no-store'
          }
        }
      )
    }

    // 2. Extract Query Parameters
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const completedDate = searchParams.get('completedDate') || undefined

    // 3. Consolidated Parallel Data Fetching
    const [metrics, completedAppointments] = await Promise.all([
      getDashboardMetrics(startDate, endDate),
      getCompletedAppointments(completedDate)
    ])

    // 4. ETag & HTTP 304 Optimization (calculated on data state)
    const etag = generateETag({ metrics, completedAppointments })

    if (isNotModified(req, etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, no-cache',
          'Access-Control-Expose-Headers': 'ETag, Retry-After'
        }
      })
    }

    const syncPayload = {
      metrics,
      completedAppointments,
      systemStatus: {
        status: 'online',
        database: 'connected',
        syncedAt: new Date().toISOString()
      }
    }

    // 5. Success 200 OK Response
    return NextResponse.json(syncPayload, {
      status: 200,
      headers: {
        'ETag': etag,
        'Cache-Control': 'private, no-cache',
        'Access-Control-Expose-Headers': 'ETag, Retry-After'
      }
    })
  } catch (error: any) {
    console.error('Erro no endpoint agregador de sincronização:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao sincronizar estado do sistema' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
