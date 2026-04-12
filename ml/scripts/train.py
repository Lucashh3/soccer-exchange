"""
train.py — Train 3 models on prepared features.

Models:
  1. outcome  — classify H/D/A (softmax)
  2. goals_home — regress FTHG
  3. goals_away — regress FTAG

Outputs saved as TF.js LayersModel in ml/models/{outcome,goals_home,goals_away}/

Usage:
  python ml/scripts/train.py
"""

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
import tensorflowjs as tfjs
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "ml/data/processed"
MODELS_DIR = ROOT / "ml/models"

FEATURE_COLS = [
    "home_goals_scored_avg5",
    "home_goals_conceded_avg5",
    "home_shots_avg5",
    "home_shots_on_target_avg5",
    "home_corners_avg5",
    "home_cards_avg5",
    "home_xg_proxy_avg5",
    "home_form_pts5",
    "away_goals_scored_avg5",
    "away_goals_conceded_avg5",
    "away_shots_avg5",
    "away_shots_on_target_avg5",
    "away_corners_avg5",
    "away_cards_avg5",
    "away_xg_proxy_avg5",
    "away_form_pts5",
    "league_id",
]

SEED = 42
EPOCHS = 60
BATCH_SIZE = 256


def build_outcome_model(input_dim: int) -> tf.keras.Model:
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(3, activation="softmax"),
    ], name="outcome_model")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_goals_model(input_dim: int, name: str) -> tf.keras.Model:
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(input_dim,)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1, activation="linear"),
    ], name=name)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="mean_squared_error",
        metrics=["mae"],
    )
    return model


def train_and_save(model, X_train, y_train, X_val, y_val, out_dir: Path):
    callbacks = [
        tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(patience=4, factor=0.5, min_lr=1e-5),
    ]
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    tfjs.converters.save_keras_model(model, str(out_dir))
    print(f"  Saved TF.js model to {out_dir}")
    return history


def main():
    tf.random.set_seed(SEED)
    np.random.seed(SEED)

    # Load features
    features_path = PROCESSED / "features.csv"
    if not features_path.exists():
        print("[train] features.csv not found. Run prepare_data.py first.")
        return

    df = pd.read_csv(features_path)
    print(f"[train] Loaded {len(df)} samples")

    X = df[FEATURE_COLS].values.astype(np.float32)
    y_ftr  = df["target_ftr_int"].values.astype(np.int32)
    y_fthg = df["target_fthg"].values.astype(np.float32)
    y_ftag = df["target_ftag"].values.astype(np.float32)

    # Stratified split on FTR
    X_train, X_val, y_ftr_train, y_ftr_val, y_fthg_train, y_fthg_val, y_ftag_train, y_ftag_val = \
        train_test_split(X, y_ftr, y_fthg, y_ftag, test_size=0.2, stratify=y_ftr, random_state=SEED)

    print(f"[train] Train: {len(X_train)} | Val: {len(X_val)}")
    input_dim = X.shape[1]

    metrics = {}

    # ── Model 1: Outcome (H/D/A) ──────────────────────────────────────────────
    print("\n[train] === Outcome model (H/D/A) ===")
    outcome_model = build_outcome_model(input_dim)
    outcome_model.summary()
    history = train_and_save(
        outcome_model, X_train, y_ftr_train, X_val, y_ftr_val,
        MODELS_DIR / "outcome"
    )
    val_acc = max(history.history["val_accuracy"])
    print(f"  Best val accuracy: {val_acc:.4f}")
    metrics["outcome"] = {"val_accuracy": float(val_acc)}

    # ── Model 2: Goals Home ───────────────────────────────────────────────────
    print("\n[train] === Goals Home model ===")
    goals_home_model = build_goals_model(input_dim, "goals_home_model")
    history = train_and_save(
        goals_home_model, X_train, y_fthg_train, X_val, y_fthg_val,
        MODELS_DIR / "goals_home"
    )
    val_mae = min(history.history["val_mae"])
    print(f"  Best val MAE: {val_mae:.4f}")
    metrics["goals_home"] = {"val_mae": float(val_mae)}

    # ── Model 3: Goals Away ───────────────────────────────────────────────────
    print("\n[train] === Goals Away model ===")
    goals_away_model = build_goals_model(input_dim, "goals_away_model")
    history = train_and_save(
        goals_away_model, X_train, y_ftag_train, X_val, y_ftag_val,
        MODELS_DIR / "goals_away"
    )
    val_mae = min(history.history["val_mae"])
    print(f"  Best val MAE: {val_mae:.4f}")
    metrics["goals_away"] = {"val_mae": float(val_mae)}

    # Save metrics
    metrics_path = MODELS_DIR / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\n[train] Metrics saved to {metrics_path}")
    print("[train] Done.")


if __name__ == "__main__":
    main()
