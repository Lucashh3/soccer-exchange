"""
Soccer Exchange — Sofascore Scraper Microservice
FastAPI wrapper around sofascore-wrapper (Playwright/Chromium)

Run:
    uvicorn main:app --port 8001 --reload

Setup (once):
    pip install -r requirements.txt
    python -m playwright install chromium
"""

import asyncio
import logging
import statistics as stats_module
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from sofascore_wrapper.api import SofascoreAPI
from sofascore_wrapper.match import Match
from sofascore_wrapper.team import Team

from league_ids import LEAGUE_IDS, LEAGUE_ID_SET

logging.basicConfig(level=logging.INFO, format="[scraper] %(message)s")
log = logging.getLogger(__name__)

# ── Page pool — N independent SofascoreAPI instances (each its own Playwright page) ──
_POOL_SIZE = 4
_pool: asyncio.Queue  # Queue[SofascoreAPI]


@asynccontextmanager
async def pool_api():
    """Borrow one API instance from the pool; return it when done."""
    api = await _pool.get()
    try:
        yield api
    finally:
        await _pool.put(api)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    log.info(f"starting Playwright / Chromium pool (size={_POOL_SIZE})...")
    _pool = asyncio.Queue()
    for _ in range(_POOL_SIZE):
        await _pool.put(SofascoreAPI())
    log.info("ready")
    yield
    instances: list[SofascoreAPI] = []
    while not _pool.empty():
        instances.append(_pool.get_nowait())
    await asyncio.gather(*[a.close() for a in instances], return_exceptions=True)
    log.info("Chromium pool closed")


app = FastAPI(title="soccer-exchange scraper", lifespan=lifespan)


def get_api() -> SofascoreAPI:
    raise HTTPException(status_code=503, detail="Use pool_api() context manager")


# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_fixtures_stats(fixtures: list, team_id: int) -> dict:
    """
    Calculate TeamStats from a list of recent fixture objects.
    Each fixture has homeTeam/awayTeam with ids and homeScore/awayScore.
    """
    goals_scored = []
    goals_conceded = []
    form_chars = []
    btts_count = 0
    over25_count = 0
    xg_scored = []
    xg_conceded = []
    shots_list = []
    shots_on_target_list = []
    possession_list = []
    big_chances_created_list = []
    big_chances_conceded_list = []

    for m in fixtures:
        try:
            is_home = m.get("homeTeam", {}).get("id") == team_id
            hs = m.get("homeScore", {}).get("current", 0) or 0
            as_ = m.get("awayScore", {}).get("current", 0) or 0

            scored   = hs if is_home else as_
            conceded = as_ if is_home else hs

            goals_scored.append(scored)
            goals_conceded.append(conceded)

            if scored + conceded > 2:
                over25_count += 1
            if scored >= 1 and conceded >= 1:
                btts_count += 1

            # Extra stats from homeAwayStats if present
            has = m.get("homeAwayStats", {})
            side_key = "homeTeam" if is_home else "awayTeam"
            opp_key  = "awayTeam" if is_home else "homeTeam"

            xg_val = has.get(side_key, {}).get("expectedGoals")
            xg_con = has.get(opp_key,  {}).get("expectedGoals")
            if xg_val is not None:
                try: xg_scored.append(float(xg_val))
                except (TypeError, ValueError): pass
            if xg_con is not None:
                try: xg_conceded.append(float(xg_con))
                except (TypeError, ValueError): pass

            shots_val = has.get(side_key, {}).get("shots")
            if shots_val is not None:
                try: shots_list.append(float(shots_val))
                except (TypeError, ValueError): pass

            sot_val = has.get(side_key, {}).get("shotsOnTarget")
            if sot_val is not None:
                try: shots_on_target_list.append(float(sot_val))
                except (TypeError, ValueError): pass

            poss_val = has.get(side_key, {}).get("possession")
            if poss_val is not None:
                try:
                    pv = float(str(poss_val).replace("%", ""))
                    possession_list.append(pv / 100 if pv > 1 else pv)
                except (TypeError, ValueError): pass

            bc_created = has.get(side_key, {}).get("bigChances")
            if bc_created is not None:
                try: big_chances_created_list.append(float(bc_created))
                except (TypeError, ValueError): pass

            bc_conceded = has.get(opp_key, {}).get("bigChances")
            if bc_conceded is not None:
                try: big_chances_conceded_list.append(float(bc_conceded))
                except (TypeError, ValueError): pass

            if scored > conceded:
                form_chars.append("W")
            elif scored == conceded:
                form_chars.append("D")
            else:
                form_chars.append("L")
        except Exception:
            continue

    n = len(goals_scored)
    if n == 0:
        return {}

    return {
        "goalsScoredAvg":       round(sum(goals_scored) / n, 2),
        "goalsConcededAvg":     round(sum(goals_conceded) / n, 2),
        "bttsPct":              round(btts_count / n * 100, 1),
        "over25Pct":            round(over25_count / n * 100, 1),
        "under25Pct":           round((n - over25_count) / n * 100, 1),
        "xgAvg":                round(sum(xg_scored) / len(xg_scored), 2) if xg_scored else None,
        "xgConcededAvg":        round(sum(xg_conceded) / len(xg_conceded), 2) if xg_conceded else None,
        "shotsAvg":             round(sum(shots_list) / len(shots_list), 2) if shots_list else None,
        "shotsOnTargetAvg":     round(sum(shots_on_target_list) / len(shots_on_target_list), 2) if shots_on_target_list else None,
        "possessionAvg":        round(sum(possession_list) / len(possession_list), 4) if possession_list else None,
        "formLast5":            "".join(form_chars[:5]),
        "formLast10":           "".join(form_chars[:10]),
        "goalsScoredStd":       round(stats_module.pstdev(goals_scored), 2) if n > 1 else 0.0,
        "goalsConcededStd":     round(stats_module.pstdev(goals_conceded), 2) if n > 1 else 0.0,
        "xgStd":                round(stats_module.pstdev(xg_scored), 2) if len(xg_scored) > 1 else None,
        "bigChancesCreatedAvg": round(sum(big_chances_created_list) / len(big_chances_created_list), 2) if big_chances_created_list else None,
        "bigChancesConcededAvg": round(sum(big_chances_conceded_list) / len(big_chances_conceded_list), 2) if big_chances_conceded_list else None,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "chromium": not _pool.empty()}


