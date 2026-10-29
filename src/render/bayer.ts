export function bayerMatrix(size: 2 | 4 | 8): number[] {
  let current = [0];
  let n = 1;
  while (n < size) {
    const next = new Array<number>(n * 2 * n * 2);
    const side = n * 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const value = current[y * n + x] ?? 0;
        next[y * side + x] = 4 * value;
        next[y * side + x + n] = 4 * value + 2;
        next[(y + n) * side + x] = 4 * value + 3;
        next[(y + n) * side + x + n] = 4 * value + 1;
      }
    }
    current = next;
    n = side;
  }
  return current;
}

const MATRICES = {
  2: bayerMatrix(2),
  4: bayerMatrix(4),
  8: bayerMatrix(8),
} as const;

export function bayerValue(size: 2 | 4 | 8, x: number, y: number): number {
  const matrix = MATRICES[size];
  const wrappedX = ((x % size) + size) % size;
  const wrappedY = ((y % size) + size) % size;
  return matrix[wrappedY * size + wrappedX] ?? 0;
}
