/**
 * Map football-data.org Premier League team IDs → API-Football ids
 * so fixtures/standings share `api-team-{id}` with existing squads/priors.
 */
export const FD_TEAM_TO_API: Record<number, number> = {
  57: 42, // Arsenal
  58: 66, // Aston Villa
  1044: 35, // Bournemouth
  402: 55, // Brentford
  397: 51, // Brighton
  328: 44, // Burnley
  61: 49, // Chelsea
  354: 52, // Crystal Palace
  62: 45, // Everton
  63: 36, // Fulham
  341: 63, // Leeds United
  64: 40, // Liverpool
  65: 50, // Manchester City
  66: 33, // Manchester United
  67: 34, // Newcastle
  351: 65, // Nottingham Forest
  71: 71, // Sunderland
  73: 47, // Tottenham
  563: 48, // West Ham
  76: 39, // Wolves
  338: 46, // Leicester
  349: 57, // Ipswich Town
  356: 62, // Sheffield United
  340: 41, // Southampton
  322: 64, // Hull City (football-data id)
  1076: 748, // Coventry City (football-data id; verify on sync)
};

const NAME_TO_API: Record<string, number> = {
  arsenal: 42,
  "aston villa": 66,
  bournemouth: 35,
  "afc bournemouth": 35,
  brentford: 55,
  brighton: 51,
  "brighton & hove albion": 51,
  "brighton and hove albion": 51,
  burnley: 44,
  chelsea: 49,
  "crystal palace": 52,
  everton: 45,
  fulham: 36,
  "leeds united": 63,
  leeds: 63,
  liverpool: 40,
  "manchester city": 50,
  "man city": 50,
  "manchester united": 33,
  "man united": 33,
  "newcastle united": 34,
  newcastle: 34,
  "nottingham forest": 65,
  "nottm forest": 65,
  sunderland: 71,
  "sunderland afc": 71,
  tottenham: 47,
  "tottenham hotspur": 47,
  spurs: 47,
  "west ham": 48,
  "west ham united": 48,
  wolves: 39,
  "wolverhampton wanderers": 39,
  "wolverhampton": 39,
  leicester: 46,
  "leicester city": 46,
  ipswich: 57,
  "ipswich town": 57,
  southampton: 41,
  "sheffield united": 62,
  "sheffield utd": 62,
  "hull city": 64,
  hull: 64,
  "coventry city": 748,
  coventry: 748,
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/fc\b/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveFdTeamToApiId(
  fdTeamId: number,
  name: string,
): number | null {
  if (FD_TEAM_TO_API[fdTeamId] != null) return FD_TEAM_TO_API[fdTeamId];
  const key = normalizeName(name);
  if (NAME_TO_API[key] != null) return NAME_TO_API[key];
  // Try without "united"/"city" noise
  const short = key
    .replace(/\bunited\b/g, "")
    .replace(/\bcity\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return NAME_TO_API[short] ?? null;
}

export function teamRowIdFromFd(fdTeamId: number, name: string): string {
  const apiId = resolveFdTeamToApiId(fdTeamId, name);
  if (apiId != null) return `api-team-${apiId}`;
  return `fd-team-${fdTeamId}`;
}
