// tests/NPCInfluenceMatrix.test.ts

import { describe, it, expect } from 'bun:test';
import {
  matrixMultiply,
  matrixVectorMultiply,
  updateSupport,
} from '../src/core/systems/NPCInfluenceManager';

describe('Matrix utilities', () => {
  describe('matrixMultiply', () => {
    it('should multiply two 2x2 matrices', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];
      const B = [
        [5, 6],
        [7, 8],
      ];
      const result = matrixMultiply(A, B);
      expect(result).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it('should handle 3x3 identity matrix', () => {
      const A = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const result = matrixMultiply(A, I);
      expect(result).toEqual(A);
    });
  });

  describe('matrixVectorMultiply', () => {
    it('should multiply matrix by vector', () => {
      const M = [
        [1, 2],
        [3, 4],
      ];
      const v = [5, 6];
      const result = matrixVectorMultiply(M, v);
      expect(result).toEqual([17, 39]);
    });

    it('should handle 3x3 case', () => {
      const M = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const v = [1, 2, 3];
      const result = matrixVectorMultiply(M, v);
      expect(result).toEqual([1, 2, 3]);
    });
  });
});

describe('updateSupport', () => {
  it('should propagate support through network', () => {
    // Two NPCs, one supports (+1), one neutral (0)
    const currentSupport = [1.0, 0.0];
    // Strong connection from NPC 0 to NPC 1
    const W = [
      [0, 0.5], // NPC 0 influenced by NPC 1 at 0.5
      [0.8, 0], // NPC 1 influenced by NPC 0 at 0.8
    ];
    // Full transmission (same faction)
    const T = [
      [1, 1],
      [1, 1],
    ];
    const alpha = 0.5;

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // NPC 0: starts at 1.0, target = 0*1*1 + 0.5*1*0 = 0, moves 50% toward 0 = 0.5
    // NPC 1: starts at 0.0, target = 0.8*1*1 + 0*1*0 = 0.8, moves 50% toward 0.8 = 0.4
    expect(newSupport[0]).toBeCloseTo(0.5, 2);
    expect(newSupport[1]).toBeCloseTo(0.4, 2);
  });

  it('should clamp values to [-1, 1]', () => {
    const currentSupport = [1.0, 1.0, 1.0];
    // All NPCs strongly connected
    const W = [
      [0, 0.9, 0.9],
      [0.9, 0, 0.9],
      [0.9, 0.9, 0],
    ];
    const T = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const alpha = 1.0; // Aggressive drift

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // Values should be clamped to 1.0 max
    for (const s of newSupport) {
      expect(s).toBeLessThanOrEqual(1.0);
      expect(s).toBeGreaterThanOrEqual(-1.0);
    }
  });

  it('should preserve isolated NPC support', () => {
    const currentSupport = [0.5, 0.0, 0.0];
    // NPC 0 has no connections
    const W = [
      [0, 0, 0],
      [0, 0, 0.5],
      [0, 0.5, 0],
    ];
    const T = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const alpha = 0.3;

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // NPC 0 should drift toward 0 (no incoming influence)
    expect(newSupport[0]).toBeCloseTo(0.35, 2); // 0.5 + 0.3*(0 - 0.5) = 0.35
  });
});
