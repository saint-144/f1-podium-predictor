// app/api/results/route.ts
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/types";
import { fetchRaceResults } from "@/lib/jolpica";

interface RaceResultsApiResponse {
  season: string;
  round: number;
  raceName: string | null;
  results: {
    position: number;
    driverName: string;
    team: string;
  }[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;

    // season can be string or number, normalize to string
    const rawSeason = body?.season;
    const season =
      typeof rawSeason === "number" ? String(rawSeason) : rawSeason;

    // Accept round from body.round or body.raceId
    const rawRound = body?.round ?? body?.raceId;

    let parsedRound: number = 1;

    if (typeof rawRound === "number") {
      parsedRound = rawRound;
    } else if (typeof rawRound === "string") {
      const n = parseInt(rawRound, 10);
      parsedRound = Number.isNaN(n) ? 1 : n;
    }

    if (!season || typeof season !== "string") {
      const error: ApiError = {
        error: "Invalid request body",
        details:
          "Expected at least a season (string or number). round/raceId is optional.",
      };
      return NextResponse.json(error, { status: 400 });
    }

    const info = await fetchRaceResults(season, parsedRound).catch((err) => {
      console.error("Error fetching race results from Jolpica:", err);
      return null;
    });

    if (!info) {
      const response: RaceResultsApiResponse = {
        season,
        round: parsedRound,
        raceName: null,
        results: [],
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: RaceResultsApiResponse = {
      season: info.season,
      round: info.round,
      raceName: info.raceName ?? null,
      results: info.results.map((r) => ({
        position: r.position,
        driverName: r.driver.name,
        team: r.driver.team,
      })),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Race results API error:", err);

    const error: ApiError = {
      error: "Internal server error",
      details: "Something went wrong while fetching race results.",
    };

    return NextResponse.json(error, { status: 500 });
  }
}
