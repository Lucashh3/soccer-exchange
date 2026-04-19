import OpenAI from 'openai'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 10_000

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
    })
  }
  return client
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function is429(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 429
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('429') || msg.includes('limit_rpm') || msg.includes('rate limit')
  }
  return false
}

export async function generateReport(prompt: string, model?: string): Promise<string> {
  const selectedModel = model ?? process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free'

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: selectedModel,
        max_tokens: 700,
        messages: [
          { role: 'system', content: 'Você é um analista profissional de apostas em futebol.' },
          { role: 'user', content: prompt },
        ],
      })
      return response.choices[0]?.message?.content ?? ''
    } catch (err) {
      if (is429(err) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * (attempt + 1)
        console.warn(`[openrouter] 429 rate limit, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`)
        await sleep(delay)
        continue
      }
      throw err
    }
  }

  return ''
}
