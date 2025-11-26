// app/api/races/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchSeasonRaces } from "@/lib/jolpica";
import { ApiError } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");

    const seasonRaw =
      seasonParam && /^\d{4}$/.test(seasonParam)
        ? seasonParam
        : String(new Date().getFullYear());

    const races = await fetchSeasonRaces(seasonRaw);

    return NextResponse.json(
      {
        season: seasonRaw,
        races,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/races:", err);

    const error: ApiError = {
      error: "Internal server error",
      details: "Something went wrong while fetching race list from Jolpica.",
    };

    return NextResponse.json(error, { status: 500 });
  }
}
