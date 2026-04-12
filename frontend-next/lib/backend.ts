/**
 * Helpers para chamadas server-side ao backend Express.
 * Injeta automaticamente a API key quando INTERNAL_API_KEY estiver configurada.
 */

export function backendHeaders(): HeadersInit {
  const key = process.env.INTERNAL_API_KEY
  return key ? { 'x-api-key': key } : {}
}
