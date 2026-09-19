// In-memory rate limiter with sliding window and customizable options.
// For multi-instance Edge/Serverless deployments, Redis is recommended.

export type RateLimitOptions = {
  windowMs?: number
  maxRequests?: number
}

export type RateLimitResult = {
  success: boolean
  remaining: number
  resetTime: number
  retryAfterSeconds: number
}

type RateLimitRecord = {
  count: number
  resetTime: number
}

const store = new Map<string, RateLimitRecord>()

// Clean up expired keys periodically to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key)
      }
    }
  }, 60000).unref?.()
}

/**
 * Detailed Rate Limiter check
 * @param key Unique identifier (IP, user ID, route key)
 * @param options windowMs (default 3000ms) and maxRequests (default 1)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? 3000
  const maxRequests = options.maxRequests ?? 1
  const now = Date.now()

  const record = store.get(key)

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs
    }
    store.set(key, newRecord)
    return {
      success: true,
      remaining: Math.max(0, maxRequests - 1),
      resetTime: newRecord.resetTime,
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    }
  }

  if (record.count >= maxRequests) {
    const remainingMs = Math.max(0, record.resetTime - now)
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000))
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfterSeconds
    }
  }

  record.count += 1
  return {
    success: true,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
    retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
  }
}

/**
 * Legacy wrapper for simple boolean rate limiting
 */
export function rateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const result = checkRateLimit(key, { maxRequests, windowMs })
  return result.success
}

/**
 * Extracts client IP or fallback identifier from NextRequest / Request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp.trim()
  }
  return '127.0.0.1'
}
