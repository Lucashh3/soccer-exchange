import { runMorningPipeline } from './src/scheduler/pipeline'

runMorningPipeline()
  .then(() => { console.log('[manual] pipeline concluído'); process.exit(0) })
  .catch((e: any) => { console.error('[manual] erro:', e); process.exit(1) })
