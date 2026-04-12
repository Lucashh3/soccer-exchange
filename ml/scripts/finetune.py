"""
finetune.py — Fine-tune trained models with local outcomes from the SQLite DB.

Strategy:
  - Load weights from ml/models/{outcome,goals_home,goals_away}
  - Freeze all layers except the last 2
  - Train for 20 epochs with low learning rate (1e-5)
  - Save updated weights back to ml/models/

Requirements:
  - At least MIN_SAMPLES outcomes in game_outcomes table
  - team_stats must be populated for each game

Usage:
  python ml/scripts/finetune.py --db path/to/soccer.db
"""

import argparse
import json
import sqlite3
from pathlib import Path

import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs

ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "ml/models"
SCALER_PATH = ROOT / "ml/data/processed/scaler.json"

MIN_SAMPLES = 50
EPOCHS = 20
BATCH_SIZE = 32
LR = 1e-5

FEATURE_COLS = [
    "home_goals_scored_avg5", "home_goals_conceded_avg5",
    "home_shots_avg5", "home_shots_on_target_avg5",
    "home_corners_avg5", "home_cards_avg5",
    "home_xg_proxy_avg5", "home_form_pts5",
    "away_goals_scored_avg5", "away_goals_conceded_avg5",
    "away_shots_avg5", "away_shots_on_target_avg5",
    "away_corners_avg5", "away_cards_avg5",
    "away_xg_proxy_avg5", "away_form_pts5",
    "league_id",
]

LEAGUE_ID_MAP = {
    "Premier League": 0, "La Liga": 1, "Serie A": 2,
    "Bundesliga": 3, "Ligue 1": 4,
}


def load_local_data(db_path: str):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT
            go.game_id, go.home_score, go.away_score, go.result,
            g.league,
            hs.goals_scored_avg, hs.goals_conceded_avg,
            hs.xg_avg, hs.corners_avg, hs.cards_avg,
            hs.shots_avg, hs.shots_on_target_avg,
            hs.form_last5,
            as_.goals_scored_avg AS a_goals_scored_avg,
            as_.goals_conceded_avg AS a_goals_conceded_avg,
            as_.xg_avg AS a_xg_avg, as_.corners_avg AS a_corners_avg,
            as_.cards_avg AS a_cards_avg,
            as_.shots_avg AS a_shots_avg,
            as_.shots_on_target_avg AS a_shots_on_target_avg,
            as_.form_last5 AS a_form_last5
        FROM game_outcomes go
        JOIN games g ON g.id = go.game_id
        LEFT JOIN team_stats hs ON hs.game_id = go.game_id AND hs.side = 'home'
        LEFT JOIN team_stats as_ ON as_.game_id = go.game_id AND as_.side = 'away'
    """)
    rows = cur.fetchall()
    conn.close()
    return rows


def form_to_pts(form_str):
    if not form_str:
        return 1.5
    pts = {"W": 3, "D": 1, "L": 0}
    chars = list(str(form_str))[:5]
    if not chars:
        return 1.5
    return sum(pts.get(c, 0) for c in chars) / len(chars)


def xg_proxy(goals):
    return float(goals or 0) * 0.9  # simple proxy without shots data


def rows_to_features(rows):
    X, y_ftr, y_fthg, y_ftag = [], [], [], []
    result_map = {"H": 0, "D": 1, "A": 2}

    for r in rows:
        league_id = LEAGUE_ID_MAP.get(r["league"], 5)
        feat = [
            r["goals_scored_avg"] or 1.5,
            r["goals_conceded_avg"] or 1.2,
            r["shots_avg"] or 0.0,
            r["shots_on_target_avg"] or 0.0,
            r["corners_avg"] or 0.0,
            r["cards_avg"] or 0.0,
            r["xg_avg"] or xg_proxy(r["goals_scored_avg"]),
            form_to_pts(r["form_last5"]),
            r["a_goals_scored_avg"] or 1.2,
            r["a_goals_conceded_avg"] or 1.5,
            r["a_shots_avg"] or 0.0,
            r["a_shots_on_target_avg"] or 0.0,
            r["a_corners_avg"] or 0.0,
            r["a_cards_avg"] or 0.0,
            r["a_xg_avg"] or xg_proxy(r["a_goals_scored_avg"]),
            form_to_pts(r["a_form_last5"]),
            float(league_id),
        ]
        X.append(feat)
        y_ftr.append(result_map.get(r["result"], 0))
        y_fthg.append(float(r["home_score"]))
        y_ftag.append(float(r["away_score"]))

    return np.array(X, dtype=np.float32), np.array(y_ftr), np.array(y_fthg), np.array(y_ftag)


def scale_features(X, scaler):
    mean = np.array(scaler["mean"])
    scale = np.array(scaler["scale"])
    return (X - mean) / scale


def freeze_except_last(model, n_trainable=2):
    for layer in model.layers[:-n_trainable]:
        layer.trainable = False
    for layer in model.layers[-n_trainable:]:
        layer.trainable = True


def finetune(model_dir: Path, X, y, loss, metrics, name: str):
    model = tfjs.converters.load_keras_model(str(model_dir / "model.json"))
    freeze_except_last(model)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(LR),
        loss=loss,
        metrics=metrics,
    )
    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
    ]
    print(f"\n[finetune] Fine-tuning {name} on {len(X)} samples...")
    model.fit(X, y, epochs=EPOCHS, batch_size=BATCH_SIZE, callbacks=callbacks,
              validation_split=0.2, verbose=1)

    tfjs.converters.save_keras_model(model, str(model_dir))
    print(f"[finetune] {name} saved to {model_dir}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=str(ROOT / "data/soccer.db"), help="Path to soccer.db")
    args = parser.parse_args()

    print(f"[finetune] Loading outcomes from {args.db}...")
    rows = load_local_data(args.db)
    print(f"[finetune] Found {len(rows)} outcomes")

    if len(rows) < MIN_SAMPLES:
        print(f"[finetune] Not enough data (need {MIN_SAMPLES}, have {len(rows)}). Skipping.")
        return

    with open(SCALER_PATH) as f:
        scaler = json.load(f)

    X, y_ftr, y_fthg, y_ftag = rows_to_features(rows)
    X_scaled = scale_features(X, scaler)

    finetune(MODELS_DIR / "outcome",    X_scaled, y_ftr,  "sparse_categorical_crossentropy", ["accuracy"], "outcome")
    finetune(MODELS_DIR / "goals_home", X_scaled, y_fthg, "mean_squared_error", ["mae"], "goals_home")
    finetune(MODELS_DIR / "goals_away", X_scaled, y_ftag, "mean_squared_error", ["mae"], "goals_away")

    print("\n[finetune] Done.")


if __name__ == "__main__":
    main()
