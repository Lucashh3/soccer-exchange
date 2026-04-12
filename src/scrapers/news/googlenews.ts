import axios from 'axios'
import * as cheerio from 'cheerio'
import type { NewsItem } from '../../types/index'

/**
 * Detect the best locale for Google News RSS based on country/league context.
 * Falls back to English (global) if unknown.
 */
function getLocale(country: string): { hl: string; gl: string; ceid: string } {
  const c = country.toLowerCase()
  if (c.includes('brazil') || c.includes('brasil')) return { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' }
  if (c.includes('spain') || c.includes('espanha') || c.includes('españa')) return { hl: 'es', gl: 'ES', ceid: 'ES:es' }
  if (c.includes('england') || c.includes('inglaterra')) return { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }
  if (c.includes('italy') || c.includes('itália')) return { hl: 'it', gl: 'IT', ceid: 'IT:it' }
  if (c.includes('germany') || c.includes('alemanha')) return { hl: 'de', gl: 'DE', ceid: 'DE:de' }
  if (c.includes('france') || c.includes('frança')) return { hl: 'fr', gl: 'FR', ceid: 'FR:fr' }
  if (c.includes('portugal')) return { hl: 'pt-PT', gl: 'PT', ceid: 'PT:pt-150' }
  if (c.includes('argentina')) return { hl: 'es-419', gl: 'AR', ceid: 'AR:es-419' }
  return { hl: 'en', gl: 'US', ceid: 'US:en' }
}

export async function scrapeGoogleNews(
  homeTeam: string,
  awayTeam: string,
  country = ''
): Promise<NewsItem[]> {
  try {
    const { hl, gl, ceid } = getLocale(country)
    const query = encodeURIComponent(`${homeTeam} ${awayTeam}`)
    const url = `https://news.google.com/rss/search?q=${query}&hl=${hl}&gl=${gl}&ceid=${ceid}`

    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const $ = cheerio.load(response.data, { xmlMode: true })
    const news: NewsItem[] = []

    $('item').each((_i, el) => {
      const title = $(el).find('title').text().trim()
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim()
      const pubDate = $(el).find('pubDate').text().trim()
      const source = $(el).find('source').text().trim()
      const description = $(el).find('description').text().replace(/<[^>]+>/g, '').trim()

      if (title) {
        news.push({
          id: 0,
          source: source || 'Google News',
          title,
          summary: description || undefined,
          url: link || undefined,
          publishedAt: pubDate || undefined,
        })
      }
    })

    return news.slice(0, 8)
  } catch (err) {
    console.error('[googlenews] Error fetching RSS:', err)
    return []
  }
}
