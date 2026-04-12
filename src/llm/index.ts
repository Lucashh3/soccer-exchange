import { generateReport as openaiGenerate } from './openai'
import { generateReport as deepseekGenerate } from './deepseek'
import { generateReport as claudeGenerate } from './claude'

// Error codes/messages that indicate a quota/billing failure
function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('insufficient_quota') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('billing') ||
    (msg.includes('429') && msg.includes('openai'))
  )
}

export async function generateReport(prompt: string): Promise<string> {
  // 1. OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await openaiGenerate(prompt)
      if (result) return result
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn('[llm] OpenAI quota exceeded, trying DeepSeek')
      } else {
        console.error('[llm] OpenAI error:', err instanceof Error ? err.message : err)
      }
    }
  }

  // 2. DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      console.log('[llm] Using DeepSeek')
      return await deepseekGenerate(prompt)
    } catch (err) {
      console.error('[llm] DeepSeek error:', err instanceof Error ? err.message : err)
    }
  }

  // 3. Claude (fallback final)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[llm] Using Claude as fallback')
      return await claudeGenerate(prompt)
    } catch (err) {
      console.error('[llm] Claude error:', err instanceof Error ? err.message : err)
    }
  }

  return ''
}
