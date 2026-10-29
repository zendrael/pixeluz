export function redundantMiddle(a: [number, number], b: [number, number], c: [number, number]): boolean {
  if (Math.abs(c[0] - a[0]) !== 1 || Math.abs(c[1] - a[1]) !== 1) return false;
  const corners: Array<[number, number]> = [
    [a[0], c[1]],
    [c[0], a[1]],
  ];
  return corners.some((corner) => corner[0] === b[0] && corner[1] === b[1]);
}

export function pixelPerfectPoints(points: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    out.push(point);
    if (out.length < 3) continue;
    const first = out[out.length - 3];
    const middle = out[out.length - 2];
    const third = out[out.length - 1];
    if (first && middle && third && redundantMiddle(first, middle, third)) out.splice(out.length - 2, 1);
  }
  return out;
}
