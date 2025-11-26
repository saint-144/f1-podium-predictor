// lib/jolpica.ts
import { Driver, RaceOption } from "./types";

// Base URL for Jolpica's Ergast-compatible API
// Docs: http://api.jolpi.ca/ergast/f1/
const JOLPICA_BASE_URL =
  process.env.JOLPICA_BASE_URL ?? "http://api.jolpi.ca";
const ERGAST_F1_PATH = "/ergast/f1";

// ---- Low-level fetch helper ----

async function jolpicaFetch<T>(
  path: string,
  searchParams?: Record<string, string | number>
): Promise<T> {
  const url = new URL(ERGAST_F1_PATH + path, JOLPICA_BASE_URL);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const res = await fetch(url.toString(), {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Jolpica request failed: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return (await res.json()) as T;
}

// ---- Types shaped like Ergast/Jolpica responses (minimal subset) ----

interface JolpicaDriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code?: string;
    permanentNumber?: string;
  };
  Constructors: {
    name: string;
  }[];
}

interface JolpicaDriverStandingsMRData {
  StandingsTable: {
    season: string;
    StandingsLists: {
      round: string;
      DriverStandings: JolpicaDriverStanding[];
    }[];
  };
}

interface JolpicaDriverStandingsResponse {
  MRData: JolpicaDriverStandingsMRData;
}

interface JolpicaRaceResult {
  position: string;
  Driver: {
    driverId: string;
    givenName: string;
    familyName: string;
    code?: string;
    permanentNumber?: string;
  };
  Constructor: {
    name: string;
  };
}

interface JolpicaRace {
  round: string;
  raceName: string;
  Results: JolpicaRaceResult[];
}

interface JolpicaRaceResultsMRData {
  RaceTable: {
    season: string;
    round?: string;
    Races: JolpicaRace[];
  };
}

interface JolpicaRaceResultsResponse {
  MRData: JolpicaRaceResultsMRData;
}

// ---- New: Season races (for race names) ----

interface JolpicaSeasonRace {
  round: string;
  raceName: string;
  Circuit?: {
    circuitName?: string;
    Location?: {
      country?: string;
    };
  };
}

interface JolpicaSeasonRacesMRData {
  RaceTable: {
    season: string;
    Races: JolpicaSeasonRace[];
  };
}

interface JolpicaSeasonRacesResponse {
  MRData: JolpicaSeasonRacesMRData;
}

// ---- Internal mapper: Jolpica Driver -> our Driver type ----

function mapJolpicaDriverToDriver(
  d: JolpicaDriverStanding["Driver"],
  teamName: string
): Driver {
  return {
    id: d.driverId,
    code: d.code ?? null,
    name: `${d.givenName} ${d.familyName}`,
    team: teamName,
    number: d.permanentNumber ? Number(d.permanentNumber) : null,
  };
}

function mapJolpicaRaceDriverToDriver(
  d: JolpicaRaceResult["Driver"],
  teamName: string
): Driver {
  return {
    id: d.driverId,
    code: d.code ?? null,
    name: `${d.givenName} ${d.familyName}`,
    team: teamName,
    number: d.permanentNumber ? Number(d.permanentNumber) : null,
  };
}

// ---- Public helpers we’ll use in the model later ----

export interface SeasonStandingEntry {
  driver: Driver;
  position: number;
  points: number;
  wins: number;
}

export async function fetchSeasonDriverStandings(
  season: string
): Promise<SeasonStandingEntry[]> {
  const data = await jolpicaFetch<JolpicaDriverStandingsResponse>(
    `/${season}/driverstandings.json`,
    {
      limit: 100,
      offset: 0,
    }
  );

  const lists = data.MRData.StandingsTable.StandingsLists ?? [];
  if (lists.length === 0) return [];

  const standings = lists[0].DriverStandings ?? [];

  return standings.map((s) => {
    const teamName = s.Constructors?.[0]?.name ?? "Unknown Team";

    return {
      driver: mapJolpicaDriverToDriver(s.Driver, teamName),
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
    };
  });
}

export interface RaceResultEntry {
  driver: Driver;
  position: number;
}

export interface RaceResultsInfo {
  season: string;
  round: number;
  raceName: string;
  results: RaceResultEntry[];
}

export async function fetchRaceResults(
  season: string,
  round: number
): Promise<RaceResultsInfo | null> {
  const data = await jolpicaFetch<JolpicaRaceResultsResponse>(
    `/${season}/${round}/results.json`,
    {
      limit: 100,
      offset: 0,
    }
  );

  const races = data.MRData.RaceTable.Races ?? [];
  if (races.length === 0) return null;

  const race = races[0];

  const results: RaceResultEntry[] = (race.Results ?? []).map((r) => ({
    driver: mapJolpicaRaceDriverToDriver(r.Driver, r.Constructor.name),
    position: Number(r.position),
  }));

  return {
    season,
    round: Number(race.round ?? round),
    raceName: race.raceName,
    results,
  };
}

// ---- New: fetch season races for dropdown (race names) ----

export async function fetchSeasonRaces(
  season: string
): Promise<RaceOption[]> {
  const data = await jolpicaFetch<JolpicaSeasonRacesResponse>(
    `/${season}.json`,
    {
      limit: 100,
      offset: 0,
    }
  );

  const races = data.MRData.RaceTable.Races ?? [];
  if (!races.length) return [];

  return races.map((r): RaceOption => ({
    round: Number(r.round),
    name: r.raceName,
    circuit: r.Circuit?.circuitName,
    country: r.Circuit?.Location?.country,
  }));
}
