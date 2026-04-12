import OpenAI from 'openai'

const MODEL = 'gpt-4o'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function generateReport(prompt: string): Promise<string> {
  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 700,
      messages: [
        { role: 'system', content: 'Você é um analista profissional de apostas em futebol.' },
        { role: 'user', content: prompt },
      ],
    })

    const text = response.choices[0]?.message?.content
    if (!text) {
      console.error('[openai] empty response')
      return ''
    }

    return text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[openai] error generating report: ${msg}`)
    return ''
  }
}