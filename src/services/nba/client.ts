const BALLDONTLIE_BASE = 'https://api.balldontlie.io/v1';
const NBA_API_KEY = import.meta.env.VITE_NBA_API_KEY || '';

interface NbaGame {
  id: number;
  date: string;
  season: number;
  status: string;
  period: number;
  time: string;
  postseason: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: NbaTeam;
  visitor_team: NbaTeam;
}

interface NbaTeam {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

interface NbaPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number;
  draft_round: number;
  draft_number: number;
  team: NbaTeam;
}

interface PlayerStats {
  id: number;
  min: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  player: NbaPlayer;
  game: NbaGame;
  team: NbaTeam;
}

interface TeamStanding {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  percentage: number;
  conference_record: string;
  home_record: string;
  road_record: string;
  streak: number;
}

interface InjuryReport {
  id: number;
  status: string;
  comment: string;
  date: string;
  return_date: string | null;
  player: NbaPlayer;
  team: NbaTeam;
}

async function nbaFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BALLDONTLIE_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (NBA_API_KEY) {
    headers['Authorization'] = NBA_API_KEY;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`NBA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getTodayGames(): Promise<NbaGame[]> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = await nbaFetch<{ data: NbaGame[] }>('/games', {
      'dates[]': today,
      per_page: '20',
    });
    return data.data || [];
  } catch {
    return getMockGames();
  }
}

export async function getGamesByDate(date: string): Promise<NbaGame[]> {
  try {
    const data = await nbaFetch<{ data: NbaGame[] }>('/games', {
      'dates[]': date,
      per_page: '20',
    });
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getPlayoffGames(season: number = 2025): Promise<NbaGame[]> {
  try {
    const data = await nbaFetch<{ data: NbaGame[] }>('/games', {
      'seasons[]': season.toString(),
      postseason: 'true',
      per_page: '100',
    });
    return data.data || [];
  } catch {
    return getMockGames();
  }
}

export async function getTeams(): Promise<NbaTeam[]> {
  try {
    const data = await nbaFetch<{ data: NbaTeam[] }>('/teams');
    return data.data || [];
  } catch {
    return getMockTeams();
  }
}

export async function getStandings(): Promise<TeamStanding[]> {
  try {
    const data = await nbaFetch<{ data: TeamStanding[] }>('/standings');
    return data.data || [];
  } catch {
    return getMockStandings();
  }
}

export async function getInjuries(): Promise<InjuryReport[]> {
  try {
    const data = await nbaFetch<{ data: InjuryReport[] }>('/injuries');
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getPlayerStats(gameIds?: number[]): Promise<PlayerStats[]> {
  try {
    const params: Record<string, string> = {
      per_page: '50',
    };
    if (gameIds?.length) {
      gameIds.forEach(id => {
        params['game_ids[]'] = id.toString();
      });
    }
    const data = await nbaFetch<{ data: PlayerStats[] }>('/stats', params);
    return data.data || [];
  } catch {
    return [];
  }
}

function getMockGames(): NbaGame[] {
  const teams = getMockTeams();
  return [
    {
      id: 1, date: new Date().toISOString(), season: 2025,
      status: 'In Progress', period: 3, time: '6:30',
      postseason: true, home_team_score: 78, visitor_team_score: 72,
      home_team: teams[0], visitor_team: teams[1],
    },
    {
      id: 2, date: new Date().toISOString(), season: 2025,
      status: 'Scheduled', period: 0, time: '',
      postseason: true, home_team_score: 0, visitor_team_score: 0,
      home_team: teams[2], visitor_team: teams[3],
    },
    {
      id: 3, date: new Date().toISOString(), season: 2025,
      status: 'Final', period: 4, time: '',
      postseason: true, home_team_score: 112, visitor_team_score: 105,
      home_team: teams[4], visitor_team: teams[5],
    },
    {
      id: 4, date: new Date().toISOString(), season: 2025,
      status: 'Scheduled', period: 0, time: '',
      postseason: true, home_team_score: 0, visitor_team_score: 0,
      home_team: teams[6], visitor_team: teams[7],
    },
  ];
}

function getMockTeams(): NbaTeam[] {
  return [
    { id: 1, conference: 'East', division: 'Atlantic', city: 'Boston', name: 'Celtics', full_name: 'Boston Celtics', abbreviation: 'BOS' },
    { id: 2, conference: 'East', division: 'Central', city: 'Cleveland', name: 'Cavaliers', full_name: 'Cleveland Cavaliers', abbreviation: 'CLE' },
    { id: 3, conference: 'West', division: 'Northwest', city: 'Oklahoma City', name: 'Thunder', full_name: 'Oklahoma City Thunder', abbreviation: 'OKC' },
    { id: 4, conference: 'West', division: 'Pacific', city: 'Denver', name: 'Nuggets', full_name: 'Denver Nuggets', abbreviation: 'DEN' },
    { id: 5, conference: 'East', division: 'Atlantic', city: 'New York', name: 'Knicks', full_name: 'New York Knicks', abbreviation: 'NYK' },
    { id: 6, conference: 'East', division: 'Southeast', city: 'Miami', name: 'Heat', full_name: 'Miami Heat', abbreviation: 'MIA' },
    { id: 7, conference: 'West', division: 'Pacific', city: 'Los Angeles', name: 'Lakers', full_name: 'Los Angeles Lakers', abbreviation: 'LAL' },
    { id: 8, conference: 'West', division: 'Southwest', city: 'Houston', name: 'Rockets', full_name: 'Houston Rockets', abbreviation: 'HOU' },
  ];
}

function getMockStandings(): TeamStanding[] {
  const teams = getMockTeams();
  return teams.map((t, i) => ({
    ...t,
    wins: 55 - i * 3,
    losses: 10 + i * 3,
    percentage: parseFloat(((55 - i * 3) / (65)).toFixed(3)),
    conference_record: `${35 - i}-${5 + i}`,
    home_record: `${28 - i}-${3 + i}`,
    road_record: `${27 - i}-${7 + i}`,
    streak: i < 4 ? 3 - i : -(i - 3),
  }));
}

export type { NbaGame, NbaTeam, NbaPlayer, PlayerStats, TeamStanding, InjuryReport };
