import OpenAI from 'openai'

// DeepSeek exposes an OpenAI-compatible API
const MODEL = 'deepseek-chat'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseURL: 'https://api.deepseek.com/v1',
    })
  }
  return client
}

export async function generateReport(prompt: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 700,
    messages: [
      { role: 'system', content: 'Você é um analista profissional de apostas em futebol.' },
      { role: 'user', content: prompt },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) throw new Error('[deepseek] empty response')
  return text
}
