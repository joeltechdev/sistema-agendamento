import { getDashboardMetrics } from '@/app/actions/admin'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { generateETag, isNotModified } from '@/lib/http/etag'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req)
    const rateLimitResult = checkRateLimit(`metrics:${clientIp}`, {
      windowMs: 2000,
      maxRequests: 1
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Muitas requisições de atualização. Aguarde um momento.',
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

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const metrics = await getDashboardMetrics(startDate, endDate)

    const etag = generateETag(metrics)
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

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'ETag': etag,
        'Cache-Control': 'private, no-cache',
        'Access-Control-Expose-Headers': 'ETag, Retry-After'
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar métricas' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