@app.get("/matches/today")
async def matches_today(date: str | None = None):
    """
    Returns today's matches (or `date` YYYY-MM-DD) filtered by whitelisted leagues.
    Each match includes the Sofascore event ID needed for downstream calls.
    """
    try:
        async with pool_api() as api:
            match = Match(api)
            data = await match.games_by_date(sport="football", date=date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    events = (data.get("events", []) if isinstance(data, dict) else [])
    result = []

    for ev in events:
        try:
            tid = (
                ev.get("tournament", {})
                  .get("uniqueTournament", {})
                  .get("id")
            )
            if tid not in LEAGUE_ID_SET:
                continue

            league_info = LEAGUE_IDS[tid]
            ts = ev.get("startTimestamp", 0)
            kickoff_iso = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

            home_score = ev.get("homeScore", {}).get("current") if isinstance(ev.get("homeScore"), dict) else None
            away_score = ev.get("awayScore", {}).get("current") if isinstance(ev.get("awayScore"), dict) else None

            status_obj = ev.get("status", {}) if isinstance(ev.get("status"), dict) else {}
            status_type = status_obj.get("type", "notstarted")
            status_desc = str(status_obj.get("description") or "").strip().lower()
            status_code = status_obj.get("code")
            if status_code == 31 or "halftime" in status_desc or status_desc == "ht":
                status_type = "halftime"

            result.append({
                "id":           f"{ev['homeTeam']['name'].lower().replace(' ', '-').replace('--', '-')}-vs-{ev['awayTeam']['name'].lower().replace(' ', '-').replace('--', '-')}-{datetime.fromtimestamp(ts).strftime('%Y-%m-%d')}",
                "sofascoreId":  ev["id"],
                "homeTeam":     ev["homeTeam"]["name"],
                "awayTeam":     ev["awayTeam"]["name"],
                "homeTeamId":   ev["homeTeam"]["id"],
                "awayTeamId":   ev["awayTeam"]["id"],
                "league":       league_info["name"],
                "country":      league_info["country"],
                "tournamentId": tid,
                "kickoffAt":    kickoff_iso,
                "status":       status_type,
                "homeScore":    home_score,
                "awayScore":    away_score,
            })
        except Exception:
            continue

    log.info(f"found {len(result)} whitelisted matches for {date or 'today'}")
    return {"matches": result}


@app.get("/match/{match_id}/form")
async def match_form(match_id: int):
    """
    Pre-match form — returns formLast5 string for each team from Sofascore's
    pre_match_form endpoint (W/D/L characters only).
    """
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.pre_match_form()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    def extract_form(team_raw) -> str:
        form_val = team_raw.get("form", [])
        if isinstance(form_val, list):
            # list of "W"/"D"/"L" strings
            return "".join(c for c in form_val if c in "WDL")[:10]
        if isinstance(form_val, str):
            return "".join(c for c in form_val if c in "WDL")[:10]
        return ""

    home_form = extract_form(data.get("homeTeam", {}))
    away_form = extract_form(data.get("awayTeam", {}))

    return {
        "homeForm": home_form,
        "awayForm": away_form,
        "homePosition": data.get("homeTeam", {}).get("position"),
        "awayPosition": data.get("awayTeam", {}).get("position"),
    }


@app.get("/team/{team_id}/stats")
async def team_stats(team_id: int):
    """
    Calculate TeamStats from last 10 fixtures for the team.
    Also fetches xG from match statistics for up to 5 recent fixtures with hasXg=True.
    """
    try:
        async with pool_api() as api:
            team = Team(api, team_id=team_id)
            fixtures = await team.last_fixtures()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if isinstance(fixtures, dict):
        fixtures = fixtures.get("events", [])

    # Fetch xG + shots stats from match statistics for up to 5 recent fixtures
    extra_by_match: dict[int, dict] = {}
    stat_fixtures = [f for f in fixtures if f.get("hasXg")][:5]
    for f in stat_fixtures:
        try:
            async with pool_api() as api:
                match_stats = await api._get(f"/event/{f['id']}/statistics")
            entry: dict = {}
            for period in match_stats.get("statistics", []):
                if period.get("period") != "ALL":
                    continue
                for group in period.get("groups", []):
                    for item in group.get("statisticsItems", []):
                        key = item.get("key", "")
                        if key == "expectedGoals":
                            entry["xgHome"] = item.get("homeValue")
                            entry["xgAway"] = item.get("awayValue")
                        elif key in ("totalShotsOnGoal", "shotsOnTarget"):
                            if "shotsOnTargetHome" not in entry:
                                entry["shotsOnTargetHome"] = item.get("homeValue")
                                entry["shotsOnTargetAway"] = item.get("awayValue")
                        elif key in ("totalShots", "shots"):
                            if "shotsHome" not in entry:
                                entry["shotsHome"] = item.get("homeValue")
                                entry["shotsAway"] = item.get("awayValue")
                        elif key == "ballPossession":
                            entry["possessionHome"] = item.get("homeValue")
                            entry["possessionAway"] = item.get("awayValue")
                        elif key in ("bigChances", "bigChancesCreated") and "bigChancesHome" not in entry:
                            entry["bigChancesHome"] = item.get("homeValue")
                            entry["bigChancesAway"] = item.get("awayValue")
            if entry:
                extra_by_match[f["id"]] = entry
        except Exception:
            continue

    # Inject extra stats into fixture objects so parse_fixtures_stats can use them
    for f in fixtures:
        mid = f.get("id")
        if mid in extra_by_match:
            ex = extra_by_match[mid]
            is_home = f.get("homeTeam", {}).get("id") == team_id
            side_key = "homeTeam" if is_home else "awayTeam"
            opp_key  = "awayTeam" if is_home else "homeTeam"
            f["homeAwayStats"] = {
                side_key: {
                    "expectedGoals":  ex.get("xgHome" if is_home else "xgAway"),
                    "shotsOnTarget":  ex.get("shotsOnTargetHome" if is_home else "shotsOnTargetAway"),
                    "shots":          ex.get("shotsHome" if is_home else "shotsAway"),
                    "possession":     ex.get("possessionHome" if is_home else "possessionAway"),
                    "bigChances":     ex.get("bigChancesHome" if is_home else "bigChancesAway"),
                },
                opp_key: {
                    "expectedGoals":  ex.get("xgAway" if is_home else "xgHome"),
                    "shotsOnTarget":  ex.get("shotsOnTargetAway" if is_home else "shotsOnTargetHome"),
                    "shots":          ex.get("shotsAway" if is_home else "shotsHome"),
                    "possession":     ex.get("possessionAway" if is_home else "possessionHome"),
                    "bigChances":     ex.get("bigChancesAway" if is_home else "bigChancesHome"),
                },
            }

    stats = parse_fixtures_stats(fixtures, team_id)
    return {"teamId": team_id, "stats": stats, "samplesUsed": min(len(fixtures), 10)}


@app.get("/match/{match_id}/lineups")
async def match_lineups(match_id: int):
    """
    Confirmed lineups for both teams. Returns empty lists if not yet available.
    """
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            home_data = await match.lineups_home()
            away_data = await match.lineups_away()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    def parse_players(raw: dict, side: str) -> dict:
        players = raw.get("players", [])
        confirmed = raw.get("confirmed", False)
        formation = raw.get("formation", None)
        return {
            "side":      side,
            "confirmed": confirmed,
            "formation": formation,
            "players": [
                {
                    "name":         p.get("player", {}).get("name"),
                    "position":     p.get("position"),
                    "jerseyNumber": p.get("jerseyNumber"),
                    "substitute":   p.get("substitute", False),
                }
                for p in players
            ],
        }

    return {
        "confirmed": bool(
            home_data.get("confirmed") and away_data.get("confirmed")
        ),
        "home": parse_players(home_data, "home"),
        "away": parse_players(away_data, "away"),
    }


@app.get("/match/{match_id}/h2h")
async def match_h2h(match_id: int):
    """Head-to-head data for the two teams."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.h2h()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Parse last 5 H2H results
    events = data.get("events", []) if isinstance(data, dict) else []
    parsed = []
    for ev in events[:5]:
        try:
            parsed.append({
                "homeTeam":  ev["homeTeam"]["name"],
                "awayTeam":  ev["awayTeam"]["name"],
                "homeScore": ev.get("homeScore", {}).get("current"),
                "awayScore": ev.get("awayScore", {}).get("current"),
                "date":      datetime.fromtimestamp(
                    ev["startTimestamp"], tz=timezone.utc
                ).strftime("%Y-%m-%d"),
            })
        except Exception:
            continue

    btts = sum(1 for e in parsed if (e["homeScore"] or 0) >= 1 and (e["awayScore"] or 0) >= 1)
    over25 = sum(1 for e in parsed if (e["homeScore"] or 0) + (e["awayScore"] or 0) > 2)
    n = len(parsed)

    return {
        "matches": parsed,
        "bttsPct":   round(btts / n * 100, 1) if n else None,
        "over25Pct": round(over25 / n * 100, 1) if n else None,
    }


@app.get("/match/{match_id}/odds")
async def match_odds(match_id: int):
    """Featured odds for 1X2 market (for EV calculation)."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.featured_odds()
            return data if isinstance(data, dict) else {"raw": data}
    except Exception:
        return {"available": False}


@app.get("/match/{match_id}/live")
async def match_live(match_id: int):
    """Live match data: score, time, events."""
    import re
    import time
    from datetime import datetime, timezone

    def parse_progress_minute(raw: object) -> int | None:
        if isinstance(raw, int):
            return max(0, raw)
        if isinstance(raw, str):
            m = re.search(r"\d+", raw)
            if m:
                return max(0, int(m.group(0)))
        return None

    def infer_phase(status_type: str, status_obj: dict, time_obj: dict) -> tuple[str, int | None]:
        code = status_obj.get("code")
        description = str(status_obj.get("description") or "").strip().lower()
        initial_seconds = time_obj.get("initial")
        initial_minute = int(initial_seconds // 60) if isinstance(initial_seconds, (int, float)) else None

        if status_type == "finished":
            return "finished", 2
        if status_type == "notstarted":
            return "not_started", None
        if status_type == "penaltyshootout":
            return "penalties", None

        if code == 31 or status_type in ("halftime", "pause") or "halftime" in description or description in ("ht",):
            return "halftime", 1

        if status_type in ("overtime", "extra_time") or "extra" in description:
            if "second" in description:
                return "extra_time_second", 4
            return "extra_time_first", 3

        if code == 6 or "1st half" in description or "first half" in description:
            return "first_half", 1
        if code == 7 or "2nd half" in description or "second half" in description:
            return "second_half", 2

        if status_type in ("inprogress", "live"):
            if initial_minute is not None and initial_minute >= 45:
                return "second_half", 2
            return "first_half", 1

        return "unknown", None

    def format_clock_display(phase: str, minute: int | None, status_type: str) -> str:
        if phase == "finished" or status_type == "finished":
            return "FT"
        if phase == "halftime":
            return "HT"
        if minute is None:
            return "LIVE"
        if phase == "first_half" and minute > 45:
            return f"45+{minute - 45}'"
        if phase in ("second_half", "finished") and minute > 90:
            return f"90+{minute - 90}'"
        if phase == "extra_time_first" and minute > 105:
            return f"105+{minute - 105}'"
        if phase == "extra_time_second" and minute > 120:
            return f"120+{minute - 120}'"
        return f"{minute}'"

    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.get_match()
            incidents_raw = await match.incidents()
            try:
                shotmap_raw = await match.shotmap()
            except Exception:
                shotmap_raw = {}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not isinstance(data, dict):
        return {"status": "unavailable", "homeScore": 0, "awayScore": 0}

    event = data.get("event", {})
    
    if not isinstance(event, dict):
        return {"status": "unavailable", "homeScore": 0, "awayScore": 0}

    # Get scores
    home_score = 0
    away_score = 0
    
    hs = event.get("homeScore")
    if isinstance(hs, dict):
        home_score = hs.get("current", 0) or 0
    as_ = event.get("awayScore")
    if isinstance(as_, dict):
        away_score = as_.get("current", 0) or 0

    # Get status and clock
    status_type = "unknown"
    minute = None
    phase = "unknown"
    period = None
    clock_source = "fallback"

    status = event.get("status")
    time_data = event.get("time") if isinstance(event.get("time"), dict) else {}
    progress_display = None
    if isinstance(status, dict):
        status_type = status.get("type", "unknown")
        phase, period = infer_phase(status_type, status, time_data)

        # 1) Prefer minute from status.progress.display when available
        progress = status.get("progress", {})
        if isinstance(progress, dict):
            progress_display = progress.get("display")
            progress_minute = parse_progress_minute(progress_display)
            if progress_minute is not None:
                minute = progress_minute
                clock_source = "status_progress"

        # 2) Otherwise derive from status.time with initial offset (no reset on halftime)
        if minute is None and status_type in ("inprogress", "live", "overtime", "extra_time") and isinstance(time_data, dict):
            period_start = time_data.get("currentPeriodStartTimestamp")
            initial_seconds = time_data.get("initial")
            base_seconds = initial_seconds if isinstance(initial_seconds, (int, float)) else 0
            if period_start:
                now = int(time.time())
                elapsed_seconds = max(0, now - int(period_start))
                minute = max(0, int((base_seconds + elapsed_seconds) // 60))
                clock_source = "status_time"
            elif isinstance(initial_seconds, (int, float)):
                minute = max(0, int(initial_seconds // 60))
                clock_source = "status_initial"

    # 3) Final fallback by phase
    if minute is None:
        if phase in ("second_half", "halftime"):
            minute = 45
            clock_source = "phase_fallback"
        elif phase == "first_half":
            minute = 0
            clock_source = "phase_fallback"

    display_minute = format_clock_display(phase, minute, status_type)

    # Keep status backward-compatible with consumers expecting halftime explicitly
    normalized_status = status_type
    if phase == "halftime":
        normalized_status = "halftime"

    # Get incidents
    events_list = []
    try:
        incidents_data = incidents_raw
        if isinstance(incidents_data, dict):
            incidents = incidents_data.get("incidents", [])
            unique_types = list({ev.get("incidentType") for ev in incidents if isinstance(ev, dict)})
            print(f"[incidents] match {match_id} types: {unique_types}", flush=True)
            for ev in incidents:
                if not isinstance(ev, dict):
                    continue
                inc_type = ev.get("incidentType")
                if inc_type not in ("goal", "card", "corner"):
                    continue

                minute_val = ev.get("time")
                is_home_val = ev.get("isHome")

                if inc_type in ("goal", "card"):
                    player_raw = ev.get("player", {})
                    assist_raw = ev.get("assist1", {})
                    incident_home_score = ev.get("homeScore")
                    incident_away_score = ev.get("awayScore")
                    events_list.append({
                        "type":      inc_type,
                        "class":     ev.get("incidentClass"),
                        "minute":    minute_val,
                        "isHome":    is_home_val,
                        "player":    player_raw.get("shortName") or player_raw.get("name") if isinstance(player_raw, dict) else None,
                        "assist":    assist_raw.get("shortName") or assist_raw.get("name") if isinstance(assist_raw, dict) else None,
                        "homeScore": incident_home_score,
                        "awayScore": incident_away_score,
                    })
                else:
                    # corner marker
                    events_list.append({
                        "type":      inc_type,
                        "class":     ev.get("incidentClass"),
                        "minute":    minute_val,
                        "isHome":    is_home_val,
                        "player":    None,
                        "assist":    None,
                        "homeScore": None,
                        "awayScore": None,
                    })
    except:
        pass

    # Shots from shotmap (incidents API doesn't have shot events)
    try:
        shots = shotmap_raw.get("shotmap", []) if isinstance(shotmap_raw, dict) else []
        for shot in shots:
            if not isinstance(shot, dict):
                continue
            shot_type = shot.get("shotType")
            minute_val = shot.get("time")
            is_home_val = shot.get("isHome")
            if minute_val is None:
                continue
            # shotType "save" = shot on target (goalkeeper saved); others = shot off target
            if shot_type == "save":
                normalized = "shotOnGoal"
            elif shot_type == "goal":
                continue  # already captured as goal incident
            else:
                normalized = "shot"
            events_list.append({
                "type":      normalized,
                "class":     shot_type,
                "minute":    minute_val,
                "isHome":    is_home_val,
                "player":    None,
                "assist":    None,
                "homeScore": None,
                "awayScore": None,
            })
    except:
        pass

    return {
        "matchId": match_id,
        "status": normalized_status,
        "minute": display_minute,
        "clock": {
            "minute": minute,
            "display": display_minute,
            "phase": phase,
            "period": period,
            "source": clock_source,
        },
        "homeScore": home_score,
        "awayScore": away_score,
        "events": events_list,
    }


@app.get("/match/{match_id}/stats")
async def match_stats(match_id: int):
    """Live match statistics: possession, shots, cards, etc."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.stats()
    except Exception as e:
        print(f"Stats error: {e}")
        return {"matchId": match_id, "stats": []}

    if not isinstance(data, dict):
        return {"matchId": match_id, "stats": []}

    stats = []
    
    # Try different possible structures
    statistics = data.get("statistics", [])
    
    if isinstance(statistics, list):
        # Pick the aggregate period ("ALL") — fall back to first entry if not found
        all_period = next(
            (p for p in statistics if isinstance(p, dict) and p.get("period") == "ALL"),
            statistics[0] if statistics else None,
        )
        period_groups = [all_period] if all_period else []
        seen = set()
        for period_group in period_groups:
            if isinstance(period_group, dict):
                groups = period_group.get("groups", [])
                if isinstance(groups, list):
                    for group in groups:
                        if isinstance(group, dict):
                            items = group.get("statisticsItems", [])
                            if isinstance(items, list):
                                for item in items:
                                    if isinstance(item, dict):
                                        name = item.get("name", "")
                                        if name in seen:
                                            continue
                                        seen.add(name)
                                        stats.append({
                                            "name": name,
                                            "home": item.get("home"),
                                            "away": item.get("away"),
                                        })

    return {
        "matchId": match_id,
        "stats": stats,
    }


@app.get("/match/{match_id}/shotmap")
async def match_shotmap(match_id: int):
    """Shot map: all shot attempts with coordinates, xG, body part, situation."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.shotmap()
            return data if isinstance(data, dict) else {"shotmap": []}
    except Exception as e:
        return {"shotmap": [], "error": str(e)}


@app.get("/match/{match_id}/heatmap/{team_id}")
async def match_heatmap(match_id: int, team_id: int):
    """Team heatmap: player activity coordinates on the pitch."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.heatmap(team_id)
            return data if isinstance(data, dict) else {"playerPoints": []}
    except Exception as e:
        return {"playerPoints": [], "error": str(e)}


@app.get("/match/{match_id}/win-probability")
async def match_win_probability(match_id: int):
    """Win probability graph over time."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.win_probability()
            return data if isinstance(data, dict) else {"available": False}
    except Exception:
        return {"available": False}


@app.get("/match/{match_id}/votes")
async def match_votes(match_id: int):
    """User votes: 1X2, BTTS, first scorer."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.votes()
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@app.get("/match/{match_id}/odds-all")
async def match_odds_all(match_id: int):
    """All available odds markets (1X2, handicap, over/under, etc)."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.match_odds()
            return data if isinstance(data, dict) else {"markets": []}
    except Exception:
        return {"markets": []}


@app.get("/match/{match_id}/managers")
async def match_managers(match_id: int):
    """Managers/coaches for both teams."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.managers()
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@app.get("/match/{match_id}/commentary")
async def match_commentary(match_id: int):
    """Live text commentary for the match."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.commentary()
            return data if isinstance(data, dict) else {"comments": []}
    except Exception:
        return {"comments": []}


@app.get("/match/{match_id}/highlights")
async def match_highlights(match_id: int):
    """Highlight videos (YouTube links)."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.highlight()
            return data if isinstance(data, dict) else {"highlights": []}
    except Exception:
        return {"highlights": []}


@app.get("/match/{match_id}/team-streaks")
async def match_team_streaks(match_id: int):
    """Current team streaks for both teams in this match."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            data = await match.team_streaks()
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@app.get("/match/{match_id}/h2h-events")
async def match_h2h_events(match_id: int):
    """Detailed H2H event list with scores and dates."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            # First get match to find the customId
            match_data = await match.get_match()
            event = match_data.get("event", {}) if isinstance(match_data, dict) else {}
            custom_id = event.get("customId") if isinstance(event, dict) else None

            if not custom_id:
                return {"events": []}

            data = await match.h2h_results(custom_id)

            events_raw = data.get("events", []) if isinstance(data, dict) else []
            parsed = []
            for ev in events_raw[:10]:
                try:
                    parsed.append({
                        "homeTeam":  ev["homeTeam"]["name"],
                        "awayTeam":  ev["awayTeam"]["name"],
                        "homeScore": ev.get("homeScore", {}).get("current"),
                        "awayScore": ev.get("awayScore", {}).get("current"),
                        "date": datetime.fromtimestamp(ev["startTimestamp"], tz=timezone.utc).strftime("%Y-%m-%d"),
                        "tournament": ev.get("tournament", {}).get("name", ""),
                    })
                except Exception:
                    continue

            return {"events": parsed}
    except Exception as e:
        return {"events": [], "error": str(e)}


@app.get("/match/{match_id}/best-players")
async def match_best_players(match_id: int):
    """Best rated players + Man of the Match."""
    try:
        async with pool_api() as api:
            match = Match(api, match_id=match_id)
            home = await match.best_home_players()
            away = await match.best_away_players()
            motm_data = await match.motm()

            def parse_players(players):
                if not players:
                    return []
                return [
                    {
                        "name": p.get("player", {}).get("name"),
                        "rating": p.get("value"),
                        "position": p.get("player", {}).get("position"),
                    }
                    for p in players[:3]
                ]

            return {
                "home": parse_players(home),
                "away": parse_players(away),
                "motm": {
                    "name": motm_data.get("player", {}).get("name") if motm_data else None,
                    "rating": motm_data.get("value") if motm_data else None,
                } if motm_data else None,
            }
    except Exception:
        return {"home": [], "away": [], "motm": None}


@app.get("/team/{team_id}/squad")
async def team_squad(team_id: int):
    """Full squad with positions and market values."""
    from sofascore_wrapper.team import Team
    try:
        async with pool_api() as api:
            team = Team(api, team_id=team_id)
            data = await team.squad()
            players_raw = data.get("players", []) if isinstance(data, dict) else []
            players = []
            for entry in players_raw:
                p = entry.get("player", {})
                players.append({
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "shortName": p.get("shortName"),
                    "position": p.get("position"),
                    "jerseyNumber": p.get("jerseyNumber"),
                    "height": p.get("height"),
                    "dateOfBirth": p.get("dateOfBirthTimestamp"),
                    "marketValue": p.get("proposedMarketValueRaw", {}).get("value"),
                    "marketValueCurrency": p.get("marketValueCurrency"),
                    "country": p.get("country", {}).get("name") if isinstance(p.get("country"), dict) else None,
                })
            return {"teamId": team_id, "players": players}
    except Exception as e:
        return {"teamId": team_id, "players": [], "error": str(e)}


@app.get("/match/{match_id}/graph")
async def match_graph(match_id: int):
    """Attack momentum graph — series of {minute, value} points.
    Positive value = home pressure, negative = away pressure."""
    try:
        async with pool_api() as api:
            data = await api._get(f"/event/{match_id}/graph")
        points = data.get("graphPoints", [])
        return {
            "periodTime": data.get("periodTime"),
            "periodCount": data.get("periodCount"),
            "points": [{"minute": p["minute"], "value": p["value"]} for p in points],
        }
    except Exception as e:
        return {"points": [], "error": str(e)}


@app.get("/team/{team_id}/image")
async def team_image(team_id: int):
    """Proxy Sofascore team badge through authenticated Playwright session."""
    from fastapi.responses import Response
    try:
        async with pool_api() as api:
            await api._init_browser()
            url = f"https://img.sofascore.com/api/v1/team/{team_id}/image"
            response = await api.page.goto(url)
            if response and response.status == 200:
                body = await response.body()
                ct = response.headers.get("content-type", "image/png")
                return Response(content=body, media_type=ct)
            raise HTTPException(status_code=404, detail="Image not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
