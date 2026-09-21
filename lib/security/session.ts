import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE_NAME = 'app_session'

export const LEGACY_AUTH_COOKIES = [
  'auth_session',
  'auth_user_id',
  'auth_user_email',
  'auth_user_name',
  'auth_user_role'
] as const

export interface SessionPayload {
  sub: string
  role?: string
  email?: string
  full_name?: string
  exp?: number
  iat?: number
}

/**
 * Recupera o segredo de assinatura da sessão.
 * A validação ocorre estritamente no PRIMEIRO USO em runtime,
 * nunca no top-level do módulo (evitando falha em next build).
 */
export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        'SESSION_SECRET inválida: em ambiente de produção, a variável SESSION_SECRET deve estar definida e possuir no mínimo 32 caracteres.'
      )
    }
    return new TextEncoder().encode(secret.trim())
  }

  // Fallback seguro de desenvolvimento e ambiente de testes automatizados
  const effectiveSecret = (secret && secret.length >= 32) 
    ? secret 
    : 'desenvolvimento-session-secret-minimo-32-caracteres-seguros!'

  return new TextEncoder().encode(effectiveSecret)
}

/**
 * Cria token de sessão assinado contendo sub, role, email e exp via HS256
 */
export async function createSessionToken(
  userId: string,
  role?: string,
  email?: string,
  fullName?: string
): Promise<string> {
  const secret = getSessionSecret()
  const payload: Record<string, any> = { sub: userId }
  if (role) payload.role = role
  if (email) payload.email = email
  if (fullName) payload.full_name = fullName

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)
}

/**
 * Valida o token de sessão assinado.
 * Retorna o payload se válido ou null se adulterado/expirado/inválido.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') {
    return null
  }

  try {
    const secret = getSessionSecret()
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256']
    })

    if (!payload.sub || typeof payload.sub !== 'string') {
      return null
    }

    return {
      sub: payload.sub,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      full_name: typeof payload.full_name === 'string' ? payload.full_name : undefined,
      exp: payload.exp,
      iat: payload.iat
    }
  } catch {
    return null
  }
}

/**
 * Opções padronizadas e seguras para gravação do cookie de sessão
 */
export function getSessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 // 8 horas
  }
}
