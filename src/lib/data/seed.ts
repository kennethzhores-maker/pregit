import type {
  Competition,
  FixtureListItem,
  FixtureStatus,
  Injury,
  LineupEntry,
  MatchDetail,
  Player,
  PlayerStats,
  Team,
  TeamStats,
} from "@/lib/data/types";
import { parseForm, resolveLineupStatus } from "@/lib/data/types";

export const SEASON = 2025;

export const COMPETITION: Competition = {
  id: "pl",
  externalId: "39",
  name: "Premier League",
  country: "England",
  season: SEASON,
};

export const TEAMS: Team[] = [
  {
    id: "liv",
    externalId: "40",
    competitionId: "pl",
    name: "Liverpool",
    shortName: "LIV",
    tla: "LIV",
    crestUrl: null,
    venue: "Anfield",
  },
  {
    id: "che",
    externalId: "49",
    competitionId: "pl",
    name: "Chelsea",
    shortName: "CHE",
    tla: "CHE",
    crestUrl: null,
    venue: "Stamford Bridge",
  },
  {
    id: "mci",
    externalId: "50",
    competitionId: "pl",
    name: "Manchester City",
    shortName: "MCI",
    tla: "MCI",
    crestUrl: null,
    venue: "Etihad Stadium",
  },
  {
    id: "ars",
    externalId: "42",
    competitionId: "pl",
    name: "Arsenal",
    shortName: "ARS",
    tla: "ARS",
    crestUrl: null,
    venue: "Emirates Stadium",
  },
  {
    id: "mun",
    externalId: "33",
    competitionId: "pl",
    name: "Manchester United",
    shortName: "MUN",
    tla: "MUN",
    crestUrl: null,
    venue: "Old Trafford",
  },
  {
    id: "tot",
    externalId: "47",
    competitionId: "pl",
    name: "Tottenham",
    shortName: "TOT",
    tla: "TOT",
    crestUrl: null,
    venue: "Tottenham Hotspur Stadium",
  },
  {
    id: "new",
    externalId: "34",
    competitionId: "pl",
    name: "Newcastle",
    shortName: "NEW",
    tla: "NEW",
    crestUrl: null,
    venue: "St James' Park",
  },
  {
    id: "avl",
    externalId: "66",
    competitionId: "pl",
    name: "Aston Villa",
    shortName: "AVL",
    tla: "AVL",
    crestUrl: null,
    venue: "Villa Park",
  },
];

type SeedPlayer = Omit<Player, "externalId"> & { externalId?: string | null };

function squad(
  teamId: string,
  rows: Array<[string, string, Player["position"], number, string]>,
): SeedPlayer[] {
  return rows.map(([id, name, position, shirtNumber, nationality]) => ({
    id,
    externalId: null,
    teamId,
    name,
    position,
    shirtNumber,
    nationality,
  }));
}

