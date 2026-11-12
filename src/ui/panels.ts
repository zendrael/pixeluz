import { rgbaToCss, rgbaToHex } from "../domain/color";
import type { PalettePreset } from "../domain/palettes";
import { celGridModel } from "../domain/sprite";
import type { ImageBuffer, Rgba, Slice, SpriteDocument, Tileset } from "../domain/types";
import { bindingOrder, formatChord, type BindingId, type Bindings } from "../input/shortcuts";
import { compositeFrame } from "../render/composite";
import { TOOL_META } from "../tools/catalog";
import { escapeHtml } from "./html";
import { icon, iconClass } from "./icons";
import { text } from "./i18n";

export function renderToolbars(hosts: HTMLElement[], bindings: Bindings): void {
  const html = TOOL_META.map((tool) => {
    const label = text[tool.labelKey];
    const hint = formatChord(bindings[tool.id]);
    return `<button type="button" class="btn btn-outline-secondary tool-btn" data-tool="${tool.id}" title="${escapeHtml(label)} (${hint})" aria-label="${escapeHtml(label)}" aria-pressed="false"><i class="${iconClass(tool.icon)}" aria-hidden="true"></i></button>`;
  }).join("");
  for (const host of hosts) host.innerHTML = html;
}

export function renderPalettes(hosts: HTMLElement[], colors: Rgba[], selected: number): void {
  const html = `<div class="palette-grid">${colors
    .map((color, index) => {
      const selectedClass = index === selected ? " selected" : "";
      const clear = color.a === 0 ? " is-clear" : "";
      const style = color.a === 0 ? "" : ` style="background:${rgbaToCss(color)}"`;
      return `<button type="button" class="palette-swatch${selectedClass}${clear}" data-index="${index}" aria-label="${rgbaToHex(color)}"${style}></button>`;
    })
    .join("")}</div>`;
  for (const host of hosts) host.innerHTML = html;
}

