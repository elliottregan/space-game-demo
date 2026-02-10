// tests/IdeologyAxes.test.ts
import { describe, it, expect } from "bun:test";
import type { ColonistIdeology } from "../src/core/models/Colonist";
import {
  AXIS_KEYS,
  NPCFaction,
  type AxisPosition,
  type FactionState,
} from "../src/core/models/NPCInfluence";
import {
  NEW_COLONIST_IDEOLOGY,
  FACTION_NAME_THRESHOLD_MODERATE,
  FACTION_NAME_THRESHOLD_EXTREME,
  STARTING_FACTION_POSITIONS,
} from "../src/core/balance/IdeologyBalance";

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

describe("AxisPosition", () => {
  it("can create a valid AxisPosition with all three axes", () => {
    const pos: AxisPosition = {
      solidarity: 0.5,
      sovereignty: -0.3,
      transformation: 1.0,
    };
    expect(pos.solidarity).toBe(0.5);
    expect(pos.sovereignty).toBe(-0.3);
    expect(pos.transformation).toBe(1.0);
  });

  it("supports full range from -1 to +1", () => {
    const min: AxisPosition = {
      solidarity: -1,
      sovereignty: -1,
      transformation: -1,
    };
    const max: AxisPosition = {
      solidarity: 1,
      sovereignty: 1,
      transformation: 1,
    };
    const neutral: AxisPosition = {
      solidarity: 0,
      sovereignty: 0,
      transformation: 0,
    };
    expect(min.solidarity).toBe(-1);
    expect(max.solidarity).toBe(1);
    expect(neutral.solidarity).toBe(0);
  });
});

describe("AXIS_KEYS", () => {
  it("contains exactly three keys", () => {
    expect(AXIS_KEYS).toHaveLength(3);
  });

  it("contains solidarity, sovereignty, and transformation", () => {
    expect(AXIS_KEYS).toContain("solidarity");
    expect(AXIS_KEYS).toContain("sovereignty");
    expect(AXIS_KEYS).toContain("transformation");
  });

  it("can be used to iterate over AxisPosition properties", () => {
    const pos: AxisPosition = {
      solidarity: 0.1,
      sovereignty: 0.2,
      transformation: 0.3,
    };
    const values: number[] = [];
    for (const key of AXIS_KEYS) {
      values.push(pos[key]);
    }
    expect(values).toEqual([0.1, 0.2, 0.3]);
  });
});

describe("FactionState", () => {
  it("can create a valid FactionState", () => {
    const faction: FactionState = {
      id: "earth_loyalists_v1",
      baseId: NPCFaction.EarthLoyalists,
      name: "Earth Loyalists",
      position: { solidarity: 0.5, sovereignty: -0.8, transformation: -0.3 },
      pressure: { solidarity: 0.0, sovereignty: 0.0, transformation: 0.0 },
    };
    expect(faction.id).toBe("earth_loyalists_v1");
    expect(faction.baseId).toBe(NPCFaction.EarthLoyalists);
    expect(faction.name).toBe("Earth Loyalists");
    expect(faction.position.solidarity).toBe(0.5);
    expect(faction.position.sovereignty).toBe(-0.8);
    expect(faction.pressure.solidarity).toBe(0.0);
  });

  it("baseId uses NPCFaction enum values", () => {
    const factions: FactionState[] = [
      {
        id: "el_v1",
        baseId: NPCFaction.EarthLoyalists,
        name: "Earth Loyalists",
        position: { solidarity: 0, sovereignty: 0, transformation: 0 },
        pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
      },
      {
        id: "mi_v1",
        baseId: NPCFaction.MarsIndependence,
        name: "Mars Independence",
        position: { solidarity: 0, sovereignty: 0, transformation: 0 },
        pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
      },
      {
        id: "ci_v1",
        baseId: NPCFaction.CorporateInterests,
        name: "Corporate Interests",
        position: { solidarity: 0, sovereignty: 0, transformation: 0 },
        pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
      },
    ];
    expect(factions[0]!.baseId).toBe(NPCFaction.EarthLoyalists);
    expect(factions[1]!.baseId).toBe(NPCFaction.MarsIndependence);
    expect(factions[2]!.baseId).toBe(NPCFaction.CorporateInterests);
  });

  it("position and pressure are independent AxisPosition objects", () => {
    const faction: FactionState = {
      id: "test_v1",
      baseId: NPCFaction.MarsIndependence,
      name: "Test Faction",
      position: { solidarity: 0.5, sovereignty: 0.8, transformation: -0.2 },
      pressure: { solidarity: -0.1, sovereignty: 0.3, transformation: 0.0 },
    };
    expect(faction.position.solidarity).not.toBe(faction.pressure.solidarity);
    expect(faction.position.sovereignty).not.toBe(faction.pressure.sovereignty);
  });
});