export const PLAYERS: SeedPlayer[] = [
  ...squad("liv", [
    ["liv-gk", "Alisson", "GK", 1, "Brazil"],
    ["liv-df1", "Virgil van Dijk", "DF", 4, "Netherlands"],
    ["liv-df2", "Trent Alexander-Arnold", "DF", 66, "England"],
    ["liv-df3", "Andy Robertson", "DF", 26, "Scotland"],
    ["liv-df4", "Ibrahima Konaté", "DF", 5, "France"],
    ["liv-mf1", "Alexis Mac Allister", "MF", 10, "Argentina"],
    ["liv-mf2", "Dominik Szoboszlai", "MF", 8, "Hungary"],
    ["liv-mf3", "Ryan Gravenberch", "MF", 38, "Netherlands"],
    ["liv-fw1", "Mohamed Salah", "FW", 11, "Egypt"],
    ["liv-fw2", "Luis Díaz", "FW", 7, "Colombia"],
    ["liv-fw3", "Darwin Núñez", "FW", 9, "Uruguay"],
    ["liv-fw4", "Diogo Jota", "FW", 20, "Portugal"],
  ]),
  ...squad("che", [
    ["che-gk", "Robert Sánchez", "GK", 1, "Spain"],
    ["che-df1", "Levi Colwill", "DF", 6, "England"],
    ["che-df2", "Reece James", "DF", 24, "England"],
    ["che-df3", "Marc Cucurella", "DF", 3, "Spain"],
    ["che-df4", "Wesley Fofana", "DF", 29, "France"],
    ["che-mf1", "Enzo Fernández", "MF", 8, "Argentina"],
    ["che-mf2", "Moises Caicedo", "MF", 25, "Ecuador"],
    ["che-mf3", "Cole Palmer", "MF", 20, "England"],
    ["che-fw1", "Nicolas Jackson", "FW", 15, "Senegal"],
    ["che-fw2", "Noni Madueke", "FW", 11, "England"],
    ["che-fw3", "Pedro Neto", "FW", 7, "Portugal"],
    ["che-fw4", "Christopher Nkunku", "FW", 18, "France"],
  ]),
  ...squad("ars", [
    ["ars-gk", "David Raya", "GK", 22, "Spain"],
    ["ars-df1", "William Saliba", "DF", 2, "France"],
    ["ars-df2", "Gabriel Magalhães", "DF", 6, "Brazil"],
    ["ars-df3", "Ben White", "DF", 4, "England"],
    ["ars-df4", "Oleksandr Zinchenko", "DF", 35, "Ukraine"],
    ["ars-mf1", "Declan Rice", "MF", 41, "England"],
    ["ars-mf2", "Martin Ødegaard", "MF", 8, "Norway"],
    ["ars-mf3", "Thomas Partey", "MF", 5, "Ghana"],
    ["ars-fw1", "Bukayo Saka", "FW", 7, "England"],
    ["ars-fw2", "Kai Havertz", "FW", 29, "Germany"],
    ["ars-fw3", "Gabriel Martinelli", "FW", 11, "Brazil"],
    ["ars-fw4", "Leandro Trossard", "FW", 19, "Belgium"],
  ]),
  ...squad("mci", [
    ["mci-gk", "Ederson", "GK", 31, "Brazil"],
    ["mci-df1", "Rúben Dias", "DF", 3, "Portugal"],
    ["mci-df2", "Kyle Walker", "DF", 2, "England"],
    ["mci-df3", "Josko Gvardiol", "DF", 24, "Croatia"],
    ["mci-df4", "John Stones", "DF", 5, "England"],
    ["mci-mf1", "Rodri", "MF", 16, "Spain"],
    ["mci-mf2", "Kevin De Bruyne", "MF", 17, "Belgium"],
    ["mci-mf3", "Bernardo Silva", "MF", 20, "Portugal"],
    ["mci-fw1", "Erling Haaland", "FW", 9, "Norway"],
    ["mci-fw2", "Phil Foden", "FW", 47, "England"],
    ["mci-fw3", "Jeremy Doku", "FW", 11, "Belgium"],
    ["mci-fw4", "Julián Álvarez", "FW", 19, "Argentina"],
  ]),
  ...squad("mun", [
    ["mun-gk", "André Onana", "GK", 24, "Cameroon"],
    ["mun-df1", "Lisandro Martínez", "DF", 6, "Argentina"],
    ["mun-df2", "Harry Maguire", "DF", 5, "England"],
    ["mun-df3", "Diogo Dalot", "DF", 20, "Portugal"],
    ["mun-df4", "Luke Shaw", "DF", 23, "England"],
    ["mun-mf1", "Bruno Fernandes", "MF", 8, "Portugal"],
    ["mun-mf2", "Kobbie Mainoo", "MF", 37, "England"],
    ["mun-mf3", "Casemiro", "MF", 18, "Brazil"],
    ["mun-fw1", "Marcus Rashford", "FW", 10, "England"],
    ["mun-fw2", "Rasmus Højlund", "FW", 9, "Denmark"],
    ["mun-fw3", "Alejandro Garnacho", "FW", 17, "Argentina"],
    ["mun-fw4", "Amad Diallo", "FW", 16, "Ivory Coast"],
  ]),
  ...squad("tot", [
    ["tot-gk", "Guglielmo Vicario", "GK", 1, "Italy"],
    ["tot-df1", "Cristian Romero", "DF", 17, "Argentina"],
    ["tot-df2", "Micky van de Ven", "DF", 37, "Netherlands"],
    ["tot-df3", "Pedro Porro", "DF", 23, "Spain"],
    ["tot-df4", "Destiny Udogie", "DF", 13, "Italy"],
    ["tot-mf1", "James Maddison", "MF", 10, "England"],
    ["tot-mf2", "Pape Matar Sarr", "MF", 29, "Senegal"],
    ["tot-mf3", "Yves Bissouma", "MF", 8, "Mali"],
    ["tot-fw1", "Son Heung-min", "FW", 7, "South Korea"],
    ["tot-fw2", "Brennan Johnson", "FW", 22, "Wales"],
    ["tot-fw3", "Richarlison", "FW", 9, "Brazil"],
    ["tot-fw4", "Dejan Kulusevski", "FW", 21, "Sweden"],
  ]),
  ...squad("new", [
    ["new-gk", "Nick Pope", "GK", 22, "England"],
    ["new-df1", "Sven Botman", "DF", 4, "Netherlands"],
    ["new-df2", "Fabian Schär", "DF", 5, "Switzerland"],
    ["new-df3", "Kieran Trippier", "DF", 2, "England"],
    ["new-df4", "Dan Burn", "DF", 33, "England"],
    ["new-mf1", "Bruno Guimarães", "MF", 39, "Brazil"],
    ["new-mf2", "Joelinton", "MF", 7, "Brazil"],
    ["new-mf3", "Sandro Tonali", "MF", 8, "Italy"],
    ["new-fw1", "Alexander Isak", "FW", 14, "Sweden"],
    ["new-fw2", "Anthony Gordon", "FW", 10, "England"],
    ["new-fw3", "Harvey Barnes", "FW", 11, "England"],
    ["new-fw4", "Jacob Murphy", "FW", 23, "England"],
  ]),
  ...squad("avl", [
    ["avl-gk", "Emiliano Martínez", "GK", 23, "Argentina"],
    ["avl-df1", "Pau Torres", "DF", 14, "Spain"],
    ["avl-df2", "Ezri Konsa", "DF", 4, "England"],
    ["avl-df3", "Matty Cash", "DF", 2, "Poland"],
    ["avl-df4", "Lucas Digne", "DF", 12, "France"],
    ["avl-mf1", "Youri Tielemans", "MF", 8, "Belgium"],
    ["avl-mf2", "Boubacar Kamara", "MF", 44, "France"],
    ["avl-mf3", "John McGinn", "MF", 7, "Scotland"],
    ["avl-fw1", "Ollie Watkins", "FW", 11, "England"],
    ["avl-fw2", "Morgan Rogers", "FW", 27, "England"],
    ["avl-fw3", "Leon Bailey", "FW", 31, "Jamaica"],
    ["avl-fw4", "Jhon Durán", "FW", 9, "Colombia"],
  ]),
];

