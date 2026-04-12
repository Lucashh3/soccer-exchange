const TEAM_NAME_MAP: Record<string, string> = {
  // Spanish clubs
  'fc barcelona': 'Barcelona',
  'real madrid cf': 'Real Madrid',
  'atletico madrid': 'Atlético Madrid',
  'atletico de madrid': 'Atlético Madrid',
  'sevilla fc': 'Sevilla',
  'valencia cf': 'Valencia',
  'villarreal cf': 'Villarreal',
  'real sociedad': 'Real Sociedad',
  'athletic bilbao': 'Athletic Bilbao',
  'athletic club': 'Athletic Bilbao',
  // English clubs
  'manchester city fc': 'Manchester City',
  'manchester united fc': 'Manchester United',
  'liverpool fc': 'Liverpool',
  'chelsea fc': 'Chelsea',
  'arsenal fc': 'Arsenal',
  'tottenham hotspur fc': 'Tottenham Hotspur',
  'tottenham hotspur': 'Tottenham Hotspur',
  'leicester city fc': 'Leicester City',
  'west ham united fc': 'West Ham United',
  'everton fc': 'Everton',
  // Italian clubs
  'juventus fc': 'Juventus',
  'ac milan': 'AC Milan',
  'inter milan': 'Inter Milan',
  'fc internazionale milano': 'Inter Milan',
  'as roma': 'Roma',
  'ssc napoli': 'Napoli',
  'atalanta bc': 'Atalanta',
  'ss lazio': 'Lazio',
  'acf fiorentina': 'Fiorentina',
  // German clubs
  'fc bayern münchen': 'Bayern Munich',
  'fc bayern munich': 'Bayern Munich',
  'borussia dortmund': 'Borussia Dortmund',
  'rb leipzig': 'RB Leipzig',
  'bayer 04 leverkusen': 'Bayer Leverkusen',
  // French clubs
  'paris saint-germain fc': 'PSG',
  'paris saint-germain': 'PSG',
  'olympique de marseille': 'Marseille',
  'olympique lyonnais': 'Lyon',
  'stade rennais fc': 'Rennes',
  'lille osc': 'Lille',
  'as monaco fc': 'Monaco',
  // Brazilian clubs
  'sport club corinthians paulista': 'Corinthians',
  'se palmeiras': 'Palmeiras',
  'santos fc': 'Santos',
  'clube de regatas do flamengo': 'Flamengo',
  'clube de regatas vasco da gama': 'Vasco da Gama',
  'fluminense football club': 'Fluminense',
  'cruzeiro esporte clube': 'Cruzeiro',
  'atletico mineiro': 'Atlético Mineiro',
  'grêmio fbpa': 'Grêmio',
  'sport club internacional': 'Internacional',
  // Portuguese clubs
  'sl benfica': 'Benfica',
  'fc porto': 'Porto',
  'sporting cp': 'Sporting CP',
  'sporting clube de portugal': 'Sporting CP',
}

export function normalizeTeamName(name: string): string {
  if (!name) return name
  const lower = name.trim().toLowerCase()
  const mapped = TEAM_NAME_MAP[lower]
  if (mapped) return mapped
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
