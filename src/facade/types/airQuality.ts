// src/facade/types/airQuality.ts

export interface AirQualitySnapshot {
  readonly airQuality: number;
  readonly production: number;
  readonly consumption: number;
  readonly healthEffect: number;
  readonly moraleEffect: number;
  readonly efficiencyMultiplier: number;
}