export const TEAM_STATS: TeamStats[] = [
  {
    teamId: "liv",
    season: SEASON,
    played: 5,
    wins: 4,
    draws: 1,
    losses: 0,
    goalsFor: 12,
    goalsAgainst: 4,
    form: parseForm("WWDWW"),
    homeForm: parseForm("WWWDW"),
    awayForm: parseForm("WDWWW"),
  },
  {
    teamId: "che",
    season: SEASON,
    played: 5,
    wins: 2,
    draws: 1,
    losses: 2,
    goalsFor: 8,
    goalsAgainst: 7,
    form: parseForm("WLWDL"),
    homeForm: parseForm("WDLWW"),
    awayForm: parseForm("LWLDW"),
  },
  {
    teamId: "mci",
    season: SEASON,
    played: 5,
    wins: 4,
    draws: 1,
    losses: 0,
    goalsFor: 14,
    goalsAgainst: 5,
    form: parseForm("WWWDW"),
    homeForm: parseForm("WWWWW"),
    awayForm: parseForm("WWDWW"),
  },
  {
    teamId: "ars",
    season: SEASON,
    played: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    goalsFor: 10,
    goalsAgainst: 5,
    form: parseForm("WDWWL"),
    homeForm: parseForm("WWWWD"),
    awayForm: parseForm("WDWLW"),
  },
  {
    teamId: "mun",
    season: SEASON,
    played: 5,
    wins: 2,
    draws: 1,
    losses: 2,
    goalsFor: 6,
    goalsAgainst: 8,
    form: parseForm("LWDLW"),
    homeForm: parseForm("WDLWW"),
    awayForm: parseForm("LLWDL"),
  },
  {
    teamId: "tot",
    season: SEASON,
    played: 5,
    wins: 2,
    draws: 1,
    losses: 2,
    goalsFor: 9,
    goalsAgainst: 8,
    form: parseForm("WLLWD"),
    homeForm: parseForm("WLWDW"),
    awayForm: parseForm("LLWLD"),
  },
  {
    teamId: "new",
    season: SEASON,
    played: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    goalsFor: 9,
    goalsAgainst: 5,
    form: parseForm("DWWLW"),
    homeForm: parseForm("WWWDW"),
    awayForm: parseForm("DWLLW"),
  },
  {
    teamId: "avl",
    season: SEASON,
    played: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    goalsFor: 8,
    goalsAgainst: 6,
    form: parseForm("WDLWW"),
    homeForm: parseForm("WDWWW"),
    awayForm: parseForm("DLWWL"),
  },
];

