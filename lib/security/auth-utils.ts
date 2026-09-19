import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Valida a força da senha de acordo com os padrões de segurança:
 * - Mínimo de 8 caracteres
 * - Pelo menos uma letra maiúscula ([A-Z])
 * - Pelo menos uma letra minúscula ([a-z])
 * - Pelo menos um número ([0-9]) ou caractere especial/símbolo
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['A senha é obrigatória.'] }
  }

  if (password.length < 8) {
    errors.push('A senha deve conter no mínimo 8 caracteres.')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula.')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula.')
  }
  if (!/[0-9\W_]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número ou símbolo.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Valida formato de e-mail usando expressão regular compatível com RFC 5322
 */
export function validateEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(trimmed)
}

/**
 * Sanitiza entradas de texto para prevenir XSS e injeção
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove tags html básicas
}

/**
 * Formata um nome de exibição amigável a partir do e-mail quando o nome completo não foi informado
 * Exemplo: 'joao.silva@prefeitura.gov.br' -> 'João Silva'
 */
export function formatNameFromEmail(email: string): string {
  if (!email || typeof email !== 'string') return 'Administrador'
  const username = email.split('@')[0]
  if (!username) return 'Administrador'
  const formatted = username
    .split(/[._-]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  return formatted || 'Administrador'
}

/**
 * Gera hash de senha utilizando bcrypt com salt rounds configurável (padrão 12)
 */
export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return bcrypt.hash(password, rounds)
}

/**
 * Verifica se uma senha em texto plano coincide com o hash bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Gera token criptográfico seguro em formato hexadecimal
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Gera hash SHA-256 de um token para armazenamento seguro
 */
export function hashTokenSha256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
