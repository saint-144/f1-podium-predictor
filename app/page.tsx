"use client";

import { useEffect, useState } from "react";

type PodiumPredictionUI = {
  position: 1 | 2 | 3;
  driver: string;
  team: string;
  score: number;
  note: string;
};

type RaceResultRow = {
  position: number;
  driverName: string;
  team: string;
};

type RaceResultsState = {
  raceName: string | null;
  results: RaceResultRow[];
};

type RaceOption = {
  round: number;
  name: string;
  circuit?: string;
  country?: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const SEASONS = Array.from(
  { length: CURRENT_YEAR - 2010 + 1 },
  (_, i) => CURRENT_YEAR - i
);

export default function HomePage() {
  const [season, setSeason] = useState<string>(String(CURRENT_YEAR));
  const [raceId, setRaceId] = useState<string>("1");

  const [races, setRaces] = useState<RaceOption[]>([]);
  const [racesLoading, setRacesLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [predictions, setPredictions] = useState<PodiumPredictionUI[] | null>(
    null
  );

  const [raceResults, setRaceResults] = useState<RaceResultsState | null>(null);
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);

  const selectedRace = races.find((r) => String(r.round) === raceId);

  // Load races for selected season via our own API (Jolpica-powered)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadRaces = async () => {
      setRacesLoading(true);
      setRaces([]);

      try {
        const res = await fetch(`/api/races?season=${season}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          console.error("Failed to fetch races for season", season, res.status);
          return;
        }

        const data = await res.json();
        const raceList = (data.races ?? []) as RaceOption[];

        if (!isMounted) return;

        setRaces(raceList);

        if (raceList.length > 0) {
          setRaceId((prev) => {
            if (prev && raceList.some((r) => String(r.round) === prev)) {
              return prev;
            }
            return String(raceList[0].round);
          });
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error loading races:", err);
      } finally {
        if (isMounted) setRacesLoading(false);
      }
    };

    loadRaces();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [season]);

  const handlePredict = async () => {
    setLoading(true);
    setPredictions(null);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, raceId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("API error response:", res.status, text);
        throw new Error("API error");
      }

      const data = await res.json();

      const podium = data.podium as {
        position: 1 | 2 | 3;
        driver: { name: string; team: string };
        score: number;
      }[];

      setPredictions(
        podium.map((p) => ({
          position: p.position,
          driver: p.driver.name,
          team: p.driver.team,
          score: p.score,
          note: "Rule-based model using standings + race results. Not real betting odds.",
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async () => {
    setResultsLoading(true);
    setRaceResults(null);

    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season, raceId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Results API error response:", res.status, text);
        throw new Error("Results API error");
      }

      const data = await res.json();

      const rows = data.results as {
        position: number;
        driverName: string;
        team: string;
      }[];

      setRaceResults({
        raceName: (data.raceName as string | null) ?? null,
        results: rows,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setResultsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-800/60 bg-slate-950/60 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              F1 ANALYTICS LAB
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Podium Predictor
            </h1>
          </div>
          <div className="hidden text-xs md:flex flex-col items-end text-slate-400">
            <span>
              Season <span className="font-semibold text-slate-100">{season}</span>
            </span>
            {selectedRace && (
              <span className="text-[11px]">
                Round {selectedRace.round} · {selectedRace.name}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:py-8">
        {/* Controls + context card */}
        <section className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-slate-950/60">
            <p className="text-sm text-slate-300">
              Pick a season and race, then let the rule-based model predict the
              podium using live standings & race history from{" "}
              <span className="font-semibold text-red-400">Jolpica</span>.
            </p>

            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Season selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide">
                  Season
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/80"
                >
                  {SEASONS.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Race selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 uppercase tracking-wide">
                  Race
                </label>
                <select
                  value={raceId}
                  onChange={(e) => setRaceId(e.target.value)}
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500/80"
                  disabled={racesLoading}
                >
                  {racesLoading && <option>Loading races…</option>}

                  {!racesLoading && races.length > 0 && (
                    <>
                      {races.map((race) => (
                        <option key={race.round} value={String(race.round)}>
                          Round {race.round} – {race.name}
                        </option>
                      ))}
                    </>
                  )}

                  {!racesLoading &&
                    races.length === 0 &&
                    Array.from({ length: 24 }, (_, i) => i + 1).map(
                      (round) => (
                        <option key={round} value={round.toString()}>
                          Round {round}
                        </option>
                      )
                    )}
                </select>
                {!racesLoading && races.length === 0 && (
                  <span className="text-[11px] text-slate-500">
                    Couldn&apos;t load race names, falling back to numeric
                    rounds.
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                disabled={loading}
                onClick={handlePredict}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold tracking-tight text-slate-50 shadow-md shadow-red-900/40 transition hover:bg-red-500 disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? "Predicting…" : "Predict Podium"}
              </button>

              <button
                onClick={handleViewResults}
                disabled={resultsLoading}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-800/90 px-3 py-2 text-sm font-semibold tracking-tight text-slate-100 shadow-md shadow-slate-950/40 transition hover:bg-slate-700 disabled:opacity-60 disabled:shadow-none"
              >
                {resultsLoading ? "Loading results…" : "View Past Results"}
              </button>
            </div>

            {/* Mini context row */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5">
                Seasons: 2010 → {CURRENT_YEAR}
              </span>
              {selectedRace && (
                <span className="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5">
                  {selectedRace.country
                    ? `${selectedRace.country} · ${selectedRace.name}`
                    : selectedRace.name}
                </span>
              )}
              <span>Powered by Jolpica (Ergast-compatible)</span>
            </div>
          </div>

          {/* Summary card */}
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-slate-950/60">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Current selection
              </p>
              <h2 className="text-lg font-semibold text-slate-50">
                Season {season}
              </h2>
              <p className="text-sm text-slate-300">
                {selectedRace ? (
                  <>
                    Round {selectedRace.round} · {selectedRace.name}
                    {selectedRace.country && ` · ${selectedRace.country}`}
                  </>
                ) : (
                  "Choose a race to see predictions and past results."
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1">
                Live data model
              </span>
              <span className="rounded-lg border border-slate-600/60 bg-slate-900/80 px-2 py-1">
                Rule-based v0.1
              </span>
              <span className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-2 py-1">
                Educational only
              </span>
            </div>
          </div>
        </section>

        {/* Predictions + results */}
        <section className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
          {/* Predictions */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/50">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Predicted podium</h2>
              {predictions && (
                <span className="text-[11px] text-slate-400">
                  Higher score = stronger favorite
                </span>
              )}
            </div>

            {!predictions && !loading && (
              <p className="text-sm text-slate-400">
                Hit <span className="font-semibold text-slate-100">Predict</span>{" "}
                to see the top 3 for your selected race.
              </p>
            )}

            {predictions && (
              <div className="grid gap-3 sm:grid-cols-3">
                {predictions.map((p) => {
                  const posStyles: Record<
                    number,
                    { label: string; ring: string; bg: string }
                  > = {
                    1: {
                      label: "P1",
                      ring: "ring-2 ring-yellow-400/80",
                      bg: "bg-gradient-to-br from-yellow-500/15 via-slate-950 to-slate-950",
                    },
                    2: {
                      label: "P2",
                      ring: "ring-2 ring-slate-200/80",
                      bg: "bg-gradient-to-br from-slate-200/10 via-slate-950 to-slate-950",
                    },
                    3: {
                      label: "P3",
                      ring: "ring-2 ring-amber-700/80",
                      bg: "bg-gradient-to-br from-amber-700/15 via-slate-950 to-slate-950",
                    },
                  };

                  const style = posStyles[p.position] ?? posStyles[3];

                  return (
                    <div
                      key={p.position}
                      className={`flex flex-col justify-between rounded-2xl border border-slate-800 px-3 py-3 text-sm ${style.bg} ${style.ring}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold tracking-wide text-slate-300">
                          {style.label}
                        </span>
                        <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-400">
                          Score {p.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <p className="text-sm font-semibold text-slate-50">
                          {p.driver}
                        </p>
                        <p className="text-xs text-slate-300">{p.team}</p>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {p.note}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past results */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/50">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Past race results</h2>
              {raceResults?.raceName && (
                <span className="text-[11px] text-slate-400">
                  {raceResults.raceName}
                </span>
              )}
            </div>

            {!raceResults && !resultsLoading && (
              <p className="text-sm text-slate-400">
                View past results to see the full classification for this race.
              </p>
            )}

            {resultsLoading && (
              <p className="text-sm text-slate-400">Loading classification…</p>
            )}

            {raceResults && !resultsLoading && (
              <>
                {raceResults.results.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No classified results available for this round yet.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-800">
                    <div className="max-h-80 overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-900">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                              Pos
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                              Driver
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                              Team
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {raceResults.results.map((row) => (
                            <tr
                              key={row.position}
                              className="border-t border-slate-800/80 odd:bg-slate-950/60 even:bg-slate-950/30"
                            >
                              <td className="px-3 py-2 text-slate-100">
                                {row.position}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                {row.driverName}
                              </td>
                              <td className="px-3 py-2 text-slate-400">
                                {row.team}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/80 pt-3 text-[11px] text-slate-500">
          <span>
            Not affiliated with Formula 1. Predictions are for educational use
            only.
          </span>
          <span>Built with Next.js, Tailwind & Jolpica.</span>
        </footer>
      </div>
    </main>
  );
}
