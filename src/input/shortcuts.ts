import { TOOL_META } from "../tools/catalog";
import type { ToolId } from "../tools/tool";

export type BindingId =
  | ToolId
  | "undo"
  | "redo"
  | "save"
  | "new"
  | "play"
  | "prev-frame"
  | "next-frame"
  | "copy"
  | "paste";

export type Bindings = Record<BindingId, string>;

export type Shortcut =
  | { type: "tool"; tool: ToolId }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "save" }
  | { type: "play" }
  | { type: "frame"; delta: number }
  | { type: "new" }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "space"; down: boolean };

const ORDER: BindingId[] = [
  ...TOOL_META.map((tool) => tool.id),
  "undo",
  "redo",
  "save",
  "new",
  "play",
  "prev-frame",
  "next-frame",
  "copy",
  "paste",
];

const EXTRA: Partial<Record<BindingId, string[]>> = {
  ellipse: ["shift+u"],
  redo: ["mod+y"],
  "prev-frame": [","],
  "next-frame": ["."],
};

const STORAGE_KEY = "pixeluz.shortcuts";

export function bindingOrder(): BindingId[] {
  return [...ORDER];
}

export function isBindingId(value: string | undefined): value is BindingId {
  return !!value && (ORDER as string[]).includes(value);
}

export function defaultBindings(): Bindings {
  const bindings = {
    undo: "mod+z",
    redo: "mod+shift+z",
    save: "mod+s",
    new: "mod+n",
    play: "enter",
    "prev-frame": "arrowleft",
    "next-frame": "arrowright",
    copy: "mod+c",
    paste: "mod+v",
  } as Bindings;
  for (const tool of TOOL_META) bindings[tool.id] = tool.key;
  return bindings;
}

export function loadBindings(): Bindings {
  const bindings = defaultBindings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return bindings;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return bindings;
    const record = parsed as Record<string, unknown>;
    for (const id of ORDER) {
      const value = record[id];
      if (typeof value === "string" && value) bindings[id] = value;
    }
  } catch {
    /* sem armazenamento */
  }
  return bindings;
}

export function saveBindings(bindings: Bindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* sem armazenamento */
  }
}

export function resetBindings(): Bindings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sem armazenamento */
  }
  return defaultBindings();
}

export function chordFromEvent(event: KeyboardEvent): string | null {
  if (event.key === "Control" || event.key === "Shift" || event.key === "Alt" || event.key === "Meta") return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(event.key === " " ? "space" : event.key.toLowerCase());
  return parts.join("+");
}

export function formatChord(chord: string): string {
  return chord
    .split("+")
    .map((part) => {
      if (part === "mod") return "Ctrl";
      if (part === "shift") return "Shift";
      if (part === "alt") return "Alt";
      if (part === "arrowleft") return "←";
      if (part === "arrowright") return "→";
      if (part === "arrowup") return "↑";
      if (part === "arrowdown") return "↓";
      if (part === "space") return "Space";
      if (part === "enter") return "Enter";
      if (part.length === 1) return part.toUpperCase();
      return part;
    })
    .join("+");
}

export function shortcutForChord(chord: string, bindings: Bindings): Shortcut | null {
  const defaults = defaultBindings();
  for (const id of ORDER) {
    if (bindings[id] === chord) return toShortcut(id);
  }
  for (const id of ORDER) {
    if (bindings[id] !== defaults[id]) continue;
    if ((EXTRA[id] ?? []).includes(chord)) return toShortcut(id);
  }
  return null;
}

export function bindingOwner(bindings: Bindings, chord: string, except: BindingId): BindingId | null {
  const next = { ...bindings, [except]: chord };
  const defaults = defaultBindings();
  for (const id of ORDER) {
    if (id !== except && next[id] === chord) return id;
  }
  for (const id of ORDER) {
    if (id === except || next[id] !== defaults[id]) continue;
    if ((EXTRA[id] ?? []).includes(chord)) return id;
  }
  return null;
}

export function matchShortcut(event: KeyboardEvent, bindings: Bindings = loadBindings()): Shortcut | null {
  if (typingTarget(event.target)) return null;
  if (typeof document !== "undefined" && document.querySelector(".modal.show")) return null;
  if (event.key === " ") return { type: "space", down: event.type === "keydown" };
  if (event.type !== "keydown") return null;
  const chord = chordFromEvent(event);
  if (!chord) return null;
  const action = shortcutForChord(chord, bindings);
  if (!action) return null;
  if (event.repeat && action.type !== "frame") return null;
  return action;
}

function toShortcut(id: BindingId): Shortcut {
  if (id === "undo" || id === "redo" || id === "save" || id === "play" || id === "new" || id === "copy" || id === "paste") return { type: id };
  if (id === "prev-frame") return { type: "frame", delta: -1 };
  if (id === "next-frame") return { type: "frame", delta: 1 };
  return { type: "tool", tool: id };
}

function typingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A" || target.isContentEditable;
}
