import { describe, it, expect } from "bun:test";
import {
  BASE_OXYGEN_PER_COLONIST,
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_DEADLY,
} from "../src/core/balance/AirQualityBalance";

describe("AirQualityBalance constants", () => {
  it("should have BASE_OXYGEN_PER_COLONIST defined", () => {
    expect(BASE_OXYGEN_PER_COLONIST).toBeGreaterThan(0);
  });

  it("should have threshold constants in correct order", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBeGreaterThan(AIR_QUALITY_CRITICAL);
    expect(AIR_QUALITY_CRITICAL).toBeGreaterThan(AIR_QUALITY_DEADLY);
  });

  it("should have comfortable threshold at 0.8", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBe(0.8);
  });

  it("should have critical threshold at 0.5", () => {
    expect(AIR_QUALITY_CRITICAL).toBe(0.5);
  });

  it("should have deadly threshold at 0.2", () => {
    expect(AIR_QUALITY_DEADLY).toBe(0.2);
  });
});