export const PLAYER_STATS: PlayerStats[] = PLAYERS.map((player, index) => {
  const isAttacker = player.position === "FW" || player.position === "MF";
  return {
    playerId: player.id,
    season: SEASON,
    appearances: 4 + (index % 2),
    minutes: 280 + (index % 5) * 35,
    goals: isAttacker ? (index % 5) : 0,
    assists: isAttacker ? (index % 3) : index % 2,
    yellowCards: index % 4 === 0 ? 1 : 0,
    redCards: 0,
    rating: Number((6.6 + (index % 7) * 0.15).toFixed(2)),
  };
});

type SeedFixture = {
  id: string;
  externalId: string | null;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string;
  venue: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  referee: string | null;
  round: string | null;
};

export const FIXTURES: SeedFixture[] = [
  {
    id: "fx-001",
    externalId: "1200001",
    competitionId: "pl",
    homeTeamId: "liv",
    awayTeamId: "che",
    kickoff: "2026-08-15T16:30:00+01:00",
    venue: "Anfield",
    status: "lineups",
    homeScore: null,
    awayScore: null,
    referee: "Michael Oliver",
    round: "Matchday 2",
  },
  {
    id: "fx-002",
    externalId: "1200002",
    competitionId: "pl",
    homeTeamId: "ars",
    awayTeamId: "tot",
    kickoff: "2026-08-16T14:00:00+01:00",
    venue: "Emirates Stadium",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    referee: "Anthony Taylor",
    round: "Matchday 2",
  },
  {
    id: "fx-003",
    externalId: "1200003",
    competitionId: "pl",
    homeTeamId: "mci",
    awayTeamId: "mun",
    kickoff: "2026-08-16T16:30:00+01:00",
    venue: "Etihad Stadium",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    referee: "Paul Tierney",
    round: "Matchday 2",
  },
  {
    id: "fx-004",
    externalId: "1200004",
    competitionId: "pl",
    homeTeamId: "new",
    awayTeamId: "avl",
    kickoff: "2026-08-17T15:00:00+01:00",
    venue: "St James' Park",
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    referee: "Craig Pawson",
    round: "Matchday 2",
  },
  {
    id: "fx-005",
    externalId: "1200005",
    competitionId: "pl",
    homeTeamId: "che",
    awayTeamId: "ars",
    kickoff: "2026-08-09T15:00:00+01:00",
    venue: "Stamford Bridge",
    status: "finished",
    homeScore: 1,
    awayScore: 2,
    referee: "Stuart Attwell",
    round: "Matchday 1",
  },
  {
    id: "fx-006",
    externalId: "1200006",
    competitionId: "pl",
    homeTeamId: "mun",
    awayTeamId: "liv",
    kickoff: "2026-08-09T17:30:00+01:00",
    venue: "Old Trafford",
    status: "live",
    homeScore: 0,
    awayScore: 1,
    referee: "David Coote",
    round: "Matchday 1",
  },
  {
    id: "fx-h2h-1",
    externalId: "1100001",
    competitionId: "pl",
    homeTeamId: "che",
    awayTeamId: "liv",
    kickoff: "2026-01-20T20:00:00+00:00",
    venue: "Stamford Bridge",
    status: "finished",
    homeScore: 0,
    awayScore: 1,
    referee: "Anthony Taylor",
    round: "Matchday 22",
  },
  {
    id: "fx-h2h-2",
    externalId: "1100002",
    competitionId: "pl",
    homeTeamId: "liv",
    awayTeamId: "che",
    kickoff: "2025-10-05T16:30:00+01:00",
    venue: "Anfield",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    referee: "Michael Oliver",
    round: "Matchday 7",
  },
  {
    id: "fx-h2h-3",
    externalId: "1100003",
    competitionId: "pl",
    homeTeamId: "liv",
    awayTeamId: "che",
    kickoff: "2025-04-13T16:30:00+01:00",
    venue: "Anfield",
    status: "finished",
    homeScore: 2,
    awayScore: 2,
    referee: "Paul Tierney",
    round: "Matchday 32",
  },
];

