// lib/types.ts

// Basic race selection coming from the UI
export interface RaceOption {
  round: number;         // e.g. 1, 2, 3...
  name: string;          // e.g. "Bahrain Grand Prix"
  circuit?: string;      // optional, for nicer UI later
  country?: string;      // optional
}

// What the UI sends to /api/predict
export interface PredictionRequestBody {
  season: string;        // e.g. "2024"
  round: number;         // race round number
}

// Core driver info we'll use everywhere
export interface Driver {
  id: string;            // stable ID from API or dummy ID (e.g. "max_verstappen")
  code?: string | null;  // e.g. "VER"
  name: string;          // full name
  team: string;          // e.g. "Red Bull Racing"
  number?: number | null;
}

// Features we might use for scoring (dummy now, real later)
export interface DriverFeatures {
  driver: Driver;
  currentStandingPosition?: number | null;
  currentPoints?: number | null;
  recentResults: number[];   // finishing positions, e.g. [1, 2, 3, 1, 5]
}

// Output of the model for each podium slot
export type PodiumPosition = 1 | 2 | 3;

export interface PodiumPrediction {
  position: PodiumPosition;  // 1, 2, or 3
  driver: Driver;
  score: number;             // model confidence / score (higher = better)
}

// What /api/predict returns to the UI
export interface PredictionApiResponse {
  podium: PodiumPrediction[];
  meta: {
    season: string;
    round: number;
    raceName?: string;
    modelVersion: string;    // e.g. "v0.1-rule-based"
  };
}

// Optional error shape if we want to send structured errors later
export interface ApiError {
  error: string;
  details?: string;
}
