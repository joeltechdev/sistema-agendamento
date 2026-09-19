import crypto from 'crypto'

/**
 * Generates a deterministic weak ETag for any JSON serializable payload
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 16)
  return `W/"${hash}"`
}

/**
 * Checks if the request's If-None-Match header matches the provided ETag
 */
export function isNotModified(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers.get('if-none-match')
  if (!ifNoneMatch) return false

  // Handle direct match, wildcard, or weak match
  const cleanIfNoneMatch = ifNoneMatch.trim()
  const cleanETag = etag.trim()

  if (cleanIfNoneMatch === '*' || cleanIfNoneMatch === cleanETag) {
    return true
  }

  // Handle weak comparison (W/"..." vs "...")
  const strippedClient = cleanIfNoneMatch.replace(/^W\//, '')
  const strippedServer = cleanETag.replace(/^W\//, '')

  return strippedClient === strippedServer
}