export function renderLayers(
  hosts: HTMLElement[],
  doc: SpriteDocument,
  activeLayerId: string,
  collapsedGroups: ReadonlySet<string> = new Set(),
): void {
  const hidden = hiddenByCollapse(doc, collapsedGroups);
  const html = `<div class="list-group">${[...doc.layers]
    .reverse()
    .filter((layer) => !hidden.has(layer.id))
    .map((layer) => {
      const visibility = layer.visible ? "eye" : "eye-slash";
      const label = layer.visible ? text.hideLayer : text.showLayer;
      const lockName = layer.locked ? "lock-simple" : "lock-simple-open";
      const lockLabel = layer.locked ? text.unlockLayer : text.lockLayer;
      const active = layer.id === activeLayerId ? " active" : "";
      const kind = layer.kind === "group" ? text.kindGroup : layer.kind === "reference" ? text.kindReference : layer.kind === "tilemap" ? text.kindTiles : "";
      const pad = layerDepth(doc, layer) * 0.75;
      const groupLabel = collapsedGroups.has(layer.id) ? text.expandGroup : text.collapseGroup;
      const collapse =
        layer.kind === "group"
          ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-action="toggle-group" data-layer-id="${layer.id}" title="${groupLabel}" aria-label="${groupLabel}">${icon(collapsedGroups.has(layer.id) ? "caret-right" : "caret-down")}</button>`
          : "";
      return `<div class="list-group-item d-flex align-items-center gap-2${active}" style="padding-left:${0.75 + pad}rem" data-action="select-layer" data-layer-id="${layer.id}">${collapse}<button type="button" class="btn btn-sm btn-outline-secondary" data-action="toggle-layer" data-layer-id="${layer.id}" title="${label}" aria-label="${label}">${icon(visibility)}</button><button type="button" class="btn btn-sm btn-outline-secondary" data-action="toggle-layer-lock" data-layer-id="${layer.id}" title="${lockLabel}" aria-label="${lockLabel}">${icon(lockName)}</button><input class="form-control form-control-sm layer-name" data-layer-name="${layer.id}" value="${escapeHtml(layer.name)}" aria-label="${text.renameLayer}" />${kind ? `<span class="small text-secondary">${kind}</span>` : ""}</div>`;
    })
    .join("")}</div>`;
  for (const host of hosts) host.innerHTML = html;
}

function hiddenByCollapse(doc: SpriteDocument, collapsedGroups: ReadonlySet<string>): Set<string> {
  const hidden = new Set<string>();
  if (collapsedGroups.size === 0) return hidden;
  for (const layer of doc.layers) {
    let parentId = layer.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      if (collapsedGroups.has(parentId)) {
        hidden.add(layer.id);
        break;
      }
      parentId = doc.layers.find((item) => item.id === parentId)?.parentId ?? null;
    }
  }
  return hidden;
}

function layerDepth(doc: SpriteDocument, layer: SpriteDocument["layers"][number]): number {
  let depth = 0;
  let parentId = layer.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId) && depth < 8) {
    seen.add(parentId);
    depth += 1;
    parentId = doc.layers.find((item) => item.id === parentId)?.parentId ?? null;
  }
  return depth;
}

export function renderTileSwatches(hosts: HTMLElement[], tileset: Tileset | null, selected: number): void {
  const html = tileset
    ? tileset.tiles
        .map((tile, index) => {
          const selectedClass = index === selected ? " selected" : "";
          const image = index === 0 ? "" : ` style="background-image:url(${tilePreview(tile)})"`;
          return `<button type="button" class="tile-swatch${selectedClass}" data-tile="${index}" aria-label="${index}"${image}></button>`;
        })
        .join("")
    : "";
  for (const host of hosts) host.innerHTML = html;
}

export function renderSlices(hosts: HTMLElement[], slices: Slice[]): void {
  const html = slices
    .map(
      (slice) => `<div class="d-flex align-items-center gap-2 mb-1"><span class="small text-truncate">${escapeHtml(slice.name)}</span><button type="button" class="btn btn-sm btn-outline-secondary ms-auto" data-action="delete-slice" data-slice-id="${slice.id}" title="${text.deleteSlice}" aria-label="${text.deleteSlice}">${icon("x")}</button></div>`,
    )
    .join("");
  for (const host of hosts) host.innerHTML = html || `<p class="small text-secondary mb-0">${text.noSlices}</p>`;
}

function tilePreview(tile: ImageBuffer): string {
  const canvas = document.createElement("canvas");
  canvas.width = tile.width;
  canvas.height = tile.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const image = ctx.createImageData(tile.width, tile.height);
  image.data.set(tile.data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function renderTags(hosts: HTMLElement[], doc: SpriteDocument): void {
  const html = doc.tags
    .map(
      (tag) => `<div class="d-flex flex-wrap align-items-center gap-1 mb-1">
        <input class="form-control form-control-sm" style="width:6rem" data-tag-name="${tag.id}" value="${escapeHtml(tag.name)}" aria-label="${text.tagName}" />
        <input class="form-control form-control-sm" style="width:3.5rem" type="number" min="1" data-tag-from="${tag.id}" value="${tag.from + 1}" aria-label="${text.tagFrom}" />
        <input class="form-control form-control-sm" style="width:3.5rem" type="number" min="1" data-tag-to="${tag.id}" value="${tag.to + 1}" aria-label="${text.tagTo}" />
        <select class="form-select form-select-sm" style="width:7.5rem" data-tag-direction="${tag.id}" aria-label="${text.tagDirection}">
          <option value="forward" ${tag.direction === "forward" ? "selected" : ""}>${text.loopForward}</option>
          <option value="reverse" ${tag.direction === "reverse" ? "selected" : ""}>${text.loopReverse}</option>
          <option value="ping-pong" ${tag.direction === "ping-pong" ? "selected" : ""}>${text.loopPing}</option>
        </select>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="use-tag" data-tag-id="${tag.id}">${text.useTag}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-action="delete-tag" data-tag-id="${tag.id}" title="${text.deleteTag}" aria-label="${text.deleteTag}">${icon("x")}</button>
      </div>`,
    )
    .join("");
  for (const host of hosts) host.innerHTML = html || `<p class="small text-secondary mb-0">${text.noTags}</p>`;
}

export function renderTabs(host: HTMLElement, tabs: Array<{ name: string; dirty: boolean; active: boolean }>): void {
  const buttons = tabs
    .map((tab, index) => {
      const active = tab.active ? " btn-primary" : " btn-outline-secondary";
      const mark = tab.dirty ? " •" : "";
      return `<div class="btn-group"><button type="button" class="btn btn-sm text-truncate${active}" style="max-width:9rem" data-tab="${index}">${escapeHtml(tab.name)}${mark}</button><button type="button" class="btn btn-sm btn-outline-secondary" data-action="close-tab" data-tab="${index}" title="${text.closeTab}" aria-label="${text.closeTab}">${icon("x")}</button></div>`;
    })
    .join("");
  host.innerHTML = `${buttons}<button type="button" class="btn btn-sm doc-tab-add" data-action="add-tab" title="${text.addTab}" aria-label="${text.addTab}">${icon("plus")}</button>`;
}

export function renderFrames(
  hosts: HTMLElement[],
  doc: SpriteDocument,
  activeIndex: number,
  activeLayerId = "",
): void {
  const { layerIds, frameIds } = celGridModel(doc);
  const header = `<div class="cel-grid-corner"></div>${frameIds
    .map((frameId, index) => {
      const duration = doc.frames.find((frame) => frame.id === frameId)?.durationMs ?? 100;
      return `<div class="cel-grid-frame-label small text-center${index === activeIndex ? " text-primary fw-semibold" : ""}"><div>${index + 1}</div><div class="cel-duration-badge text-secondary">${duration}</div></div>`;
    })
    .join("")}`;
  const rows = layerIds
    .map((layerId) => {
      const layer = doc.layers.find((item) => item.id === layerId);
      const name = escapeHtml(layer?.name ?? layerId);
      const cells = frameIds
        .map((frameId, index) => {
          const active = index === activeIndex && layerId === activeLayerId ? " border-primary" : "";
          return `<button type="button" class="frame-cell btn btn-outline-secondary p-1${active}" data-frame-index="${index}" data-layer-id="${layerId}" title="${name} · ${index + 1}"><canvas class="frame-thumb" data-frame-id="${frameId}" data-layer-id="${layerId}" width="${doc.width}" height="${doc.height}"></canvas></button>`;
        })
        .join("");
      return `<div class="cel-grid-layer-label small text-truncate" title="${name}">${name}</div>${cells}`;
    })
    .join("");
  const columns = Math.max(1, frameIds.length + 1);
  const html = `<div class="cel-grid" style="grid-template-columns:minmax(4.5rem,7rem) repeat(${Math.max(1, frameIds.length)}, max-content)">${header}${rows}</div>`;
  for (const host of hosts) {
    host.innerHTML = html;
    host.style.setProperty("--cel-columns", String(columns));
    for (const canvas of host.querySelectorAll<HTMLCanvasElement>("canvas.frame-thumb")) {
      const frameId = canvas.dataset.frameId;
      if (frameId) drawThumb(canvas, doc, frameId);
    }
  }
}

export function previewPixels(spriteWidth: number, spriteHeight: number, boxWidth: number, boxHeight: number): { width: number; height: number } {
  if (boxWidth < 2 || boxHeight < 2 || spriteWidth < 1 || spriteHeight < 1) {
    return { width: spriteWidth, height: spriteHeight };
  }
  const fit = Math.min(boxWidth / spriteWidth, boxHeight / spriteHeight);
  const scale = fit >= 1 ? Math.max(1, Math.floor(fit)) : fit;
  return {
    width: Math.max(1, Math.round(spriteWidth * scale)),
    height: Math.max(1, Math.round(spriteHeight * scale)),
  };
}

export function drawPreview(canvas: HTMLCanvasElement, image: ImageBuffer, overlay: ImageBuffer | null): void {
  if (canvas.width !== image.width || canvas.height !== image.height) {
    canvas.width = image.width;
    canvas.height = image.height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixels = overlay ? blendOver(image, overlay) : image.data;
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), image.width, image.height), 0, 0);
  const frame = canvas.parentElement;
  if (!frame || frame.clientWidth < 2 || frame.clientHeight < 2) return;
  const box = previewPixels(image.width, image.height, frame.clientWidth, frame.clientHeight);
  canvas.style.width = `${box.width}px`;
  canvas.style.height = `${box.height}px`;
}

function blendOver(base: ImageBuffer, overlay: ImageBuffer): Uint8ClampedArray {
  const pixels = base.data.slice();
  if (overlay.width !== base.width || overlay.height !== base.height) return pixels;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = overlay.data[index + 3] ?? 0;
    if (alpha === 0) continue;
    const cover = alpha / 255;
    const keep = 1 - cover;
    pixels[index] = Math.round((overlay.data[index] ?? 0) * cover + (pixels[index] ?? 0) * keep);
    pixels[index + 1] = Math.round((overlay.data[index + 1] ?? 0) * cover + (pixels[index + 1] ?? 0) * keep);
    pixels[index + 2] = Math.round((overlay.data[index + 2] ?? 0) * cover + (pixels[index + 2] ?? 0) * keep);
    pixels[index + 3] = Math.min(255, Math.round(alpha + (pixels[index + 3] ?? 0) * keep));
  }
  return pixels;
}

export function drawThumb(canvas: HTMLCanvasElement, doc: SpriteDocument, frameId: string): void {
  const image = compositeFrame(doc, frameId, { references: true });
  if (canvas.width !== image.width || canvas.height !== image.height) {
    canvas.width = image.width;
    canvas.height = image.height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
}

export function setPlaying(root: ParentNode, playing: boolean): void {
  const label = playing ? text.pause : text.play;
  for (const node of root.querySelectorAll<HTMLElement>("[data-action='play'] i")) {
    node.className = iconClass(playing ? "pause" : "play");
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-action='play']")) {
    button.title = label;
    button.setAttribute("aria-label", label);
  }
}

export function renderShortcuts(host: HTMLElement, bindings: Bindings, captureId: BindingId | null): void {
  host.innerHTML = bindingOrder()
    .map((id) => {
      const busy = id === captureId;
      const label = bindingLabel(id);
      const chord = busy ? text.shortcutBusy : formatChord(bindings[id]);
      return `<div class="d-flex align-items-center gap-2 mb-1"><span class="small me-auto">${escapeHtml(label)}</span><kbd>${escapeHtml(chord)}</kbd><button type="button" class="btn btn-sm btn-outline-secondary" data-action="capture-shortcut" data-shortcut="${id}">${text.shortcutCapture}</button></div>`;
    })
    .join("");
}

export function paletteCredit(id: PalettePreset["id"] | ""): string {
  if (id === "db32") return text.creditDb32;
  if (id === "endesga32") return text.creditEndesga;
  if (id === "sweetie16") return text.creditSweetie;
  return "";
}

export function presetName(id: PalettePreset["id"]): string {
  if (id === "db32") return "DB32";
  if (id === "endesga32") return "Endesga 32";
  return "Sweetie 16";
}

function bindingLabel(id: BindingId): string {
  const tool = TOOL_META.find((item) => item.id === id);
  if (tool) return text[tool.labelKey];
  if (id === "undo") return text.undo;
  if (id === "redo") return text.redo;
  if (id === "save") return text.save;
  if (id === "new") return text.newSprite;
  if (id === "play") return text.play;
  if (id === "prev-frame") return text.prevFrame;
  if (id === "next-frame") return text.nextFrame;
  if (id === "copy") return text.copySelection;
  if (id === "cut") return text.cutSelection;
  if (id === "paste") return text.pasteSelection;
  if (id === "select-all") return text.selectAll;
  if (id === "deselect") return text.deselect;
  if (id === "delete-selection") return text.deleteSelection;
  return text.pasteSelection;
}

export function setDuration(root: ParentNode, milliseconds: number): void {
  for (const input of root.querySelectorAll<HTMLInputElement>("[data-action='duration']")) {
    if (document.activeElement === input) continue;
    input.value = String(milliseconds);
  }
}
