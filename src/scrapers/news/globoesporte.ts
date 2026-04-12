import axios from 'axios'
import * as cheerio from 'cheerio'
import type { NewsItem } from '../../types/index'

export async function scrapeGloboNews(homeTeam: string, awayTeam: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`${homeTeam} ${awayTeam}`)
    const url = `https://globoesporte.globo.com/busca/?q=${query}`

    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    })

    const $ = cheerio.load(response.data)
    const news: NewsItem[] = []

    $('.results-page__item, .widget--info, .feed-post').each((_i, el) => {
      const titleEl = $(el).find('h2, .feed-post-header-title, .widget--info__title').first()
      const linkEl = $(el).find('a').first()
      const summaryEl = $(el).find('p, .feed-post-body-resumo').first()

      const title = titleEl.text().trim()
      const href = linkEl.attr('href')
      const summary = summaryEl.text().trim()

      if (title) {
        news.push({
          id: 0,
          source: 'GloboEsporte',
          title,
          summary: summary || undefined,
          url: href || undefined,
          publishedAt: undefined,
        })
      }
    })

    return news.slice(0, 5)
  } catch (err) {
    console.error('[globoesporte] Error scraping news:', err)
    return []
  }
}
