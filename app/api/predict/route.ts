// app/api/predict/route.ts
import { NextResponse } from "next/server";
import { PredictionApiResponse, ApiError } from "@/lib/types";
import { predictPodiumForRace } from "@/lib/model";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;

    // season can be string or number, normalize to string
    const rawSeason = body?.season;
    const season =
      typeof rawSeason === "number" ? String(rawSeason) : rawSeason;

    // Accept round from body.round or body.raceId, in any form
    const rawRound = body?.round ?? body?.raceId;

    let parsedRound: number = 1; // safe default

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
          "Expected at least a season (string or number). round/raceId is optional for now.",
      };

      return NextResponse.json(error, { status: 400 });
    }

    const podium = await predictPodiumForRace(season, parsedRound);

    const response: PredictionApiResponse = {
      podium,
      meta: {
        season,
        round: parsedRound,
        modelVersion: "v0.1-dummy-rule-based",
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("Predict API error:", err);

    const error: ApiError = {
      error: "Internal server error",
      details: "Something went wrong while generating the prediction.",
    };

    return NextResponse.json(error, { status: 500 });
  }
}
