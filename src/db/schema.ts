import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let dbInstance: Database.Database | null = null

export function initDb(): Database.Database {
  if (dbInstance) return dbInstance

  const dbDir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, 'soccer.db')
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      sofascore_id INTEGER,
      exchange_event_id TEXT,
      exchange_url TEXT,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_team_id INTEGER,
      away_team_id INTEGER,
      tournament_id INTEGER,
      league TEXT NOT NULL,
      country TEXT NOT NULL,
      kickoff_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_games_sofascore_id ON games(sofascore_id);

    CREATE TABLE IF NOT EXISTS team_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      side TEXT NOT NULL CHECK(side IN ('home', 'away')),
      xg_avg REAL,
      xg_conceded_avg REAL,
      goals_scored_avg REAL,
      goals_conceded_avg REAL,
      btts_pct REAL,
      over25_pct REAL,
      under25_pct REAL,
      form_last5 TEXT,
      form_last10 TEXT,
      corners_avg REAL,
      cards_avg REAL,
      possession_avg REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, side)
    );

    CREATE TABLE IF NOT EXISTS lineups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      side TEXT NOT NULL CHECK(side IN ('home', 'away')),
      player_name TEXT NOT NULL,
      position TEXT,
      is_starter INTEGER NOT NULL DEFAULT 0,
      is_absent INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      url TEXT,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      market TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      probability REAL NOT NULL,
      confidence REAL NOT NULL,
      ev REAL,
      post_lineup INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, market)
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
      report TEXT NOT NULL,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signal_decisions (
      game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
      model_source TEXT NOT NULL,
      home_quality REAL NOT NULL,
      away_quality REAL NOT NULL,
      avg_quality REAL NOT NULL,
      feature_quality_score REAL NOT NULL,
      p_ml_home REAL,
      p_ml_draw REAL,
      p_ml_away REAL,
      p_base_home REAL NOT NULL,
      p_base_draw REAL NOT NULL,
      p_base_away REAL NOT NULL,
      p_final_home REAL NOT NULL,
      p_final_draw REAL NOT NULL,
      p_final_away REAL NOT NULL,
      guardrails TEXT,
      meta_json TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_outcomes (
      game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('H', 'D', 'A')),
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_impact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      position TEXT,
      games_with INTEGER NOT NULL DEFAULT 0,
      games_without INTEGER NOT NULL DEFAULT 0,
      clean_sheets_with INTEGER NOT NULL DEFAULT 0,
      clean_sheets_without INTEGER NOT NULL DEFAULT 0,
      goals_conceded_with_sum REAL NOT NULL DEFAULT 0,
      goals_conceded_without_sum REAL NOT NULL DEFAULT 0,
      impact_score REAL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_id, player_name)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS coach_suggestion_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      game_id TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      league TEXT NOT NULL,
      market TEXT NOT NULL,
      rationale TEXT NOT NULL,
      outcome TEXT CHECK(outcome IN ('won', 'lost', 'void')) DEFAULT NULL,
      evaluated_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, game_id, market)
    );

    CREATE INDEX IF NOT EXISTS idx_coach_history_date ON coach_suggestion_history(date);
    CREATE INDEX IF NOT EXISTS idx_coach_history_game ON coach_suggestion_history(game_id);
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS live_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      minute INTEGER NOT NULL,
      home_goals INTEGER NOT NULL DEFAULT 0,
      away_goals INTEGER NOT NULL DEFAULT 0,
      home_attacks_per_min REAL,
      home_dangerous_per_min REAL,
      home_last5min REAL,
      home_last10min REAL,
      home_trend TEXT,
      away_attacks_per_min REAL,
      away_dangerous_per_min REAL,
      away_last5min REAL,
      away_last10min REAL,
      away_trend TEXT,
      prior_home_win REAL,
      prior_draw REAL,
      prior_away_win REAL,
      prior_lambda_home REAL,
      prior_lambda_away REAL,
      final_result TEXT CHECK(final_result IN ('H', 'D', 'A')),
      captured_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_live_snapshots_game ON live_snapshots(game_id);
    CREATE INDEX IF NOT EXISTS idx_live_snapshots_unlabeled ON live_snapshots(final_result) WHERE final_result IS NULL;
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `)

  // Migrations for existing databases
  const cols = (db.prepare(`PRAGMA table_info(games)`).all() as { name: string }[]).map(r => r.name)
  if (!cols.includes('home_team_id')) db.exec(`ALTER TABLE games ADD COLUMN home_team_id INTEGER`)
  if (!cols.includes('away_team_id')) db.exec(`ALTER TABLE games ADD COLUMN away_team_id INTEGER`)
  if (!cols.includes('tournament_id')) db.exec(`ALTER TABLE games ADD COLUMN tournament_id INTEGER`)
  if (!cols.includes('home_score')) db.exec(`ALTER TABLE games ADD COLUMN home_score INTEGER`)
  if (!cols.includes('away_score')) db.exec(`ALTER TABLE games ADD COLUMN away_score INTEGER`)
  if (!cols.includes('exchange_event_id')) db.exec(`ALTER TABLE games ADD COLUMN exchange_event_id TEXT`)
  if (!cols.includes('exchange_url')) db.exec(`ALTER TABLE games ADD COLUMN exchange_url TEXT`)

  // Migrations for team_stats
  const tsCols = (db.prepare(`PRAGMA table_info(team_stats)`).all() as { name: string }[]).map(r => r.name)
  if (!tsCols.includes('shots_avg')) db.exec(`ALTER TABLE team_stats ADD COLUMN shots_avg REAL`)
  if (!tsCols.includes('shots_on_target_avg')) db.exec(`ALTER TABLE team_stats ADD COLUMN shots_on_target_avg REAL`)
  if (!tsCols.includes('goals_scored_std')) db.exec(`ALTER TABLE team_stats ADD COLUMN goals_scored_std REAL`)
  if (!tsCols.includes('goals_conceded_std')) db.exec(`ALTER TABLE team_stats ADD COLUMN goals_conceded_std REAL`)
  if (!tsCols.includes('xg_std')) db.exec(`ALTER TABLE team_stats ADD COLUMN xg_std REAL`)
  if (!tsCols.includes('big_chances_created_avg')) db.exec(`ALTER TABLE team_stats ADD COLUMN big_chances_created_avg REAL`)
  if (!tsCols.includes('big_chances_conceded_avg')) db.exec(`ALTER TABLE team_stats ADD COLUMN big_chances_conceded_avg REAL`)

  // Migration: create signal_decisions on existing DBs
  db.exec(`
    CREATE TABLE IF NOT EXISTS signal_decisions (
      game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
      model_source TEXT NOT NULL,
      home_quality REAL NOT NULL,
      away_quality REAL NOT NULL,
      avg_quality REAL NOT NULL,
      feature_quality_score REAL NOT NULL,
      p_ml_home REAL,
      p_ml_draw REAL,
      p_ml_away REAL,
      p_base_home REAL NOT NULL,
      p_base_draw REAL NOT NULL,
      p_base_away REAL NOT NULL,
      p_final_home REAL NOT NULL,
      p_final_draw REAL NOT NULL,
      p_final_away REAL NOT NULL,
      guardrails TEXT,
      meta_json TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Migration: add UNIQUE(game_id, market) to signals if missing
  const sigIndexes = (db.prepare(`PRAGMA index_list(signals)`).all() as { name: string; unique: number }[])
  const hasUniqueSignal = sigIndexes.some(i => i.unique && (() => {
    const cols2 = db.prepare(`PRAGMA index_info(${i.name})`).all() as { name: string }[]
    return cols2.some(c => c.name === 'game_id') && cols2.some(c => c.name === 'market')
  })())
  if (!hasUniqueSignal) {
    // Remove duplicates keeping only the latest per (game_id, market)
    db.exec(`
      DELETE FROM signals WHERE id NOT IN (
        SELECT MAX(id) FROM signals GROUP BY game_id, market
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_game_market ON signals(game_id, market);
    `)
  }

  dbInstance = db
  return db
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDb()
  }
  return dbInstance
}
