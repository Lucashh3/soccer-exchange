"""
evaluate.py — Evaluate trained models against validation set targets.

Prints accuracy, MAE, Brier score, and per-market metrics.

Usage:
  python ml/scripts/evaluate.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, brier_score_loss, classification_report
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "ml/data/processed"
MODELS_DIR = ROOT / "ml/models"

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

SEED = 42


def main():
    df = pd.read_csv(PROCESSED / "features.csv")
    X = df[FEATURE_COLS].values.astype(np.float32)
    y_ftr  = df["target_ftr_int"].values.astype(np.int32)
    y_fthg = df["target_fthg"].values.astype(np.float32)
    y_ftag = df["target_ftag"].values.astype(np.float32)

    _, X_val, _, y_ftr_val, _, y_fthg_val, _, y_ftag_val = \
        train_test_split(X, y_ftr, y_fthg, y_ftag, test_size=0.2, stratify=y_ftr, random_state=SEED)

    print(f"[evaluate] Validation set: {len(X_val)} samples\n")

    # ── Outcome model ─────────────────────────────────────────────────────────
    print("=== Outcome model (H/D/A) ===")
    outcome_model = tf.keras.models.load_model(str(MODELS_DIR / "outcome"))
    probs = outcome_model.predict(X_val, verbose=0)  # shape (N, 3)
    preds = np.argmax(probs, axis=1)

    acc = accuracy_score(y_ftr_val, preds)
    print(f"Accuracy: {acc:.4f}  (target > 0.55)")
    print(classification_report(y_ftr_val, preds, target_names=["Home", "Draw", "Away"]))

    # Brier scores per class
    for i, label in enumerate(["Home", "Draw", "Away"]):
        bs = brier_score_loss((y_ftr_val == i).astype(int), probs[:, i])
        print(f"Brier score {label}: {bs:.4f}  (target < 0.22)")

    # ── Derived market evaluation ─────────────────────────────────────────────
    print("\n=== Goals models ===")
    goals_home_model = tf.keras.models.load_model(str(MODELS_DIR / "goals_home"))
    goals_away_model = tf.keras.models.load_model(str(MODELS_DIR / "goals_away"))

    lambda_home = goals_home_model.predict(X_val, verbose=0).flatten()
    lambda_away = goals_away_model.predict(X_val, verbose=0).flatten()

    mae_home = np.mean(np.abs(lambda_home - y_fthg_val))
    mae_away = np.mean(np.abs(lambda_away - y_ftag_val))
    print(f"Goals Home MAE: {mae_home:.4f}  (target < 0.80)")
    print(f"Goals Away MAE: {mae_away:.4f}  (target < 0.80)")

    # BTTS accuracy: both teams scored
    actual_btts = ((y_fthg_val > 0) & (y_ftag_val > 0)).astype(int)
    # Use Poisson CDF to estimate P(score > 0) from lambda
    p_home_scores = 1 - np.exp(-np.maximum(lambda_home, 0))
    p_away_scores = 1 - np.exp(-np.maximum(lambda_away, 0))
    p_btts = p_home_scores * p_away_scores
    pred_btts = (p_btts > 0.5).astype(int)
    btts_acc = accuracy_score(actual_btts, pred_btts)
    btts_bs  = brier_score_loss(actual_btts, p_btts)
    print(f"\nBTTS accuracy: {btts_acc:.4f} | Brier: {btts_bs:.4f}")

    # Over 2.5 accuracy
    actual_over25 = ((y_fthg_val + y_ftag_val) > 2.5).astype(int)
    # P(total > 2.5) ≈ 1 - P(0) - P(1) - P(2) using combined Poisson
    lam = np.maximum(lambda_home, 0) + np.maximum(lambda_away, 0)
    p_under25 = np.exp(-lam) * (1 + lam + lam**2 / 2)
    p_over25 = 1 - p_under25
    pred_over25 = (p_over25 > 0.5).astype(int)
    over25_acc = accuracy_score(actual_over25, pred_over25)
    over25_bs  = brier_score_loss(actual_over25, p_over25)
    print(f"Over2.5 accuracy: {over25_acc:.4f} | Brier: {over25_bs:.4f}")

    # Save evaluation report
    report = {
        "outcome_accuracy": float(acc),
        "goals_home_mae": float(mae_home),
        "goals_away_mae": float(mae_away),
        "btts_accuracy": float(btts_acc),
        "btts_brier": float(btts_bs),
        "over25_accuracy": float(over25_acc),
        "over25_brier": float(over25_bs),
    }
    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n[evaluate] Report saved to {MODELS_DIR / 'metrics.json'}")


if __name__ == "__main__":
    main()
