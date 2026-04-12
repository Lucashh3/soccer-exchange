# Sofascore unique_tournament_id → { name, country }
# Validated against sofascore.com tournament URLs
LEAGUE_IDS: dict[int, dict] = {
    # Europa — competições de clube
    7:     {"name": "Champions League",    "country": "Europe"},
    679:   {"name": "Europa League",       "country": "Europe"},
    17015: {"name": "Conference League",   "country": "Europe"},

    # Inglaterra
    17:    {"name": "Premier League",      "country": "England"},
    18:    {"name": "Championship",        "country": "England"},
    1:     {"name": "FA Cup",              "country": "England"},

    # Espanha
    8:     {"name": "La Liga",             "country": "Spain"},
    329:   {"name": "Copa del Rey",        "country": "Spain"},

    # Alemanha
    35:    {"name": "Bundesliga",          "country": "Germany"},
    36:    {"name": "2. Bundesliga",       "country": "Germany"},

    # Itália
    23:    {"name": "Serie A",             "country": "Italy"},

    # França
    34:    {"name": "Ligue 1",             "country": "France"},

    # Portugal
    238:   {"name": "Primeira Liga",       "country": "Portugal"},

    # Holanda
    37:    {"name": "Eredivisie",          "country": "Netherlands"},

    # Brasil
    325:   {"name": "Brasileirão Série A", "country": "Brazil"},
    390:   {"name": "Copa do Brasil",      "country": "Brazil"},

    # CONMEBOL — competições de clube (masculino)
    384:   {"name": "CONMEBOL Libertadores", "country": "South America"},
    480:   {"name": "CONMEBOL Sudamericana", "country": "South America"},

    # EUA
    242:   {"name": "MLS",                 "country": "USA"},
}

LEAGUE_ID_SET = set(LEAGUE_IDS.keys())
