export interface DistrictSnapshot {
  districts: DistrictEntry[];
}

export interface DistrictEntry {
  id: string;
  name: string;
  buildingCount: number;
  buildingIds: string[];
}
