// src/core/systems/NPCInfluenceManager.ts

/**
 * Multiply two matrices A × B
 * A is m×n, B is n×p, result is m×p
 */
export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;

  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

/**
 * Multiply matrix M by vector v
 * M is m×n, v is n×1, result is m×1
 */
export function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  const result = new Array(M.length).fill(0);

  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += M[i][j] * v[j];
    }
  }

  return result;
}

/**
 * Update support levels using discrete-time linear dynamics:
 * s(t+1) = s(t) + α((W ⊙ T) × s(t) - s(t))
 *
 * Where W ⊙ T is the Hadamard (element-wise) product of the weight and
 * transmission matrices. This means T[i][j] modifies how much of W[i][j]'s
 * influence gets transmitted based on faction compatibility.
 *
 * @param currentSupport - Current support levels per NPC
 * @param W - Relationship weight matrix (who influences whom)
 * @param T - Transmission factor matrix (faction compatibility)
 * @param alpha - Drift rate (0.1-0.5)
 * @returns New support levels, clamped to [-1, 1]
 */
export function updateSupport(
  currentSupport: number[],
  W: number[][],
  T: number[][],
  alpha: number
): number[] {
  const N = currentSupport.length;

  // Compute effective influence matrix: W ⊙ T (Hadamard/element-wise product)
  const WT: number[][] = Array(N)
    .fill(0)
    .map(() => Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      WT[i][j] = W[i][j] * T[i][j];
    }
  }

  // Compute target support: WT × s(t)
  const target = matrixVectorMultiply(WT, currentSupport);

  // Move toward target by alpha
  const newSupport = new Array(N);
  for (let i = 0; i < N; i++) {
    newSupport[i] = currentSupport[i] + alpha * (target[i] - currentSupport[i]);
    // Clamp to valid range
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newSupport[i]));
  }

  return newSupport;
}
