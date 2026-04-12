import { generateReport as openaiGenerate } from './openai'
import { generateReport as deepseekGenerate } from './deepseek'

// Error codes/messages that indicate OpenAI is out of credits
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  // OpenAI quota exceeded → status 429 with code insufficient_quota
  return (
    msg.includes('insufficient_quota') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('billing') ||
    (msg.includes('429') && msg.includes('openai'))
  )
}

export async function generateReport(prompt: string): Promise<string> {
  // Try OpenAI first (only if API key is configured)
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await openaiGenerate(prompt)
      if (result) return result
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn('[llm] OpenAI quota exceeded, falling back to DeepSeek')
      } else {
        console.error('[llm] OpenAI error:', err instanceof Error ? err.message : err)
      }
    }
  }

  // Fallback: DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      console.log('[llm] Using DeepSeek')
      return await deepseekGenerate(prompt)
    } catch (err) {
      console.error('[llm] DeepSeek error:', err instanceof Error ? err.message : err)
    }
  }

  return ''
}
