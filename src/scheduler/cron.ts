import cron from 'node-cron'
import { execFile } from 'child_process'
import path from 'path'
import { runMorningPipeline, runLineupCheck, runStatusUpdate, runAttackPoll } from './pipeline'
import { reloadModels } from '../analysis/mlPredictor'

export function startCron(): void {
  // Morning pipeline at 5:00 AM daily
  cron.schedule('0 5 * * *', async () => {
    console.log('[cron] Triggering morning pipeline at 5:00 AM')
    try {
      await runMorningPipeline()
    } catch (err) {
      console.error('[cron] Morning pipeline failed:', err)
    }
  })

  // Status update every 2 minutes (keeps inprogress/finished in sync)
  cron.schedule('*/2 * * * *', async () => {
    try {
      await runStatusUpdate()
    } catch (err) {
      console.error('[cron] Status update failed:', err)
    }
  })

  // Lineup check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runLineupCheck()
    } catch (err) {
      console.error('[cron] Lineup check failed:', err)
    }
  })

  // Weekly fine-tuning every Sunday at 3:00 AM + hot-reload models
  cron.schedule('0 3 * * 0', () => {
    const python = process.env.PYTHON_PATH ?? 'python3'
    const script = path.resolve(process.cwd(), 'ml/scripts/finetune.py')
    const db     = path.resolve(process.cwd(), 'data/soccer.db')
    console.log('[cron] Starting weekly fine-tuning...')
    execFile(python, [script, '--db', db], async (err, stdout, stderr) => {
      if (err) {
        console.error('[cron] Fine-tuning failed:', err.message)
        if (stderr) console.error(stderr)
      } else {
        console.log('[cron] Fine-tuning completed\n', stdout)
        await reloadModels()
      }
    })
  })

  // Attack stats poll every 1 minute (para calcular janelas de 5/10 min)
  cron.schedule('* * * * *', async () => {
    try { await runAttackPoll() } catch (err) {
      console.error('[cron] Attack poll failed:', err)
    }
  })

  console.log('[cron] Scheduled: morning pipeline at 5:00 AM, status update every 2 min, attack poll every 1 min, lineup check every 5 min, fine-tuning every Sunday at 3:00 AM')
}
