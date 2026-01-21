// tests/NPCInfluenceMatrix.test.ts

import { describe, it, expect } from 'bun:test';
import {
  matrixMultiply,
  matrixVectorMultiply,
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
