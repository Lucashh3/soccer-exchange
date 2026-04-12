#!/usr/bin/env bash
# download_data.sh — Baixa CSVs históricos do football-data.co.uk
# Ligas: Premier League, La Liga, Serie A, Bundesliga, Ligue 1
# Temporadas: 2014/15 até 2024/25
#
# Uso:
#   bash ml/scripts/download_data.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT/ml/data/raw/football-datasets/datasets"
BASE_URL="https://www.football-data.co.uk/mmz4281"

LEAGUES="premier-league:E0 la-liga:SP1 serie-a:I1 bundesliga:D1 ligue-1:F1"
SEASONS="1415 1516 1617 1718 1819 1920 2021 2122 2223 2324 2425"

ok=0; skipped=0; failed=0

for entry in $LEAGUES; do
  league="${entry%%:*}"
  code="${entry##*:}"
  dir="$OUT_DIR/$league"
  mkdir -p "$dir"

  for season in $SEASONS; do
    dest="$dir/season-${season}.csv"
    url="$BASE_URL/${season}/${code}.csv"

    if [ -f "$dest" ]; then
      echo "[skip] $league / $season — já existe"
      skipped=$((skipped + 1))
      continue
    fi

    echo "[download] $league / $season..."
    if curl -sSf --max-time 30 --retry 3 -o "$dest" "$url" 2>/dev/null; then
      lines=$(wc -l < "$dest" | tr -d ' ')
      if [ "$lines" -lt 2 ]; then
        echo "[warn] $league / $season — arquivo vazio"
        rm -f "$dest"
        failed=$((failed + 1))
      else
        echo "[ok] $league / $season — ${lines} linhas"
        ok=$((ok + 1))
      fi
    else
      echo "[warn] $league / $season — falha (temporada pode não existir)"
      rm -f "$dest"
      failed=$((failed + 1))
    fi
  done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OK: $ok | Pulados: $skipped | Falhas: $failed"
echo "Dados em: $OUT_DIR"
