// lib/model.ts
import {
  Driver,
  DriverFeatures,
  PodiumPrediction,
  PodiumPosition,
} from "./types";
import {
  fetchSeasonDriverStandings,
  fetchRaceResults,
} from "./jolpica";

// --- DUMMY DATA (fallback if Jolpica fails or no data yet) ---

const DUMMY_DRIVERS: Driver[] = [
  {
    id: "max_verstappen",
    code: "VER",
    name: "Max Verstappen",
    team: "Red Bull Racing",
    number: 1,
  },
  {
    id: "lando_norris",
    code: "NOR",
    name: "Lando Norris",
    team: "McLaren",
    number: 4,
  },
  {
    id: "charles_leclerc",
    code: "LEC",
    name: "Charles Leclerc",
    team: "Ferrari",
    number: 16,
  },
  {
    id: "oscar_piastri",
    code: "PIA",
    name: "Oscar Piastri",
    team: "McLaren",
    number: 81,
  },
  {
    id: "lewis_hamilton",
    code: "HAM",
    name: "Lewis Hamilton",
    team: "Mercedes",
    number: 44,
  },
];

// Build some fake “features” just so the model has numbers to work with
function buildDummyFeatures(drivers: Driver[]): DriverFeatures[] {
  return drivers.map((driver, index) => {
    // Pretend the earlier drivers in the list are stronger
    const baseStanding = index + 1;
    const basePoints = (drivers.length - index) * 10;

    // Fake recent results: better drivers have more P1/P2 finishes
    const recentResults: number[] =
      index === 0
        ? [1, 1, 2, 1, 3]
        : index === 1
        ? [2, 3, 1, 2, 4]
        : index === 2
        ? [3, 2, 4, 3, 2]
        : index === 3
        ? [4, 5, 3, 4, 6]
        : [6, 7, 5, 8, 7];

    return {
      driver,
      currentStandingPosition: baseStanding,
      currentPoints: basePoints,
      recentResults,
    };
  });
}

// --- NEW: build features from real Jolpica data ---

async function buildFeaturesFromJolpica(
  season: string,
  round: number
): Promise<DriverFeatures[]> {
  // Season-long strength
  const standings = await fetchSeasonDriverStandings(season);

  // Race-specific form (may not exist yet for future rounds)
  const raceResults = await fetchRaceResults(season, round).catch((err) => {
    console.warn("Error fetching race results from Jolpica:", err);
    return null;
  });

  const recentMap = new Map<string, number[]>();

  if (raceResults && raceResults.results?.length) {
    for (const r of raceResults.results) {
      const cur = recentMap.get(r.driver.id) ?? [];
      cur.push(r.position);
      recentMap.set(r.driver.id, cur);
    }
  }

  // If no standings, we'll let caller fall back to dummy
  if (!standings.length) return [];

  return standings.map((s) => ({
    driver: s.driver,
    currentStandingPosition: s.position,
    currentPoints: s.points,
    recentResults: recentMap.get(s.driver.id) ?? [],
  }));
}

// Simple scoring function: lower average finish + more points = better
function scoreDriver(features: DriverFeatures): number {
  const { currentPoints = 0, currentStandingPosition = 20, recentResults } =
    features;

  const avgFinish =
    recentResults.length > 0
      ? recentResults.reduce((sum, pos) => sum + pos, 0) / recentResults.length
      : 10;

  // We want:
  // - more points => higher score
  // - better average finish (smaller) => higher score
  // - better championship position (smaller) => higher score
  const pointsWeight = 1.0;
  const standingWeight = 15.0;
  const avgFinishWeight = 10.0;

  const score =
    pointsWeight * (currentPoints ?? 0) -
    standingWeight * (currentStandingPosition ?? 20) -
    avgFinishWeight * avgFinish;

  return score;
}

// Public function: given season + round, return top 3 predictions
// NOW ASYNC because we call Jolpica
export async function predictPodiumForRace(
  season: string,
  round: number
): Promise<PodiumPrediction[]> {
  let features: DriverFeatures[] = [];

  try {
    features = await buildFeaturesFromJolpica(season, round);

    if (!features.length) {
      console.warn(
        "No Jolpica-derived features (empty standings), falling back to dummy drivers."
      );
      features = buildDummyFeatures(DUMMY_DRIVERS);
    }
  } catch (err) {
    console.error("Error building features from Jolpica, using dummy:", err);
    features = buildDummyFeatures(DUMMY_DRIVERS);
  }

  const scored = features
    .map((f) => ({
      driver: f.driver,
      score: scoreDriver(f),
    }))
    .sort((a, b) => b.score - a.score);

  const podiumPositions: PodiumPosition[] = [1, 2, 3];

  const podium: PodiumPrediction[] = scored.slice(0, 3).map((item, idx) => ({
    position: podiumPositions[idx],
    driver: item.driver,
    score: item.score,
  }));

  return podium;
}
