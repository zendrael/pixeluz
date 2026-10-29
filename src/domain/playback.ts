import type { LoopDirection, SpriteDocument } from "./types";

export interface PlaybackStep {
  index: number;
  ping: 1 | -1;
}

export function playbackBounds(doc: SpriteDocument, index: number): { from: number; to: number; direction: LoopDirection } {
  const last = Math.max(0, doc.frames.length - 1);
  const tag = doc.tags.find((item) => {
    const from = Math.min(item.from, item.to);
    const to = Math.max(item.from, item.to);
    return index >= from && index <= to;
  });
  if (!tag) return { from: 0, to: last, direction: "forward" };
  return {
    from: Math.max(0, Math.min(tag.from, tag.to)),
    to: Math.min(last, Math.max(tag.from, tag.to)),
    direction: tag.direction,
  };
}

export function stepPlayback(index: number, from: number, to: number, direction: LoopDirection, ping: 1 | -1): PlaybackStep {
  if (from === to) return { index: from, ping: 1 };
  if (direction === "forward") return { index: index >= to ? from : index + 1, ping: 1 };
  if (direction === "reverse") return { index: index <= from ? to : index - 1, ping: -1 };
  let next = index + ping;
  let dir = ping;
  if (next > to) {
    dir = -1;
    next = to - 1;
  } else if (next < from) {
    dir = 1;
    next = from + 1;
  }
  return { index: Math.max(from, Math.min(to, next)), ping: dir };
}
