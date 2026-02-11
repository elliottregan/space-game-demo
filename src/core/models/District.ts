/**
 * A named population center within the colony.
 * Districts replace the building grid as the primary spatial unit.
 */
export interface District {
  id: string;
  name: string;
  foundedAt: number;
  capacity: number;
  growthCap: number | null;
  buildingIds: string[];
}

/**
 * Colony-wide power state.
 */
export enum PowerStatus {
  SURPLUS = "surplus",
  DEFICIT = "deficit",
  CRITICAL = "critical",
}
