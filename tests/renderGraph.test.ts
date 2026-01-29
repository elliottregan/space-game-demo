import { describe, it, expect } from "bun:test";

// Note: These tests are skipped because they require d3-selection package
// which is not available in the test environment. The renderGraph module
// depends on d3-selection for DOM manipulation.

// Skipped: requires d3-selection package which is not installed in test environment
describe.skip("renderGraph data preparation", () => {
  it("should export GraphData and RenderOptions types", async () => {
    // This test verifies the module exports correctly
    const module = await import("../src/renderer/components/NPCGraph/renderGraph");
    expect(typeof module.renderGraph).toBe("function");
  });
});
