"""
prepare_data.py — Feature engineering from raw football-datasets CSVs.

Outputs:
  ml/data/processed/features.csv   — one row per match with rolling averages
  ml/data/processed/scaler.json    — StandardScaler params for inference

Usage:
  python ml/scripts/prepare_data.py
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "ml/data/raw/football-datasets/datasets"
OUT_DIR = ROOT / "ml/data/processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LEAGUES = {
    "premier-league": {"id": 0, "country": "England"},
    "la-liga":        {"id": 1, "country": "Spain"},
    "serie-a":        {"id": 2, "country": "Italy"},
    "bundesliga":     {"id": 3, "country": "Germany"},
    "ligue-1":        {"id": 4, "country": "France"},
}

WINDOW = 5   # rolling average window
MIN_GAMES = 5  # minimum prior games required to include a row

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


def xg_proxy(shots_on_target, shots, goals):
    """Proxy xG: (HST/HS) * goals * 1.1"""
    ratio = shots_on_target / np.maximum(shots, 1)
    return ratio * goals * 1.1


def form_pts(results):
    """Convert W/D/L list to points (3/1/0)."""
    pts = {"W": 3, "D": 1, "L": 0}
    return sum(pts.get(r, 0) for r in results)


def load_league(league_name: str, league_id: int) -> pd.DataFrame:
    league_dir = RAW_DIR / league_name
    if not league_dir.exists():
        print(f"  [warn] Directory not found: {league_dir}")
        return pd.DataFrame()

    frames = []
    csv_files = sorted(league_dir.glob("season-*.csv"))
    print(f"  {league_name}: {len(csv_files)} seasons")

    for f in csv_files:
        try:
            df = pd.read_csv(f, encoding="utf-8", on_bad_lines="skip")
            required = {"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"}
            if not required.issubset(df.columns):
                continue
            # Fill optional columns with 0
            for col in ["HS", "AS", "HST", "AST", "HC", "AC", "HY", "AY", "HR", "AR"]:
                if col not in df.columns:
                    df[col] = 0
                else:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
            for col in ["FTHG", "FTAG"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            df = df.dropna(subset=["FTHG", "FTAG", "FTR", "HomeTeam", "AwayTeam"])
            df = df[df["FTR"].isin(["H", "D", "A"])]
            df["league_id"] = league_id
            df["league_name"] = league_name
            # Parse date — multiple formats
            df["date_parsed"] = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce")
            df = df.dropna(subset=["date_parsed"])
            frames.append(df)
        except Exception as e:
            print(f"  [warn] Failed to read {f.name}: {e}")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values("date_parsed").reset_index(drop=True)
    return combined


def compute_rolling_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each match, compute rolling averages of the last WINDOW games
    for both home and away teams (looking backwards, excluding current match).
    """
    # Build per-team history indexed by match position
    # team_history[team] = list of dicts {goals_scored, goals_conceded, shots, sot, corners, cards, xg_proxy, result_pts}
    team_history: dict = {}

    rows = []

    for _, row in df.iterrows():
        home = row["HomeTeam"]
        away = row["AwayTeam"]

        home_hist = team_history.get(home, [])
        away_hist = team_history.get(away, [])

        # Need at least MIN_GAMES for both teams
        if len(home_hist) < MIN_GAMES or len(away_hist) < MIN_GAMES:
            # Still update history even if we skip this row
            _update_history(team_history, row)
            continue

        h = home_hist[-WINDOW:]
        a = away_hist[-WINDOW:]

        def avg(hist, key):
            return np.mean([x[key] for x in hist])

        feat = {
            # Home features
            "home_goals_scored_avg5":      avg(h, "goals_scored"),
            "home_goals_conceded_avg5":    avg(h, "goals_conceded"),
            "home_shots_avg5":             avg(h, "shots"),
            "home_shots_on_target_avg5":   avg(h, "sot"),
            "home_corners_avg5":           avg(h, "corners"),
            "home_cards_avg5":             avg(h, "cards"),
            "home_xg_proxy_avg5":          avg(h, "xg_proxy"),
            "home_form_pts5":              avg(h, "pts"),
            # Away features
            "away_goals_scored_avg5":      avg(a, "goals_scored"),
            "away_goals_conceded_avg5":    avg(a, "goals_conceded"),
            "away_shots_avg5":             avg(a, "shots"),
            "away_shots_on_target_avg5":   avg(a, "sot"),
            "away_corners_avg5":           avg(a, "corners"),
            "away_cards_avg5":             avg(a, "cards"),
            "away_xg_proxy_avg5":          avg(a, "xg_proxy"),
            "away_form_pts5":              avg(a, "pts"),
            # Context
            "league_id":                   row["league_id"],
            # Targets
            "target_ftr":                  row["FTR"],    # H/D/A
            "target_fthg":                 row["FTHG"],   # home goals
            "target_ftag":                 row["FTAG"],   # away goals
        }
        rows.append(feat)

        _update_history(team_history, row)

    return pd.DataFrame(rows)


