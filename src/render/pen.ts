const PEN_MEMORY_MS = 800;

export function palmBlocksTouch(pointerType: string, penActive: boolean, penSeenAt: number | null, now: number): boolean {
  if (pointerType !== "touch") return false;
  if (penActive) return true;
  return penSeenAt !== null && now - penSeenAt <= PEN_MEMORY_MS;
}

export function pointerSamples<T>(coalesced: readonly T[], current: T): readonly T[] {
  return coalesced.length > 0 ? coalesced : [current];
}