function starters(teamId: string, playerIds: string[]): LineupEntry[] {
  const statsByPlayer = new Map(PLAYER_STATS.map((s) => [s.playerId, s]));
  return playerIds.map((playerId) => {
    const player = PLAYERS.find((p) => p.id === playerId)!;
    const stats = statsByPlayer.get(playerId);
    return {
      playerId,
      teamId,
      playerName: player.name,
      isStarter: true,
      position: player.position,
      shirtNumber: player.shirtNumber,
      rating: stats?.rating ?? null,
      goals: stats?.goals ?? 0,
      assists: stats?.assists ?? 0,
    };
  });
}

export const LINEUPS: Record<string, { home: LineupEntry[]; away: LineupEntry[] }> =
  {
    "fx-001": {
      home: starters("liv", [
        "liv-gk",
        "liv-df2",
        "liv-df1",
        "liv-df4",
        "liv-df3",
        "liv-mf3",
        "liv-mf1",
        "liv-mf2",
        "liv-fw1",
        "liv-fw3",
        "liv-fw2",
      ]),
      away: starters("che", [
        "che-gk",
        "che-df2",
        "che-df1",
        "che-df3",
        "che-mf2",
        "che-mf1",
        "che-mf3",
        "che-fw2",
        "che-fw1",
        "che-fw3",
        "che-fw4",
      ]),
    },
    "fx-006": {
      home: starters("mun", [
        "mun-gk",
        "mun-df3",
        "mun-df2",
        "mun-df1",
        "mun-mf3",
        "mun-mf2",
        "mun-mf1",
        "mun-fw3",
        "mun-fw2",
        "mun-fw1",
        "mun-fw4",
      ]),
      away: starters("liv", [
        "liv-gk",
        "liv-df2",
        "liv-df1",
        "liv-df4",
        "liv-df3",
        "liv-mf3",
        "liv-mf1",
        "liv-mf2",
        "liv-fw1",
        "liv-fw3",
        "liv-fw2",
      ]),
    },
  };

