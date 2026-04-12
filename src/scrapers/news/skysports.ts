import axios from 'axios'
import * as cheerio from 'cheerio'
import type { NewsItem } from '../../types/index'

export async function scrapeSkySportsNews(homeTeam: string, awayTeam: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`${homeTeam} ${awayTeam}`)
    const url = `https://www.skysports.com/search?term=${query}`

    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })

    const $ = cheerio.load(response.data)
    const news: NewsItem[] = []

    $('article, .sdc-site-tile, .news-list__item').each((_i, el) => {
      const titleEl = $(el).find('h3, h4, .sdc-site-tile__headline').first()
      const linkEl = $(el).find('a').first()
      const summaryEl = $(el).find('p, .sdc-site-tile__body').first()
      const dateEl = $(el).find('time').first()

      const title = titleEl.text().trim()
      const href = linkEl.attr('href')
      const summary = summaryEl.text().trim()
      const publishedAt = dateEl.attr('datetime') || dateEl.text().trim() || undefined

      if (title) {
        const fullUrl = href
          ? href.startsWith('http')
            ? href
            : `https://www.skysports.com${href}`
          : undefined

        news.push({
          id: 0,
          source: 'SkySports',
          title,
          summary: summary || undefined,
          url: fullUrl,
          publishedAt,
        })
      }
    })

    return news.slice(0, 5)
  } catch (err) {
    console.error('[skysports] Error scraping news:', err)
    return []
  }
}
