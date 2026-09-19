/**
 * Rate Limiter simples em memória (Sliding Window)
 * Protege contra ataques de força bruta e spam em endpoints sensíveis de autenticação.
 */

interface RateLimitRecord {
  count: number
  firstRequestTime: number
}

const memoryStore = new Map<string, RateLimitRecord>()

// Limpeza automática periódica de chaves expiradas a cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of memoryStore.entries()) {
      if (now - record.firstRequestTime > 30 * 60 * 1000) {
        memoryStore.delete(key)
      }
    }
  }, 10 * 60 * 1000).unref?.()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Verifica se a requisição está dentro do limite permitido
 * @param key Identificador único (ex: IP + Ação ou Email + Ação)
 * @param maxAttempts Número máximo de tentativas (padrão: 5)
 * @param windowMs Janela de tempo em milissegundos (padrão: 15 minutos = 900.000 ms)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now()
  const record = memoryStore.get(key)

  if (!record || now - record.firstRequestTime > windowMs) {
    // Nova janela
    memoryStore.set(key, {
      count: 1,
      firstRequestTime: now
    })
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetInSeconds: Math.ceil(windowMs / 1000)
    }
  }

  if (record.count >= maxAttempts) {
    const timePassed = now - record.firstRequestTime
    const timeLeftMs = Math.max(0, windowMs - timePassed)
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil(timeLeftMs / 1000)
    }
  }

  record.count += 1
  const timePassed = now - record.firstRequestTime
  const timeLeftMs = Math.max(0, windowMs - timePassed)

  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetInSeconds: Math.ceil(timeLeftMs / 1000)
  }
}

/**
 * Reseta o contador para uma chave específica (ex: após login bem-sucedido)
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key)
}
