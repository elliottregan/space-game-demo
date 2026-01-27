// UI component types
// These types are used by UI components and need to be exported separately
// because TypeScript can't properly re-export types from .vue files

export type EntityStatus = "active" | "pending" | "disabled" | "idle" | "recycling";

export interface Stat {
  label: string;
  value?: number | string;
  progress?: number;
  variant?: "default" | "positive" | "negative" | "warning" | "info";
  prefix?: string;
}

export interface Tab {
  id: string;
  label: string;
  badge?: string | number;
}
