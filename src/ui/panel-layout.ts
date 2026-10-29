export interface PanelLayout {
  sideWidth: number;
  sideOpen: boolean;
  timelineHeight: number;
  timelineOpen: boolean;
}

const KEY = "pixeluz.panels";

export const SIDE_MIN = 220;
export const SIDE_MAX = 480;
export const TIMELINE_MIN = 112;
export const TIMELINE_MAX = 640;
export const TIMELINE_RESERVE = 280;
export const PANEL_COLLAPSED = 44;

export function timelineLimit(viewportHeight: number): number {
  const fitted = Math.round(viewportHeight) - TIMELINE_RESERVE;
  return Math.max(TIMELINE_MIN, Math.min(TIMELINE_MAX, fitted));
}

export function defaultPanelLayout(): PanelLayout {
  return { sideWidth: 288, sideOpen: true, timelineHeight: 192, timelineOpen: true };
}

export function clampPanelLayout(layout: PanelLayout): PanelLayout {
  return {
    sideWidth: clamp(layout.sideWidth, SIDE_MIN, SIDE_MAX),
    sideOpen: layout.sideOpen,
    timelineHeight: clamp(layout.timelineHeight, TIMELINE_MIN, TIMELINE_MAX),
    timelineOpen: layout.timelineOpen,
  };
}

export function readPanelLayout(): PanelLayout {
  const layout = defaultPanelLayout();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return layout;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return layout;
    const record = parsed as Record<string, unknown>;
    if (typeof record.sideWidth === "number") layout.sideWidth = record.sideWidth;
    if (typeof record.timelineHeight === "number") layout.timelineHeight = record.timelineHeight;
    if (typeof record.sideOpen === "boolean") layout.sideOpen = record.sideOpen;
    if (typeof record.timelineOpen === "boolean") layout.timelineOpen = record.timelineOpen;
  } catch {
    /* sem armazenamento */
  }
  return clampPanelLayout(layout);
}

export function writePanelLayout(layout: PanelLayout): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(clampPanelLayout(layout)));
  } catch {
    /* sem armazenamento */
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