def _update_history(team_history: dict, row):
    home = row["HomeTeam"]
    away = row["AwayTeam"]
    fthg = row["FTHG"]
    ftag = row["FTAG"]
    ftr  = row["FTR"]

    hs  = row.get("HS", 0) or 0
    as_ = row.get("AS", 0) or 0
    hst = row.get("HST", 0) or 0
    ast = row.get("AST", 0) or 0
    hc  = row.get("HC", 0) or 0
    ac  = row.get("AC", 0) or 0
    hy  = row.get("HY", 0) or 0
    ay  = row.get("AY", 0) or 0
    hr  = row.get("HR", 0) or 0
    ar  = row.get("AR", 0) or 0

    home_xg = float(xg_proxy(hst, hs, fthg))
    away_xg = float(xg_proxy(ast, as_, ftag))

    home_pts = 3 if ftr == "H" else (1 if ftr == "D" else 0)
    away_pts = 3 if ftr == "A" else (1 if ftr == "D" else 0)

    if home not in team_history:
        team_history[home] = []
    team_history[home].append({
        "goals_scored":   fthg,
        "goals_conceded": ftag,
        "shots":          hs,
        "sot":            hst,
        "corners":        hc,
        "cards":          hy + hr,
        "xg_proxy":       home_xg,
        "pts":            home_pts,
    })

    if away not in team_history:
        team_history[away] = []
    team_history[away].append({
        "goals_scored":   ftag,
        "goals_conceded": fthg,
        "shots":          as_,
        "sot":            ast,
        "corners":        ac,
        "cards":          ay + ar,
        "xg_proxy":       away_xg,
        "pts":            away_pts,
    })


def main():
    print("[prepare] Loading leagues...")
    all_frames = []
    for league_name, meta in LEAGUES.items():
        df = load_league(league_name, meta["id"])
        if not df.empty:
            all_frames.append(df)

    if not all_frames:
        print("[prepare] No data found. Run download_data.sh first.")
        sys.exit(1)

    combined = pd.concat(all_frames, ignore_index=True)
    combined = combined.sort_values("date_parsed").reset_index(drop=True)
    print(f"[prepare] Total raw matches: {len(combined)}")

    print("[prepare] Computing rolling features...")
    features = compute_rolling_features(combined)
    print(f"[prepare] Matches after windowing (min {MIN_GAMES} prior games): {len(features)}")

    # Encode FTR as integer
    features["target_ftr_int"] = features["target_ftr"].map({"H": 0, "D": 1, "A": 2})

    # Fit and save scaler on feature columns only
    scaler = StandardScaler()
    features[FEATURE_COLS] = scaler.fit_transform(features[FEATURE_COLS])

    scaler_params = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "feature_cols": FEATURE_COLS,
    }
    with open(OUT_DIR / "scaler.json", "w") as f:
        json.dump(scaler_params, f, indent=2)
    print(f"[prepare] Scaler saved to {OUT_DIR / 'scaler.json'}")

    # Save features
    out_path = OUT_DIR / "features.csv"
    features.to_csv(out_path, index=False)
    print(f"[prepare] Features saved to {out_path}")

    # Summary stats
    ftr_dist = features["target_ftr"].value_counts(normalize=True)
    print(f"[prepare] FTR distribution: H={ftr_dist.get('H', 0):.1%} D={ftr_dist.get('D', 0):.1%} A={ftr_dist.get('A', 0):.1%}")
    print(f"[prepare] Avg home goals: {features['target_fthg'].mean():.2f} | Avg away goals: {features['target_ftag'].mean():.2f}")


if __name__ == "__main__":
    main()