// ============================================================
// IdeologyBalance axis-based constants tests
// ============================================================

describe("IdeologyBalance - Removed constants no longer exported", () => {
  it("old faction-affinity constants are removed", () => {
    const mod = require("../src/core/balance/IdeologyBalance");
    expect(mod.IDEOLOGY_NEUTRAL_THRESHOLD).toBeUndefined();
    expect(mod.PROJECT_SUPPORT_MINOR).toBeUndefined();
    expect(mod.PROJECT_SUPPORT_MAJOR).toBeUndefined();
    expect(mod.PROJECT_SUPPORT_VICTORY).toBeUndefined();
    expect(mod.PROJECT_MORALE_STRONG_SUPPORTER).toBeUndefined();
    expect(mod.PROJECT_MORALE_SUPPORTER).toBeUndefined();
    expect(mod.PROJECT_MORALE_OPPOSED).toBeUndefined();
    expect(mod.PROJECT_MORALE_STRONGLY_OPPOSED).toBeUndefined();
    expect(mod.PROJECT_MORALE_CONVICTION_THRESHOLD).toBeUndefined();
    expect(mod.PROJECT_CONVICTION_BOOST_VOTER).toBeUndefined();
    expect(mod.PROJECT_CONVICTION_BOOST_STRONG_SUPPORTER).toBeUndefined();
    expect(mod.PROJECT_CONVICTION_BOOST_SUPPORTER).toBeUndefined();
    expect(mod.LOBBY_BASE_COST).toBeUndefined();
    expect(mod.LOBBY_AFFINITY_BOOST).toBeUndefined();
    expect(mod.LOBBY_INFLUENCE_COST_MULTIPLIER).toBeUndefined();
    expect(mod.LOBBY_MIN_BOOST).toBeUndefined();
    expect(mod.LOBBY_MAX_BOOST).toBeUndefined();
  });
});

describe("IdeologyBalance - New colonist ideology (axis-based)", () => {
  it("NEW_COLONIST_IDEOLOGY uses axis format with center positions", () => {
    expect(NEW_COLONIST_IDEOLOGY.solidarity).toBe(0);
    expect(NEW_COLONIST_IDEOLOGY.sovereignty).toBe(0);
    expect(NEW_COLONIST_IDEOLOGY.transformation).toBe(0);
    expect(NEW_COLONIST_IDEOLOGY.conviction).toBe(0.2);
  });

  it("NEW_COLONIST_IDEOLOGY does not have old faction-affinity keys", () => {
    const keys = Object.keys(NEW_COLONIST_IDEOLOGY);
    expect(keys).not.toContain("earthLoyalist");
    expect(keys).not.toContain("marsIndependence");
    expect(keys).not.toContain("corporateInterests");
  });
});

describe("IdeologyBalance - Faction naming thresholds", () => {
  it("moderate threshold is less than extreme threshold", () => {
    expect(FACTION_NAME_THRESHOLD_MODERATE).toBeLessThan(FACTION_NAME_THRESHOLD_EXTREME);
  });
});

describe("IdeologyBalance - Starting faction positions", () => {
  it("has exactly 3 starting factions", () => {
    expect(STARTING_FACTION_POSITIONS).toHaveLength(3);
  });

  it("Earth Loyalists start sovereignty-negative", () => {
    const earth = STARTING_FACTION_POSITIONS.find((f) => f.baseId === "earth_loyalists");
    expect(earth).toBeDefined();
    expect(earth?.name).toBe("Earth Loyalists");
    expect(earth?.position.sovereignty).toBeLessThan(0);
  });

  it("Mars Independence starts sovereignty-positive", () => {
    const mars = STARTING_FACTION_POSITIONS.find((f) => f.baseId === "mars_independence");
    expect(mars).toBeDefined();
    expect(mars?.name).toBe("Mars Independence");
    expect(mars?.position.sovereignty).toBeGreaterThan(0);
  });

  it("Corporate Interests starts solidarity-negative", () => {
    const corp = STARTING_FACTION_POSITIONS.find((f) => f.baseId === "corporate_interests");
    expect(corp).toBeDefined();
    expect(corp?.name).toBe("Corporate Interests");
    expect(corp?.position.solidarity).toBeLessThan(0);
  });

  it("all faction positions are within [-1, 1] range", () => {
    for (const faction of STARTING_FACTION_POSITIONS) {
      const { solidarity, sovereignty, transformation } = faction.position;
      expect(solidarity).toBeGreaterThanOrEqual(-1);
      expect(solidarity).toBeLessThanOrEqual(1);
      expect(sovereignty).toBeGreaterThanOrEqual(-1);
      expect(sovereignty).toBeLessThanOrEqual(1);
      expect(transformation).toBeGreaterThanOrEqual(-1);
      expect(transformation).toBeLessThanOrEqual(1);
    }
  });
});
