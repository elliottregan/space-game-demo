// Matrix utilities for linear algebra operations

/**
 * Multiply two matrices A × B
 * A is m×n, B is n×p, result is m×p
 */
export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0]?.length ?? 0;
  const inner = B.length;

  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    const rowA = A[i];
    const rowResult = result[i];
    if (!rowA || !rowResult) continue;
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        const rowB = B[k];
        if (!rowB) continue;
        rowResult[j] = (rowResult[j] ?? 0) + (rowA[k] ?? 0) * (rowB[j] ?? 0);
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
  const result = Array.from({ length: M.length }, () => 0);

  for (let i = 0; i < M.length; i++) {
    const row = M[i];
    if (!row) continue;
    for (let j = 0; j < v.length; j++) {
      result[i] = (result[i] ?? 0) + (row[j] ?? 0) * (v[j] ?? 0);
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
  alpha: number,
): number[] {
  const N = currentSupport.length;

  // Compute effective influence matrix: W ⊙ T (Hadamard/element-wise product)
  const WT: number[][] = Array(N)
    .fill(0)
    .map(() => Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    const rowWT = WT[i];
    const rowW = W[i];
    const rowT = T[i];
    if (!rowWT || !rowW || !rowT) continue;
    for (let j = 0; j < N; j++) {
      rowWT[j] = (rowW[j] ?? 0) * (rowT[j] ?? 0);
    }
  }

  // Compute target support: WT × s(t)
  const target = matrixVectorMultiply(WT, currentSupport);

  // Move toward target by alpha
  const newSupport: number[] = [];
  for (let i = 0; i < N; i++) {
    const current = currentSupport[i] ?? 0;
    const targetVal = target[i] ?? 0;
    const newVal = current + alpha * (targetVal - current);
    // Clamp to valid range
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newVal));
  }

  return newSupport;
}
