import { startServer } from './api/server'
import { startCron } from './scheduler/cron'
import { loadModels } from './analysis/mlPredictor'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Load ML models asynchronously (non-blocking)
loadModels().catch(err => console.error('[index] ML model load failed:', err))

const args = process.argv.slice(2)

if (args.includes('--run-now')) {
  import('./scheduler/pipeline').then(({ runMorningPipeline }) => {
    console.log('[index] Running pipeline immediately...')
    runMorningPipeline()
      .then(() => {
        console.log('[index] Pipeline completed')
      })
      .catch((err) => {
        console.error('[index] Pipeline failed:', err)
        process.exit(1)
      })
  })
}

startServer()
startCron()

console.log('[index] Soccer Exchange started')