export const INJURIES: Injury[] = [
  {
    id: "inj-1",
    playerId: "che-df4",
    teamId: "che",
    playerName: "Wesley Fofana",
    injuryType: "Knee",
    reason: "Knee injury",
    isActive: true,
  },
  {
    id: "inj-2",
    playerId: "liv-fw4",
    teamId: "liv",
    playerName: "Diogo Jota",
    injuryType: "Muscle",
    reason: "Thigh strain",
    isActive: true,
  },
  {
    id: "inj-3",
    playerId: "mun-df4",
    teamId: "mun",
    playerName: "Luke Shaw",
    injuryType: "Muscle",
    reason: "Hamstring",
    isActive: true,
  },
];

function teamById(id: string) {
  return TEAMS.find((t) => t.id === id)!;
}

function statsByTeam(id: string) {
  return TEAM_STATS.find((t) => t.teamId === id) ?? null;
}

export function listSeedFixtures(): FixtureListItem[] {
  return FIXTURES.filter((fixture) => !fixture.id.startsWith("fx-h2h-"))
    .map((fixture) => {
      const home = teamById(fixture.homeTeamId);
      const away = teamById(fixture.awayTeamId);
      const homeStats = statsByTeam(home.id);
      const awayStats = statsByTeam(away.id);
      const lineups = LINEUPS[fixture.id];
      const homeCount = lineups?.home.length ?? 0;
      const awayCount = lineups?.away.length ?? 0;

      return {
        id: fixture.id,
        competition: COMPETITION.name,
        kickoff: fixture.kickoff,
        venue: fixture.venue,
        status: fixture.status,
        home: {
          id: home.id,
          name: home.name,
          shortName: home.shortName,
          form: homeStats?.form ?? [],
        },
        away: {
          id: away.id,
          name: away.name,
          shortName: away.shortName,
          form: awayStats?.form ?? [],
        },
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        lineupStatus: resolveLineupStatus(fixture.status, homeCount, awayCount),
      };
    })
    .sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    );
}

function headToHeadFor(homeTeamId: string, awayTeamId: string) {
  return FIXTURES.filter(
    (fixture) =>
      fixture.status === "finished" &&
      fixture.homeScore !== null &&
      fixture.awayScore !== null &&
      ((fixture.homeTeamId === homeTeamId && fixture.awayTeamId === awayTeamId) ||
        (fixture.homeTeamId === awayTeamId && fixture.awayTeamId === homeTeamId)),
  )
    .sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime(),
    )
    .slice(0, 5)
    .map((fixture) => ({
      id: fixture.id,
      kickoff: fixture.kickoff,
      homeName: teamById(fixture.homeTeamId).name,
      awayName: teamById(fixture.awayTeamId).name,
      homeScore: fixture.homeScore as number,
      awayScore: fixture.awayScore as number,
    }));
}

export function getSeedMatchDetail(id: string): MatchDetail | null {
  const fixture = FIXTURES.find((f) => f.id === id);
  if (!fixture || fixture.id.startsWith("fx-h2h-")) return null;

  const listItem = listSeedFixtures().find((f) => f.id === id);
  if (!listItem) return null;

  const lineups = LINEUPS[id];
  const homeLineup = lineups?.home ?? [];
  const awayLineup = lineups?.away ?? [];

  return {
    ...listItem,
    referee: fixture.referee,
    round: fixture.round,
    homeLineup,
    awayLineup,
    injuries: INJURIES.filter(
      (injury) =>
        injury.isActive &&
        (injury.teamId === fixture.homeTeamId ||
          injury.teamId === fixture.awayTeamId),
    ),
    homeStats: statsByTeam(fixture.homeTeamId),
    awayStats: statsByTeam(fixture.awayTeamId),
    headToHead: headToHeadFor(fixture.homeTeamId, fixture.awayTeamId),
    lineupStatus: resolveLineupStatus(
      fixture.status,
      homeLineup.length,
      awayLineup.length,
    ),
    dataSource: "seed",
  };
}
