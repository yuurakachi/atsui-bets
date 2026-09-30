/**
 * Jolpica (api.jolpi.ca), the successor of the Ergast F1 API: calendar, drivers and
 * official classifications. Plain fetch with no server-only imports, so the same code
 * runs in server actions, in the admin's browser (fallback if the server is blocked)
 * and in scripts.
 */
import type { F1Race, F1RoundKind } from "../domain";

const BASE_URL = "https://api.jolpi.ca/ergast/f1";

/** Place names as the family says them, by Jolpica's race name. */
const PLACES: Record<string, string> = {
  "Australian Grand Prix": "Australia",
  "Chinese Grand Prix": "China",
  "Japanese Grand Prix": "Japón",
  "Bahrain Grand Prix": "Baréin",
  "Saudi Arabian Grand Prix": "Arabia Saudita",
  "Miami Grand Prix": "Miami",
  "Emilia Romagna Grand Prix": "Emilia-Romaña",
  "Monaco Grand Prix": "Mónaco",
  "Spanish Grand Prix": "España",
  "Barcelona Grand Prix": "Barcelona",
  "Barcelona-Catalunya Grand Prix": "Barcelona",
  "Canadian Grand Prix": "Canadá",
  "Austrian Grand Prix": "Austria",
  "British Grand Prix": "Gran Bretaña",
  "Belgian Grand Prix": "Bélgica",
  "Hungarian Grand Prix": "Hungría",
  "Dutch Grand Prix": "Países Bajos",
  "Italian Grand Prix": "Italia",
  "Madrid Grand Prix": "Madrid",
  "Azerbaijan Grand Prix": "Azerbaiyán",
  "Singapore Grand Prix": "Singapur",
  "United States Grand Prix": "Estados Unidos",
  "Mexico City Grand Prix": "México",
  "São Paulo Grand Prix": "Brasil",
  "Las Vegas Grand Prix": "Las Vegas",
  "Qatar Grand Prix": "Catar",
  "Abu Dhabi Grand Prix": "Abu Dabi",
};

export interface F1DriverInfo {
  code: string;
  name: string;
  team: string | null;
}

export interface F1SeasonData {
  season: string;
  races: F1Race[];
  /** Everyone registered for the season; `active` = raced the latest race (or all, before the first). */
  drivers: (F1DriverInfo & { active: boolean })[];
}

/** Stable id of a round's race, e.g. "f1:2026:19:sprint". */
export function f1ExternalId(season: string, raceRound: number, kind: F1RoundKind): string {
  return `f1:${season}:${raceRound}:${kind}`;
}

export function parseF1ExternalId(externalId: string): { season: string; raceRound: number; kind: F1RoundKind } | null {
  const match = /^f1:(\d{4}):(\d+):(sprint|gp)$/.exec(externalId);
  return match ? { season: match[1], raceRound: Number(match[2]), kind: match[3] as F1RoundKind } : null;
}

// --- Jolpica JSON shapes (only the fields we use) --------------------------------------

interface JDriver {
  driverId: string;
  code?: string;
  givenName: string;
  familyName: string;
}

interface JResult {
  position: string;
  Driver: JDriver;
  Constructor?: { name: string };
}

interface JRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Sprint?: { date: string; time?: string };
  Results?: JResult[];
  SprintResults?: JResult[];
}

interface JResponse {
  MRData: {
    RaceTable?: { Races: JRace[] };
    DriverTable?: { Drivers: JDriver[] };
  };
}

// --- Parsing (pure, tested) ---------------------------------------------------------------

const instant = (date: string, time?: string) => new Date(`${date}T${time ?? "12:00:00Z"}`);

export function driverCode(driver: JDriver): string {
  return (driver.code ?? driver.familyName.slice(0, 3)).toUpperCase();
}

const driverName = (driver: JDriver) => `${driver.givenName} ${driver.familyName}`;

export function parseSchedule(json: JResponse): F1Race[] {
  return (json.MRData.RaceTable?.Races ?? []).map((race) => ({
    round: Number(race.round),
    place: PLACES[race.raceName] ?? race.raceName.replace(/ Grand Prix$/, ""),
    raceStart: instant(race.date, race.time),
    sprintStart: race.Sprint ? instant(race.Sprint.date, race.Sprint.time) : null,
  }));
}

export function parseDrivers(driversJson: JResponse, lastRaceJson: JResponse): F1SeasonData["drivers"] {
  const lastRace = lastRaceJson.MRData.RaceTable?.Races[0]?.Results ?? [];
  const teams = new Map(lastRace.map((r) => [driverCode(r.Driver), r.Constructor?.name ?? null]));
  return (driversJson.MRData.DriverTable?.Drivers ?? [])
    .map((driver) => ({
      code: driverCode(driver),
      name: driverName(driver),
      team: teams.get(driverCode(driver)) ?? null,
      active: lastRace.length === 0 || teams.has(driverCode(driver)),
    }));
}

/** Official classification in order (index 0 = P1), or null if the race has no results yet. */
export function parseClassification(json: JResponse, kind: F1RoundKind): F1DriverInfo[] | null {
  const race = json.MRData.RaceTable?.Races[0];
  const results = (kind === "sprint" ? race?.SprintResults : race?.Results) ?? [];
  if (results.length === 0) return null;
  return [...results]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((r) => ({ code: driverCode(r.Driver), name: driverName(r.Driver), team: r.Constructor?.name ?? null }));
}

// --- Fetching ------------------------------------------------------------------------------

async function get(path: string): Promise<JResponse> {
  const response = await fetch(`${BASE_URL}/${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Jolpica respondió ${response.status}.`);
  return (await response.json()) as JResponse;
}

export async function fetchF1Season(season: string): Promise<F1SeasonData> {
  const [schedule, drivers, lastRace] = await Promise.all([
    get(`${season}.json?limit=100`),
    get(`${season}/drivers.json?limit=100`),
    get(`${season}/last/results.json`),
  ]);
  const races = parseSchedule(schedule);
  if (races.length === 0) throw new Error(`Jolpica no tiene calendario para ${season}.`);
  return { season, races, drivers: parseDrivers(drivers, lastRace) };
}

export async function fetchF1Classification(
  season: string,
  raceRound: number,
  kind: F1RoundKind,
): Promise<F1DriverInfo[] | null> {
  const json = await get(`${season}/${raceRound}/${kind === "sprint" ? "sprint" : "results"}.json?limit=100`);
  return parseClassification(json, kind);
}
