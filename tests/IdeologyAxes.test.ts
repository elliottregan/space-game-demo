// tests/IdeologyAxes.test.ts
import { describe, it, expect } from "bun:test";
import type { ColonistIdeology } from "../src/core/models/Colonist";

describe("ColonistIdeology three-axis model", () => {
  it("has solidarity, sovereignty, transformation, and conviction fields", () => {
    const ideology: ColonistIdeology = {
      solidarity: 0,
      sovereignty: 0,
      transformation: 0,
      conviction: 0.5,
    };

    expect(ideology.solidarity).toBe(0);
    expect(ideology.sovereignty).toBe(0);
    expect(ideology.transformation).toBe(0);
    expect(ideology.conviction).toBe(0.5);
  });

  it("axes can range from -1 to +1", () => {
    const farLeft: ColonistIdeology = {
      solidarity: -1,
      sovereignty: -1,
      transformation: -1,
      conviction: 0,
    };

    expect(farLeft.solidarity).toBe(-1);
    expect(farLeft.sovereignty).toBe(-1);
    expect(farLeft.transformation).toBe(-1);

    const farRight: ColonistIdeology = {
      solidarity: 1,
      sovereignty: 1,
      transformation: 1,
      conviction: 1,
    };

    expect(farRight.solidarity).toBe(1);
    expect(farRight.sovereignty).toBe(1);
    expect(farRight.transformation).toBe(1);
  });

  it("conviction ranges from 0 to 1", () => {
    const low: ColonistIdeology = {
      solidarity: 0,
      sovereignty: 0,
      transformation: 0,
      conviction: 0,
    };

    const high: ColonistIdeology = {
      solidarity: 0,
      sovereignty: 0,
      transformation: 0,
      conviction: 1,
    };

    expect(low.conviction).toBe(0);
    expect(high.conviction).toBe(1);
  });

  it("axes support fractional values", () => {
    const ideology: ColonistIdeology = {
      solidarity: -0.3,
      sovereignty: 0.7,
      transformation: -0.55,
      conviction: 0.42,
    };

    expect(ideology.solidarity).toBe(-0.3);
    expect(ideology.sovereignty).toBe(0.7);
    expect(ideology.transformation).toBe(-0.55);
    expect(ideology.conviction).toBe(0.42);
  });
});
