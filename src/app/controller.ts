import { Modal, Offcanvas } from "bootstrap";
import type { BayerSize } from "../domain/draw-options";
import type { BlendMode, ColorMode, LoopDirection, Rgba } from "../domain/types";
import { cropImage, sliceKeyAt } from "../domain/slices";
import { EditorSession, type ChangeKind } from "./session";
import { TRANSPARENT, hexToRgba, rgbaToHex } from "../domain/color";
import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, createSprite } from "../domain/factory";
import { bytesToBlob } from "../io/bytes";
import { downloadBlob, downloadDataUrl, filePickerAvailable, OPEN_FILE_TYPES, PALETTE_FILE_TYPES, pickAndSave, pickFile, pngDataUrl, PROJECT_FILE_TYPES, safeFilename, type FilePickerType } from "../io/files";
import { readAse, writeAse, isAseFile } from "../io/ase";
import { isImageFile, readImageSprite } from "../io/image-file";
import { writeGif } from "../io/gif";
import { encodePng } from "../io/png";
import { atlasJson, buildSpriteSheet } from "../io/sheet";
import { zipStored } from "../io/zip";
import type { FilterKind } from "../domain/filters";
import { fetchLospecPalette, lospecSlug, paletteToHex, parsePaletteFile, type PaletteFile } from "../io/palette-exchange";
import { deserializeProject, serializeProject } from "../io/project-json";
import { deleteProject, listProjects, loadProject, saveProject, saveRecovery } from "../storage/db";
import { bindingOwner, chordFromEvent, isBindingId, loadBindings, matchShortcut, resetBindings, saveBindings, type BindingId, type Bindings, type Shortcut } from "../input/shortcuts";
import { Viewport } from "../render/viewport";
import { createTools } from "../tools/create-tools";
import type { Tool, ToolId } from "../tools/tool";
import { escapeHtml } from "../ui/html";
import { currentLocale, isLocale, text, type Locale } from "../ui/i18n";
import { clampPanelLayout, PANEL_COLLAPSED, readPanelLayout, SIDE_MAX, SIDE_MIN, TIMELINE_MIN, timelineLimit, writePanelLayout, type PanelLayout } from "../ui/panel-layout";
import { panelSnapTarget, prefersReducedMotion, releaseVelocity, rubberband, settleNumber, trackPanelSize } from "../ui/motion";
import { spriteStaysInBrowser } from "../ui/browser-notice";
import { optionGroupsFor } from "../ui/option-groups";
import { PALETTE_PRESETS, presetIdFor, samePalette } from "../domain/palettes";
import {
  drawPreview,
  drawThumb,
  paletteCredit,
  renderFrames,
  renderLayers,
  renderPalettes,
  renderShortcuts,
  renderSlices,
  renderTileSwatches,
  renderTabs,
  renderTags,
  renderToolbars,
  setDuration,
  setPlaying,
} from "../ui/panels";

export interface ControllerBoot {
  sessions?: EditorSession[];
  activeIndex?: number;
  toolId?: ToolId;
  recovered?: boolean;
  reopen?: "settings" | "shortcuts";
}

export interface ControllerHooks {
  rebuild(locale: Locale, reopen?: ControllerBoot["reopen"]): void;
}

function stronger(current: ChangeKind, next: ChangeKind): ChangeKind {
  const rank: Record<ChangeKind, number> = { canvas: 0, chrome: 1, document: 2 };
  return rank[current] >= rank[next] ? current : next;
}

export class Controller {
  private readonly sessions: EditorSession[];
  private activeIndex: number;
  private readonly tools: Map<ToolId, Tool>;
  private tool: Tool;
  private readonly viewport: Viewport;
  private readonly abort = new AbortController();
  private readonly stops: Array<() => void> = [];
  private bindings: Bindings = loadBindings();
  private layout: PanelLayout = readPanelLayout();
  private captureId: BindingId | null = null;
  private autosaveTimer = 0;
  private selectedPalette = 0;
  private lospecNote: { colors: Rgba[]; text: string; name: string } | null = null;
  private pending: ChangeKind | null = null;
  private frame = 0;
  private flashTimer = 0;
  private hover: { x: number; y: number } | null = null;
  private layoutMotion: (() => void) | null = null;
  private readonly sheetMotions = new Map<HTMLElement, () => void>();

  private get session(): EditorSession {
    return this.sessions[this.activeIndex] ?? this.sessions[0]!;
  }

  constructor(
    private readonly root: HTMLElement,
    private readonly hooks: ControllerHooks,
    boot?: ControllerBoot,
  ) {
    this.sessions = boot?.sessions && boot.sessions.length > 0 ? boot.sessions : [new EditorSession()];
    this.activeIndex = Math.max(0, Math.min(boot?.activeIndex ?? 0, this.sessions.length - 1));
    this.tools = createTools();
    const pencil = this.tools.get("pencil");
    if (!pencil) throw new Error("Ferramenta ausente");
    this.tool = boot?.toolId ? (this.tools.get(boot.toolId) ?? pencil) : pencil;
    const host = this.required<HTMLElement>("#viewport-host");
    this.viewport = new Viewport(host, () => this.session, () => this.tool, (point) => {
      this.hover = point;
      this.required("#status-pos").textContent = point ? `${point.x}, ${point.y}` : "";
    });
    renderToolbars(this.hosts(".tool-host"), this.bindings);
    this.bind();
    this.applyLayout();
    for (const session of this.sessions) this.watch(session);
    this.flush("document");
    this.autosaveTimer = window.setInterval(() => void this.autosave(), 4000);
    requestAnimationFrame(() => {
      this.viewport.fit();
      this.drawPreviews();
    });
    if (boot?.recovered) this.flash(text.recovered);
    if (boot?.reopen) this.openDialog(boot.reopen);
  }

  handoff(): { sessions: EditorSession[]; activeIndex: number; toolId: ToolId } {
    return { sessions: this.sessions, activeIndex: this.activeIndex, toolId: this.tool.id };
  }

  dispose(): void {
    this.abort.abort();
    this.stopLayoutMotion();
    for (const stop of this.sheetMotions.values()) stop();
    this.sheetMotions.clear();
    for (const stop of this.stops) stop();
    window.clearInterval(this.autosaveTimer);
    window.clearTimeout(this.flashTimer);
    this.viewport.dispose();
    for (const session of this.sessions) session.pausePlayback();
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
    for (const node of document.querySelectorAll(".modal-backdrop")) node.remove();
  }

  private bind(): void {
    const signal = this.abort.signal;
    this.root.addEventListener("pointerdown", (event) => {
      this.onPanelResize(event);
      this.onSheetGrab(event);
    }, { signal });
    this.root.addEventListener("click", (event) => this.onClick(event), { signal });
    this.required("#modal-settings").addEventListener("show.bs.modal", () => {
      this.syncCanvasFields();
    }, { signal });
    this.root.addEventListener("contextmenu", (event) => this.onPaletteMenu(event), { signal });
    this.root.addEventListener("change", (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.id === "locale-select") {
        if (isLocale(target.value) && target.value !== currentLocale()) this.hooks.rebuild(target.value, "settings");
        return;
      }
      if (target instanceof HTMLInputElement && target.dataset.option) {
        this.onOption(target);
        return;
      }
      if (target instanceof HTMLSelectElement && target.dataset.option) {
        this.onOption(target);
        return;
      }
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
        if (target.dataset.field || target.dataset.tagName || target.dataset.tagFrom || target.dataset.tagTo || target.dataset.tagDirection) {
          this.onDocumentField(target);
          return;
        }
      }
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.layerName) {
        this.session.renameLayer(target.dataset.layerName, target.value);
        return;
      }
      if (target.dataset.action === "duration") {
        this.session.setFrameDuration(Number(target.value));
        target.value = String(this.session.doc.frames[this.session.activeFrameIndex]?.durationMs ?? 100);
      }
      if (target.id === "doc-name") {
        this.session.setName(target.value);
        target.value = this.session.doc.name;
      }
    }, { signal });
    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-color-role]")) {
      input.addEventListener("input", () => this.onColorInput(input), { signal });
    }
    this.required<HTMLFormElement>("#form-new").addEventListener("submit", (event) => {
      event.preventDefault();
      this.createSprite();
    }, { signal });
    this.required<HTMLFormElement>("#form-canvas").addEventListener("submit", (event) => {
      event.preventDefault();
      this.resizeCanvasFromSettings();
      Modal.getInstance(this.required("#modal-settings"))?.hide();
    }, { signal });
    this.required("#offcanvas-colors").addEventListener("shown.bs.offcanvas", () => this.drawPreviews(), { signal });
    for (const sheet of this.root.querySelectorAll<HTMLElement>(".pixeluz-sheet")) this.bindSheet(sheet, signal);
    this.required("#modal-open").addEventListener("show.bs.modal", () => {
      void this.refreshProjects();
    }, { signal });
    this.required("#modal-shortcuts").addEventListener("keydown", (event) => this.onShortcutCapture(event), { signal });
    this.required<HTMLInputElement>("#file-input").addEventListener("change", () => {
      const input = this.required<HTMLInputElement>("#file-input");
      const file = input.files?.[0];
      input.value = "";
      if (file) void this.openFile(file);
    }, { signal });
    this.required<HTMLInputElement>("#palette-file").addEventListener("change", () => {
      const input = this.required<HTMLInputElement>("#palette-file");
      const file = input.files?.[0];
      input.value = "";
      if (file) void this.readPaletteFile(file);
    }, { signal });
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const field = event.target;
      if (!(field instanceof HTMLInputElement) || field.dataset.field !== "lospec") return;
      event.preventDefault();
      void this.importLospec(field);
    }, { signal });
    window.addEventListener("keydown", (event) => {
      if (!typingTarget(event.target) && this.tool.onKey?.(event)) {
        event.preventDefault();
        return;
      }
      const action = matchShortcut(event, this.bindings);
      if (!action) return;
      event.preventDefault();
      if (this.session.strokeOpen && action.type !== "space") return;
      this.onShortcut(action);
    }, { signal });
    window.addEventListener("keyup", (event) => {
      if (event.key === " ") this.viewport.setSpaceHeld(false);
    }, { signal });
    window.addEventListener("beforeunload", (event) => {
      if (!this.sessions.some((item) => item.dirty)) return;
      event.preventDefault();
      event.returnValue = "";
    }, { signal });
    window.addEventListener("resize", () => this.applyLayout(), { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.autosave();
    }, { signal });
    this.required<HTMLButtonElement>("#btn-grid").title = text.gridHint;
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-tool], [data-action], [data-index], [data-frame-index], [data-open], [data-delete], [data-tab], [data-tile]",
    );
    if (!target) return;
    if (target.dataset.tool) {
      this.setTool(target.dataset.tool as ToolId);
      return;
    }
    if (target.dataset.open) {
      void this.openStored(target.dataset.open);
      return;
    }
    if (target.dataset.delete) {
      event.stopPropagation();
      void this.removeStored(target.dataset.delete);
      return;
    }
    if (target.dataset.index) {
      this.pickPalette(Number(target.dataset.index), "fg");
      return;
    }
    if (target.dataset.frameIndex) {
      this.session.setActiveFrame(Number(target.dataset.frameIndex));
      return;
    }
    if (target.dataset.tile) {
      this.session.setSelectedTile(Number(target.dataset.tile));
      return;
    }
    if (target.dataset.tab !== undefined && !target.dataset.action) {
      this.switchTab(Number(target.dataset.tab));
      return;
    }
    const action = target.dataset.action;
    if (!action) return;
    this.onAction(action, target);
  }

  private onAction(action: string, target: HTMLElement): void {
    switch (action) {
      case "new":
        Modal.getOrCreateInstance(this.required("#modal-new")).show();
        break;
      case "open":
        Modal.getOrCreateInstance(this.required("#modal-open")).show();
        break;
      case "save":
        void this.save();
        break;
      case "export":
        this.exportPng();
        break;
      case "export-gif":
        this.exportGif();
        break;
      case "export-sequence":
        this.exportSequence();
        break;
      case "export-sheet":
        this.exportSheet();
        break;
      case "export-ase":
        this.exportAse();
        break;
      case "settings":
        this.openDialog("settings");
        break;
      case "toggle-panel":
        this.togglePanel(target.dataset.panel);
        break;
      case "toggle-frame-edit":
        this.toggleFrameEdit();
        break;
      case "shortcuts":
        this.captureId = null;
        this.renderShortcutSheet();
        this.openDialog("shortcuts");
        break;
      case "capture-shortcut":
        if (isBindingId(target.dataset.shortcut)) {
          this.captureId = target.dataset.shortcut;
          this.renderShortcutSheet();
        }
        break;
      case "reset-shortcuts":
        this.bindings = resetBindings();
        this.captureId = null;
        this.renderShortcutSheet();
        renderToolbars(this.hosts(".tool-host"), this.bindings);
        this.updateToolButtons();
        break;
      case "resize-canvas":
        this.resizeCanvasFromSettings();
        break;
      case "crop-selection":
        if (!this.session.cropToSelection()) this.flash(text.needsSelection, "danger");
        else {
          this.viewport.fit();
          this.syncCanvasFields();
        }
        break;
      case "autocrop":
        this.session.autocrop();
        this.viewport.fit();
        this.syncCanvasFields();
        break;
      case "rotsprite":
        this.session.applyRotSprite(Number(this.required<HTMLInputElement>("#rotsprite-angle").value));
        break;
      case "insert-text":
        this.session.insertText(this.required<HTMLInputElement>("#text-input").value);
        break;
      case "add-slice":
        this.session.addSlice();
        break;
      case "delete-slice":
        if (target.dataset.sliceId) this.session.deleteSlice(target.dataset.sliceId);
        break;
      case "export-slices":
        this.exportSlices();
        break;
      case "add-tilemap":
        if (!this.session.addLayer("tilemap")) this.flash(text.layerLimit, "danger");
        break;
      case "download":
        this.downloadProject();
        break;
      case "apply-filter":
        this.applyFilter(target);
        break;
      case "undo":
        this.session.undo();
        break;
      case "redo":
        this.session.redo();
        break;
      case "grid":
        this.session.togglePixelGrid();
        break;
      case "fit":
        this.viewport.fit();
        break;
      case "browse":
        void this.browseFiles();
        break;
      case "play":
        this.session.togglePlayback();
        break;
      case "add-frame":
        this.session.addFrame(true);
        break;
      case "duplicate-frame":
        this.session.addFrame(false);
        break;
      case "delete-frame":
        this.session.deleteActiveFrame();
        break;
      case "first-frame":
        this.session.setActiveFrame(0);
        break;
      case "prev-frame":
        this.session.stepFrame(-1);
        break;
      case "next-frame":
        this.session.stepFrame(1);
        break;
      case "last-frame":
        this.session.setActiveFrame(this.session.doc.frames.length - 1);
        break;
      case "palette-add":
        this.session.addPaletteColor({ ...this.session.foreground });
        this.selectedPalette = this.session.doc.palette.length - 1;
        break;
      case "palette-replace":
        this.session.setPaletteColor(this.selectedPalette, { ...this.session.foreground });
        break;
      case "palette-remove":
        this.session.removePaletteColor(this.selectedPalette);
        this.clampPalette();
        break;
      case "palette-lospec":
        void this.importLospec(target);
        break;
      case "palette-import":
        void this.importPaletteFile();
        break;
      case "palette-export":
        this.exportPalette();
        break;
      case "bg-clear":
        this.session.setBackground({ ...TRANSPARENT });
        break;
      case "toggle-layer":
        if (target.dataset.layerId) {
          this.session.setActiveLayer(target.dataset.layerId);
          this.session.toggleLayer(target.dataset.layerId);
        }
        break;
      case "select-layer":
        if (target.dataset.layerId) this.session.setActiveLayer(target.dataset.layerId);
        break;
      case "add-layer":
        if (!this.session.addLayer("image")) this.flash(text.layerLimit, "danger");
        break;
      case "add-group":
        if (!this.session.addLayer("group")) this.flash(text.layerLimit, "danger");
        break;
      case "add-reference":
        if (!this.session.addLayer("reference")) this.flash(text.layerLimit, "danger");
        break;
      case "delete-layer":
        this.session.deleteActiveLayer();
        break;
      case "layer-up":
        this.session.moveLayer(1);
        break;
      case "layer-down":
        this.session.moveLayer(-1);
        break;
      case "flip-h":
        this.session.transformSelection("flip-h");
        break;
      case "flip-v":
        this.session.transformSelection("flip-v");
        break;
      case "rotate-selection":
        this.session.transformSelection("rotate");
        break;
      case "scale-up":
        this.session.transformSelection("scale-up");
        break;
      case "scale-down":
        this.session.transformSelection("scale-down");
        break;
      case "copy-selection":
        this.session.transformSelection("copy");
        break;
      case "clear-selection":
        this.session.clearSelection();
        break;
      case "brush-from-selection":
        if (!this.session.captureBrush()) this.flash(text.brushNeedsSelection, "danger");
        break;
      case "link-cel":
        this.session.linkActiveCel();
        break;
      case "unlink-cel":
        this.session.unlinkActiveCel();
        break;
      case "frame-earlier":
        this.session.moveActiveFrame(-1);
        break;
      case "frame-later":
        this.session.moveActiveFrame(1);
        break;
      case "reverse-range":
        this.session.reversePlaybackRange();
        break;
      case "copy-cels":
        this.session.copyCelsToNext();
        break;
      case "add-tag":
        this.session.addTag();
        break;
      case "delete-tag":
        if (target.dataset.tagId) this.session.deleteTag(target.dataset.tagId);
        break;
      case "use-tag": {
        const tag = this.session.doc.tags.find((item) => item.id === target.dataset.tagId);
        if (tag) this.session.setActiveFrame(Math.min(tag.from, tag.to));
        break;
      }
      case "add-tab":
        this.addTab();
        break;
      case "close-tab":
        this.closeTab(Number(target.dataset.tab ?? this.activeIndex));
        break;
      default:
        break;
    }
  }

  private onPaletteMenu(event: MouseEvent): void {
    const swatch = (event.target as HTMLElement | null)?.closest<HTMLElement>(".palette-swatch");
    if (!swatch?.dataset.index) return;
    event.preventDefault();
    this.pickPalette(Number(swatch.dataset.index), "bg");
  }

  private pickPalette(index: number, which: "fg" | "bg"): void {
    const color = this.session.doc.palette[index];
    if (!color) return;
    this.selectedPalette = index;
    if (which === "fg") this.session.setForeground({ ...color });
    else this.session.setBackground({ ...color });
    renderPalettes(this.hosts(".palette-host"), this.session.doc.palette, this.selectedPalette);
  }

  private onColorInput(input: HTMLInputElement): void {
    const current = input.dataset.colorRole === "bg" ? this.session.background : this.session.foreground;
    const color = hexToRgba(input.value, current.a || 255);
    if (input.dataset.colorRole === "bg") this.session.setBackground(color);
    else this.session.setForeground(color);
  }

  private onShortcut(action: Shortcut): void {
    switch (action.type) {
      case "tool":
        this.setTool(action.tool);
        break;
      case "undo":
        this.session.undo();
        break;
      case "redo":
        this.session.redo();
        break;
      case "save":
        void this.save();
        break;
      case "play":
        this.session.togglePlayback();
        break;
      case "frame":
        this.session.stepFrame(action.delta);
        break;
      case "new":
        Modal.getOrCreateInstance(this.required("#modal-new")).show();
        break;
      case "space":
        this.viewport.setSpaceHeld(action.down);
        break;
      default:
        break;
    }
  }

  private setTool(id: ToolId): void {
    const tool = this.tools.get(id);
    if (!tool || tool === this.tool) return;
    this.tool.onCancel();
    this.tool = tool;
    this.updateToolButtons();
    this.syncOptionGroups();
    this.viewport.syncCursor();
  }

  private createSprite(): void {
    if (this.session.dirty && !window.confirm(text.discard)) return;
    const width = Number(this.required<HTMLInputElement>("#new-width").value);
    const height = Number(this.required<HTMLInputElement>("#new-height").value);
    try {
      const sprite = createSprite(width, height);
      this.session.replaceDocument(sprite, { ...DEFAULT_FOREGROUND }, { ...DEFAULT_BACKGROUND });
      this.selectedPalette = 0;
      Modal.getOrCreateInstance(this.required("#modal-new")).hide();
      this.viewport.fit();
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.openFailed, "danger");
    }
  }

  private async save(): Promise<void> {
    try {
      await saveProject(this.snapshot());
      this.session.markClean();
      await saveRecovery(this.sessions.map((session) => this.projectOf(session)), this.activeIndex);
      this.flash(text.saved);
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.saveFailed, "danger");
    }
  }

  private downloadProject(): void {
    const session = this.session;
    const edit = session.editStamp();
    const json = serializeProject(this.snapshot());
    void this.saveBytes(new TextEncoder().encode(json), `${safeFilename(session.doc.name)}.pixeluz.json`, "application/json", PROJECT_FILE_TYPES).then((saved) => {
      if (!saved) return;
      session.noteProjectDownloaded(edit);
      if (session === this.session) this.updateStatus();
    });
  }

  private exportGif(): void {
    const name = safeFilename(this.session.doc.name);
    const bytes = writeGif(this.session.exportAnimation());
    void this.saveBytes(bytes, `${name}.gif`, "image/gif", [{ description: "GIF", accept: { "image/gif": [".gif"] } }]);
  }

  private exportSequence(): void {
    const name = safeFilename(this.session.doc.name);
    const zip = zipStored(
      this.session.exportAnimation().map((frame, index) => ({
        name: `${name}-${String(index + 1).padStart(3, "0")}.png`,
        data: encodePng(frame.image),
      })),
    );
    void this.saveBytes(zip, `${name}-png.zip`, "application/zip", [{ description: "ZIP", accept: { "application/zip": [".zip"] } }]);
  }

  private exportSheet(): void {
    const name = safeFilename(this.session.doc.name);
    const sheet = buildSpriteSheet(this.session.exportAnimation());
    const zip = zipStored([
      { name: `${name}.png`, data: encodePng(sheet.image) },
      { name: `${name}.json`, data: new TextEncoder().encode(atlasJson(`${name}.png`, sheet)) },
    ]);
    void this.saveBytes(zip, `${name}-sheet.zip`, "application/zip", [{ description: "ZIP", accept: { "application/zip": [".zip"] } }]);
  }

  private exportSlices(): void {
    if (this.session.doc.slices.length === 0) {
      this.flash(text.noSlices, "danger");
      return;
    }
    const name = safeFilename(this.session.doc.name);
    const frames = this.session.exportAnimation();
    const files = this.session.doc.slices.flatMap((slice) =>
      frames.flatMap((frame, index) => {
        const key = sliceKeyAt(slice, index);
        if (!key) return [];
        return [{ name: `${name}-${safeFilename(slice.name)}-${String(index + 1).padStart(3, "0")}.png`, data: encodePng(cropImage(frame.image, key.x, key.y, key.width, key.height)) }];
      }),
    );
    void this.saveBytes(zipStored(files), `${name}-slices.zip`, "application/zip", [{ description: "ZIP", accept: { "application/zip": [".zip"] } }]);
  }

  private exportAse(): void {
    const name = safeFilename(this.session.doc.name);
    void this.saveBytes(writeAse(this.session.doc), `${name}.aseprite`, "application/octet-stream", [
      { description: "Aseprite", accept: { "application/octet-stream": [".aseprite", ".ase"] } },
    ]);
  }

  private applyFilter(target: HTMLElement): void {
    const panel = target.closest(".color-panel") ?? this.root;
    const kind = panel.querySelector<HTMLSelectElement>("[data-filter='kind']")?.value;
    if (!isFilter(kind)) return;
    const number = (name: string) => Number(panel.querySelector<HTMLInputElement>(`[data-filter='${name}']`)?.value ?? 0);
    this.session.applyFilter(kind, {
      brightness: number("brightness"),
      contrast: number("contrast"),
      hue: number("hue"),
      saturation: number("saturation"),
      tolerance: number("tolerance"),
      outline: { ...this.session.foreground },
      from: { ...this.session.background },
      to: { ...this.session.foreground },
    });
  }

  private async saveBytes(bytes: Uint8Array, filename: string, mime: string, types: FilePickerType[]): Promise<boolean> {
    const blob = bytesToBlob(bytes, mime);
    try {
      if (!filePickerAvailable()) {
        downloadBlob(blob, filename);
        return true;
      }
      const result = await pickAndSave(blob, filename, types);
      if (result === "unavailable") {
        downloadBlob(blob, filename);
        return true;
      }
      if (result === "saved") {
        this.flash(text.fileSaved);
        return true;
      }
      return false;
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.saveFailed, "danger");
      return false;
    }
  }

  private async browseFiles(): Promise<void> {
    try {
      if (filePickerAvailable()) {
        const file = await pickFile(OPEN_FILE_TYPES);
        if (file) await this.openFile(file);
        return;
      }
      this.required<HTMLInputElement>("#file-input").click();
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.openFailed, "danger");
    }
  }

  private async importLospec(target: HTMLElement): Promise<void> {
    const panel = target.closest(".color-panel") ?? this.root;
    const input = panel.querySelector<HTMLInputElement>("[data-field='lospec']");
    const slug = lospecSlug(input?.value ?? "");
    if (!slug) {
      this.flash(text.lospecInvalid, "danger");
      return;
    }
    try {
      this.applyImportedPalette(await fetchLospecPalette(slug), true);
    } catch {
      this.flash(text.lospecFailed, "danger");
    }
  }

  private async importPaletteFile(): Promise<void> {
    try {
      if (filePickerAvailable()) {
        const file = await pickFile(PALETTE_FILE_TYPES);
        if (file) await this.readPaletteFile(file);
        return;
      }
      this.required<HTMLInputElement>("#palette-file").click();
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.paletteInvalid, "danger");
    }
  }

  private async readPaletteFile(file: File): Promise<void> {
    const parsed = parsePaletteFile(await file.text());
    if (!parsed) {
      this.flash(text.paletteInvalid, "danger");
      return;
    }
    this.applyImportedPalette(parsed, false);
  }

  private applyImportedPalette(file: PaletteFile, fromLospec: boolean): void {
    if (file.colors.length < 1 || file.colors.length > 256) {
      this.flash(text.paletteSize, "danger");
      return;
    }
    const colors = file.colors.map((color) => ({ ...color }));
    this.lospecNote = { colors, name: file.name, text: this.paletteNote(file, fromLospec) };
    this.session.loadPalette(colors);
    this.selectedPalette = 0;
    this.flash(text.paletteImported);
  }

  private paletteNote(file: PaletteFile, fromLospec: boolean): string {
    if (file.name && file.author) {
      const line = text.lospecCredit.replaceAll("{name}", file.name).replaceAll("{author}", file.author);
      return fromLospec ? `${line} Lospec.` : line;
    }
    if (file.name) return fromLospec ? `${file.name}. Lospec.` : file.name;
    return fromLospec ? "Lospec." : "";
  }

  private exportPalette(): void {
    const colors = this.session.doc.palette;
    const named = this.lospecNote && samePalette(this.lospecNote.colors, colors) ? this.lospecNote.name : "";
    const filename = `${safeFilename(named || this.session.doc.name)}.hex`;
    downloadBlob(new Blob([paletteToHex(colors)], { type: "text/plain" }), filename);
  }

  private exportPng(): void {
    try {
      downloadDataUrl(
        pngDataUrl(this.session.exportFrame()),
        `${safeFilename(this.session.doc.name)}-${this.session.activeFrameIndex + 1}.png`,
      );
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.saveFailed, "danger");
    }
  }

  private async openStored(id: string): Promise<void> {
    if (this.session.dirty && !window.confirm(text.discard)) return;
    try {
      const project = await loadProject(id);
      this.session.replaceDocument(project.sprite, project.foreground, project.background);
      this.selectedPalette = 0;
      Modal.getInstance(this.required("#modal-open"))?.hide();
      this.viewport.fit();
      this.flash(text.opened);
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.openFailed, "danger");
    }
  }

  private async openFile(file: File): Promise<void> {
    if (this.session.dirty && !window.confirm(text.discard)) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (isAseFile(bytes)) {
        const sprite = await readAse(bytes);
        const trimmed = file.name.replace(/\.(aseprite|ase)$/i, "").trim();
        if (trimmed) sprite.name = trimmed;
        this.session.replaceDocument(sprite, { ...DEFAULT_FOREGROUND }, { ...DEFAULT_BACKGROUND });
        this.selectedPalette = 0;
        Modal.getInstance(this.required("#modal-open"))?.hide();
        this.viewport.fit();
        this.flash(text.opened);
        return;
      }
      if (isImageFile(bytes)) {
        const sprite = await readImageSprite(bytes, file.name);
        this.session.replaceDocument(sprite, { ...DEFAULT_FOREGROUND }, { ...DEFAULT_BACKGROUND });
        this.selectedPalette = 0;
        Modal.getInstance(this.required("#modal-open"))?.hide();
        this.viewport.fit();
        this.flash(text.opened);
        return;
      }
      const project = deserializeProject(new TextDecoder().decode(bytes));
      this.session.replaceDocument(project.sprite, project.foreground, project.background);
      this.selectedPalette = 0;
      Modal.getInstance(this.required("#modal-open"))?.hide();
      this.viewport.fit();
      this.flash(text.opened);
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.openFailed, "danger");
    }
  }

  private async removeStored(id: string): Promise<void> {
    if (!window.confirm(text.deleteConfirm)) return;
    try {
      await deleteProject(id);
      await this.refreshProjects();
    } catch (error) {
      this.flash(error instanceof Error ? error.message : text.saveFailed, "danger");
    }
  }

  private async refreshProjects(): Promise<void> {
    const list = this.required("#project-list");
    try {
      const projects = await listProjects();
      list.innerHTML = projects.length
        ? projects
            .map(
              (project) => `<div class="list-group-item d-flex justify-content-between align-items-center gap-2">
                <button type="button" class="btn btn-link text-start text-decoration-none text-truncate" data-open="${escapeHtml(project.id)}">${escapeHtml(project.name)}</button>
                <span class="small text-secondary text-nowrap">${new Date(project.updatedAt).toLocaleString(currentLocale())}</span>
                <button type="button" class="btn btn-sm btn-outline-danger" data-delete="${escapeHtml(project.id)}">${text.deleteStored}</button>
              </div>`,
            )
            .join("")
        : `<p class="text-secondary mb-0">${text.emptyProjects}</p>`;
    } catch (error) {
      list.innerHTML = `<p class="text-danger mb-0">${escapeHtml(error instanceof Error ? error.message : text.openFailed)}</p>`;
    }
  }

  private snapshot() {
    return this.projectOf(this.session);
  }

  private projectOf(session: EditorSession) {
    return {
      sprite: session.doc,
      foreground: session.foreground,
      background: session.background,
    };
  }

  private async autosave(): Promise<void> {
    const dirty = this.sessions.filter((session) => session.dirty);
    if (dirty.length === 0) return;
    try {
      for (const session of dirty) {
        await saveProject(this.projectOf(session));
        session.markClean();
      }
      await saveRecovery(this.sessions.map((session) => this.projectOf(session)), this.activeIndex);
    } catch {
      /* o próximo ciclo tenta de novo */
    }
  }

  private async persistWorkspace(): Promise<void> {
    try {
      await saveRecovery(this.sessions.map((session) => this.projectOf(session)), this.activeIndex);
    } catch {
      /* segue sem a cópia de recuperação */
    }
  }

  private renderShortcutSheet(): void {
    const host = this.root.querySelector<HTMLElement>(".shortcuts-host");
    if (host) renderShortcuts(host, this.bindings, this.captureId);
  }

  private onShortcutCapture(event: Event): void {
    if (!(event instanceof KeyboardEvent) || !this.captureId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      this.captureId = null;
      this.renderShortcutSheet();
      return;
    }
    const chord = chordFromEvent(event);
    if (!chord) return;
    if (bindingOwner(this.bindings, chord, this.captureId)) {
      this.flash(text.shortcutUsed, "danger");
      return;
    }
    this.bindings = { ...this.bindings, [this.captureId]: chord };
    saveBindings(this.bindings);
    this.captureId = null;
    this.renderShortcutSheet();
    renderToolbars(this.hosts(".tool-host"), this.bindings);
    this.updateToolButtons();
  }

  private resizeCanvasFromSettings(): void {
    this.session.resizeCanvas(
      Number(this.required<HTMLInputElement>("#canvas-width").value),
      Number(this.required<HTMLInputElement>("#canvas-height").value),
      this.required<HTMLSelectElement>("#canvas-anchor").value,
    );
    this.session.setGrid(
      Number(this.required<HTMLInputElement>("#grid-width").value),
      Number(this.required<HTMLInputElement>("#grid-height").value),
    );
    this.viewport.fit();
    this.syncCanvasFields();
  }

  private syncCanvasFields(): void {
    const width = this.root.querySelector<HTMLInputElement>("#canvas-width");
    const height = this.root.querySelector<HTMLInputElement>("#canvas-height");
    const gridWidth = this.root.querySelector<HTMLInputElement>("#grid-width");
    const gridHeight = this.root.querySelector<HTMLInputElement>("#grid-height");
    if (width) width.value = String(this.session.doc.width);
    if (height) height.value = String(this.session.doc.height);
    if (gridWidth) gridWidth.value = String(this.session.doc.grid.width);
    if (gridHeight) gridHeight.value = String(this.session.doc.grid.height);
  }

  private drawPreviews(): void {
    const image = this.session.composite();
    for (const canvas of this.root.querySelectorAll<HTMLCanvasElement>("canvas.sprite-preview")) {
      drawPreview(canvas, image, this.session.preview);
    }
  }

  private syncOptionGroups(): void {
    const active = new Set(optionGroupsFor(this.tool.id, this.hasSelection()));
    for (const group of this.root.querySelectorAll<HTMLElement>("[data-option-group]")) {
      group.hidden = !active.has(group.dataset.optionGroup ?? "");
    }
  }

  private hasSelection(): boolean {
    const mask = this.session.selection;
    if (!mask) return false;
    for (const value of mask) if (value) return true;
    return false;
  }

  private toggleFrameEdit(): void {
    const blocks = [...this.root.querySelectorAll<HTMLElement>(".timeline-more")];
    const show = blocks.some((block) => block.hidden);
    for (const block of blocks) block.hidden = !show;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-frame-edit']")) {
      button.setAttribute("aria-expanded", show ? "true" : "false");
    }
  }

  private applyLayout(): void {
    const layout = clampPanelLayout(this.layout);
    this.layout = layout;
    this.root.style.setProperty("--pixeluz-side", `${layout.sideWidth}px`);
    this.root.style.setProperty("--pixeluz-timeline", `${Math.min(layout.timelineHeight, timelineLimit(window.innerHeight))}px`);
    this.root.querySelector(".side-panel")?.classList.toggle("is-collapsed", !layout.sideOpen);
    this.root.querySelector(".timeline-desktop")?.classList.toggle("is-collapsed", !layout.timelineOpen);
    this.syncPanelToggle("side", layout.sideOpen, "fa-chevron-right", "fa-chevron-left");
    this.syncPanelToggle("timeline", layout.timelineOpen, "fa-chevron-down", "fa-chevron-up");
    this.drawPreviews();
  }

  private syncPanelToggle(panel: string, open: boolean, openIcon: string, closedIcon: string): void {
    const button = this.root.querySelector<HTMLButtonElement>(`[data-action='toggle-panel'][data-panel='${panel}']`);
    if (!button) return;
    const label = open ? text.minimizePanel : text.expandPanel;
    button.title = label;
    button.setAttribute("aria-label", label);
    const icon = button.querySelector("i");
    if (icon) icon.className = `fa-solid ${open ? openIcon : closedIcon}`;
  }

  private togglePanel(panel: string | undefined): void {
    if (panel !== "side" && panel !== "timeline") return;
    const element = this.panelElement(panel);
    if (!element) return;
    this.stopLayoutMotion();
    const from = panel === "side" ? element.getBoundingClientRect().width : element.getBoundingClientRect().height;
    const open = panel === "side" ? this.layout.sideOpen : this.layout.timelineOpen;
    const stored = panel === "side" ? this.layout.sideWidth : this.layout.timelineHeight;
    element.classList.remove("is-collapsed");
    const target = open ? PANEL_COLLAPSED : stored;
    this.animatePanel(panel, from, target, 0, () => {
      if (panel === "side") this.layout.sideOpen = !open;
      else this.layout.timelineOpen = !open;
      writePanelLayout(this.layout);
      this.applyLayout();
    });
  }

  private onPanelResize(event: PointerEvent): void {
    const handle = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-resize]");
    if (!handle) return;
    const which = handle.dataset.resize;
    if (which !== "side" && which !== "timeline") return;
    const element = this.panelElement(which);
    if (!element || element.classList.contains("is-collapsed")) return;
    event.preventDefault();
    event.stopPropagation();
    this.stopLayoutMotion();
    handle.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const originY = event.clientY;
    const origin = which === "side" ? element.getBoundingClientRect().width : element.getBoundingClientRect().height;
    const min = which === "side" ? SIDE_MIN : TIMELINE_MIN;
    const max = which === "side" ? SIDE_MAX : timelineLimit(window.innerHeight);
    const samples: Array<{ t: number; value: number }> = [{ t: event.timeStamp, value: origin }];
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      const raw = which === "side" ? origin + originX - ev.clientX : origin + originY - ev.clientY;
      const visual = trackPanelSize(raw, PANEL_COLLAPSED, max);
      this.presentPanel(which, visual);
      element.classList.toggle("is-collapsing", visual < min);
      if (raw >= min && raw <= max) {
        if (which === "side") this.layout.sideWidth = Math.round(raw);
        else this.layout.timelineHeight = Math.round(raw);
      }
      samples.push({ t: ev.timeStamp, value: visual });
      if (samples.length > 6) samples.shift();
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      const current = samples[samples.length - 1]?.value ?? origin;
      const snap = panelSnapTarget(current, releaseVelocity(samples), PANEL_COLLAPSED, min, max);
      this.animatePanel(which, current, snap.size, releaseVelocity(samples), () => {
        if (which === "side") this.layout.sideOpen = snap.open;
        else this.layout.timelineOpen = snap.open;
        if (snap.open) {
          if (which === "side") this.layout.sideWidth = snap.size;
          else this.layout.timelineHeight = snap.size;
        }
        writePanelLayout(this.layout);
        this.applyLayout();
      });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  private panelElement(panel: "side" | "timeline"): HTMLElement | null {
    return this.root.querySelector(panel === "side" ? ".side-panel" : ".timeline-desktop");
  }

  private presentPanel(panel: "side" | "timeline", value: number): void {
    const name = panel === "side" ? "--pixeluz-side" : "--pixeluz-timeline";
    this.root.style.setProperty(name, `${Math.round(value)}px`);
  }

  private animatePanel(panel: "side" | "timeline", from: number, to: number, velocity: number, done: () => void): void {
    this.stopLayoutMotion();
    const element = this.panelElement(panel);
    const min = panel === "side" ? SIDE_MIN : TIMELINE_MIN;
    const apply = (value: number) => {
      this.presentPanel(panel, value);
      element?.classList.toggle("is-collapsing", value < min - 1);
    };
    this.layoutMotion = settleNumber(from, to, velocity, apply, () => {
      this.layoutMotion = null;
      element?.classList.remove("is-collapsing");
      done();
    });
  }

  private stopLayoutMotion(): void {
    this.layoutMotion?.();
    this.layoutMotion = null;
  }

  private bindSheet(sheet: HTMLElement, signal: AbortSignal): void {
    sheet.addEventListener("show.bs.offcanvas", () => {
      sheet.style.transform = "translateY(100%)";
    }, { signal });
    sheet.addEventListener("shown.bs.offcanvas", () => {
      if (prefersReducedMotion()) {
        sheet.style.transform = "";
        return;
      }
      this.animateSheet(sheet, sheet.offsetHeight, 0, 0);
    }, { signal });
    sheet.addEventListener("hide.bs.offcanvas", (event) => {
      if (sheet.dataset.instant === "1") return;
      event.preventDefault();
      const height = sheet.offsetHeight;
      this.animateSheet(sheet, this.sheetOffset(sheet), height, 0, () => {
        sheet.dataset.instant = "1";
        Offcanvas.getOrCreateInstance(sheet).hide();
      });
    }, { signal });
    sheet.addEventListener("hidden.bs.offcanvas", () => {
      sheet.style.transform = "";
      delete sheet.dataset.instant;
    }, { signal });
  }

  private onSheetGrab(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    const sheet = target?.closest<HTMLElement>(".pixeluz-sheet.show");
    if (!sheet || !target?.closest(".sheet-grab, .offcanvas-header")) return;
    if (target.closest("button, a, input, select, textarea")) return;
    event.preventDefault();
    this.sheetMotions.get(sheet)?.();
    this.sheetMotions.delete(sheet);
    sheet.classList.add("is-dragging");
    sheet.setPointerCapture(event.pointerId);
    const originY = event.clientY;
    const origin = this.sheetOffset(sheet);
    const height = sheet.offsetHeight;
    const samples: Array<{ t: number; value: number }> = [{ t: event.timeStamp, value: origin }];
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      const raw = origin + ev.clientY - originY;
      const next = raw < 0 ? -rubberband(-raw, height) : raw;
      this.setSheetOffset(sheet, next);
      samples.push({ t: ev.timeStamp, value: next });
      if (samples.length > 6) samples.shift();
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      sheet.removeEventListener("pointermove", move);
      sheet.removeEventListener("pointerup", end);
      sheet.removeEventListener("pointercancel", end);
      sheet.classList.remove("is-dragging");
      const current = samples[samples.length - 1]?.value ?? origin;
      const projected = current + releaseVelocity(samples) / 5;
      const close = projected > height * 0.35;
      this.animateSheet(sheet, current, close ? height : 0, releaseVelocity(samples), () => {
        if (!close) return;
        sheet.dataset.instant = "1";
        Offcanvas.getOrCreateInstance(sheet).hide();
      });
    };
    sheet.addEventListener("pointermove", move);
    sheet.addEventListener("pointerup", end);
    sheet.addEventListener("pointercancel", end);
  }

  private sheetOffset(sheet: HTMLElement): number {
    const match = /translateY\(([-\d.]+)px\)/.exec(sheet.style.transform);
    return match?.[1] ? Number(match[1]) : 0;
  }

  private setSheetOffset(sheet: HTMLElement, value: number): void {
    sheet.style.transform = `translateY(${Math.round(value)}px)`;
  }

  private animateSheet(sheet: HTMLElement, from: number, to: number, velocity: number, done?: () => void): void {
    this.sheetMotions.get(sheet)?.();
    sheet.classList.add("is-settling");
    this.sheetMotions.set(sheet, settleNumber(from, to, velocity, (value) => this.setSheetOffset(sheet, value), () => {
      this.sheetMotions.delete(sheet);
      sheet.classList.remove("is-settling");
      if (to === 0) sheet.style.transform = "";
      done?.();
    }));
  }

  private openDialog(kind: "settings" | "shortcuts"): void {
    const selector = kind === "settings" ? "#modal-settings" : "#modal-shortcuts";
    Modal.getOrCreateInstance(this.required(selector)).show();
  }

  private queue(kind: ChangeKind): void {
    this.pending = this.pending ? stronger(this.pending, kind) : kind;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      const next = this.pending ?? "canvas";
      this.pending = null;
      this.frame = 0;
      this.flush(next);
    });
  }

  private flush(kind: ChangeKind): void {
    this.viewport.draw();
    this.viewport.syncCursor();
    this.drawPreviews();
    this.updateStatus();
    this.updateHistoryButtons();
    this.syncOptionGroups();
    if (kind !== "document") this.refreshActiveThumbs();
    if (kind === "canvas") return;
    this.updateToolButtons();
    this.updateColors();
    this.updateGridButton();
    this.updateName();
    this.syncOptions();
    this.syncDocumentFields();
    this.updateActiveLayer();
    renderTabs(this.required("#doc-tabs"), this.sessions.map((session, index) => ({
      name: session.doc.name,
      dirty: session.dirty,
      active: index === this.activeIndex,
    })));
    setPlaying(this.root, this.session.playing);
    this.clampPalette();
    renderPalettes(this.hosts(".palette-host"), this.session.doc.palette, this.selectedPalette);
    const activeLayer = this.session.doc.layers.find((layer) => layer.id === this.session.activeLayerId);
    const tileset = this.session.doc.tilesets.find((item) => item.id === activeLayer?.tilesetId) ?? this.session.doc.tilesets[0] ?? null;
    renderTileSwatches(this.hosts(".tile-host"), activeLayer?.kind === "tilemap" ? tileset : null, this.session.selectedTile);
    if (kind === "chrome") return;
    renderLayers(this.hosts(".layers-host"), this.session.doc, this.session.activeLayerId);
    renderSlices(this.hosts(".slices-host"), this.session.doc.slices);
    renderFrames(this.hosts(".timeline-frames"), this.session.doc, this.session.activeFrameIndex);
    renderTags(this.hosts(".tags-host"), this.session.doc);
    setDuration(this.root, this.session.doc.frames[this.session.activeFrameIndex]?.durationMs ?? 100);
  }

  private watch(session: EditorSession): void {
    this.stops.push(session.subscribe((kind) => {
      if (session === this.session) this.queue(kind);
    }));
  }

  private addTab(): void {
    this.session.pausePlayback();
    const session = new EditorSession();
    this.sessions.push(session);
    this.watch(session);
    this.activeIndex = this.sessions.length - 1;
    this.selectedPalette = 0;
    this.flush("document");
    this.viewport.fit();
    void this.persistWorkspace();
  }

  private closeTab(index: number): void {
    const session = this.sessions[index];
    if (!session) return;
    if (session.dirty && !window.confirm(text.closeTabConfirm)) return;
    session.pausePlayback();
    this.sessions.splice(index, 1);
    if (this.sessions.length === 0) {
      const fresh = new EditorSession();
      this.sessions.push(fresh);
      this.watch(fresh);
      this.activeIndex = 0;
    } else if (index < this.activeIndex) this.activeIndex -= 1;
    else if (this.activeIndex >= this.sessions.length) this.activeIndex = this.sessions.length - 1;
    this.selectedPalette = 0;
    this.flush("document");
    this.viewport.fit();
    void this.persistWorkspace();
  }

  private switchTab(index: number): void {
    if (!this.sessions[index] || index === this.activeIndex) return;
    this.session.pausePlayback();
    this.activeIndex = index;
    this.selectedPalette = 0;
    this.flush("document");
    this.viewport.fit();
  }

  private onDocumentField(target: HTMLInputElement | HTMLSelectElement): void {
    const field = target.dataset.field;
    if (field === "layer-opacity") this.session.setLayerOpacity(Number(target.value));
    else if (field === "cel-opacity") this.session.setCelOpacity(Number(target.value));
    else if (field === "cel-x" || field === "cel-y") {
      const cel = this.session.doc.cels.find((item) => item.layerId === this.session.activeLayerId && item.frameId === this.session.activeFrameId);
      const x = field === "cel-x" ? Number(target.value) : (cel?.x ?? 0);
      const y = field === "cel-y" ? Number(target.value) : (cel?.y ?? 0);
      this.session.setCelOffset(x, y);
    } else if (field === "layer-blend" && isBlend(target.value)) this.session.setLayerBlend(target.value);
    else if (field === "color-mode" && isColorMode(target.value)) this.session.setColorMode(target.value);
    else if (field === "palette-preset") {
      const preset = PALETTE_PRESETS.find((item) => item.id === target.value);
      if (preset) this.session.loadPalette(preset.colors.map((color) => ({ ...color })));
    }
    else if (field === "tile-draw" && (target.value === "tiles" || target.value === "pixels")) this.session.setTileDrawMode(target.value);
    else if (field === "tile-pixel" && (target.value === "manual" || target.value === "auto" || target.value === "stack")) this.session.setTilePixelMode(target.value);
    else if (field === "onion-before" || field === "onion-after") {
      const before = field === "onion-before" ? Number(target.value) : this.session.onionBefore;
      const after = field === "onion-after" ? Number(target.value) : this.session.onionAfter;
      this.session.setOnion(before, after);
    }
    if (target.dataset.tagName) this.session.updateTag(target.dataset.tagName, { name: target.value });
    if (target.dataset.tagFrom) this.session.updateTag(target.dataset.tagFrom, { from: Number(target.value) - 1 });
    if (target.dataset.tagTo) this.session.updateTag(target.dataset.tagTo, { to: Number(target.value) - 1 });
    if (target.dataset.tagDirection && isLoop(target.value)) this.session.updateTag(target.dataset.tagDirection, { direction: target.value });
  }

  private syncDocumentFields(): void {
    const layer = this.session.doc.layers.find((item) => item.id === this.session.activeLayerId);
    const cel = this.session.doc.cels.find((item) => item.layerId === this.session.activeLayerId && item.frameId === this.session.activeFrameId);
    this.syncField("[data-field='layer-opacity']", String(layer?.opacity ?? 255));
    this.syncField("[data-field='layer-blend']", layer?.blendMode ?? "normal");
    this.syncField("[data-field='cel-x']", cel ? String(cel.x) : "");
    this.syncField("[data-field='cel-y']", cel ? String(cel.y) : "");
    this.syncField("[data-field='cel-opacity']", cel ? String(cel.opacity) : "");
    this.syncField("[data-field='onion-before']", String(this.session.onionBefore));
    this.syncField("[data-field='onion-after']", String(this.session.onionAfter));
    this.syncField("[data-field='color-mode']", this.session.doc.colorMode);
    this.syncField("[data-field='tile-draw']", this.session.tileDrawMode);
    this.syncField("[data-field='tile-pixel']", this.session.tilePixelMode);
    const preset = presetIdFor(this.session.doc.palette);
    const imported = !preset && this.lospecNote && samePalette(this.lospecNote.colors, this.session.doc.palette)
      ? this.lospecNote.text
      : "";
    this.syncField("[data-field='palette-preset']", preset);
    const credit = preset ? paletteCredit(preset) : imported;
    for (const node of this.root.querySelectorAll(".palette-credit")) node.textContent = credit;
  }

  private onOption(target: HTMLInputElement | HTMLSelectElement): void {
    const option = target.dataset.option;
    const checked = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : false;
    const value = target.value;
    if (option === "brush-size") this.session.setBrushSize(Number(value));
    else if (option === "brush-angle") this.session.setBrushAngle(Number(value));
    else if (option === "brush-opacity") this.session.setBrushOpacity(Number(value));
    else if (option === "pixel-perfect") this.session.setPixelPerfect(checked);
    else if (option === "brush-shape") this.pick(value, ["square", "circle", "custom"] as const, (shape) => this.session.setBrushShape(shape));
    else if (option === "ink") this.pick(value, ["simple", "alpha", "copy", "lock-alpha", "shading"] as const, (ink) => this.session.setInk(ink));
    else if (option === "symmetry") this.pick(value, ["off", "horizontal", "vertical", "both"] as const, (mode) => this.session.setSymmetry(mode));
    else if (option === "tile") this.pick(value, ["off", "x", "y", "both"] as const, (mode) => this.session.setTile(mode));
    else if (option === "gradient") this.pick(value, ["linear", "radial"] as const, (kind) => this.session.setGradientKind(kind));
    else if (option === "bayer") this.pick(value, ["2", "4", "8"] as const, (size) => this.session.setBayer(Number(size) as BayerSize));
    else if (option === "select-mode") this.pick(value, ["replace", "add", "subtract", "intersect"] as const, (mode) => this.session.setSelectMode(mode));
  }

  private pick<T extends string>(value: string, options: readonly T[], apply: (value: T) => void): void {
    if (options.includes(value as T)) apply(value as T);
  }

  private syncOptions(): void {
    this.syncField("[data-option='brush-size']", String(this.session.brushSize));
    this.syncField("[data-option='brush-angle']", String(this.session.brushAngle));
    this.syncField("[data-option='brush-opacity']", String(this.session.brushOpacity));
    this.syncField("[data-option='brush-shape']", this.session.brushShape);
    this.syncField("[data-option='ink']", this.session.ink);
    this.syncField("[data-option='symmetry']", this.session.symmetry);
    this.syncField("[data-option='tile']", this.session.tile);
    this.syncField("[data-option='gradient']", this.session.gradientKind);
    this.syncField("[data-option='bayer']", String(this.session.bayer));
    this.syncField("[data-option='select-mode']", this.session.selectMode);
    for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-option='pixel-perfect']")) {
      if (document.activeElement === input) continue;
      input.checked = this.session.pixelPerfect;
    }
  }

  private syncField(selector: string, value: string): void {
    for (const field of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector)) {
      if (document.activeElement === field) continue;
      if (field.value !== value) field.value = value;
    }
  }

  private updateActiveLayer(): void {
    for (const row of this.root.querySelectorAll<HTMLElement>("[data-action='select-layer']")) {
      row.classList.toggle("active", row.dataset.layerId === this.session.activeLayerId);
    }
  }

  private updateStatus(): void {
    const doc = this.session.doc;
    const state = this.session.dirty ? text.unsaved : text.savedState;
    this.required("#status-doc").textContent = `${doc.width}×${doc.height} · ${text.frame} ${this.session.activeFrameIndex + 1}/${doc.frames.length} · ${state}`;
    const notice = this.required("#browser-notice");
    const show = spriteStaysInBrowser(this.session.projectDownloaded, this.session.changedSinceDownload);
    notice.hidden = !show;
    notice.textContent = show ? text.browserStorage : "";
    this.required("#status-zoom").textContent = `${this.session.zoom}×`;
    this.required("#status-pos").textContent = this.hover ? `${this.hover.x}, ${this.hover.y}` : "";
  }

  private updateHistoryButtons(): void {
    this.required<HTMLButtonElement>("#btn-undo").disabled = !this.session.canUndo || this.session.strokeOpen;
    this.required<HTMLButtonElement>("#btn-redo").disabled = !this.session.canRedo || this.session.strokeOpen;
  }

  private updateToolButtons(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
      const on = button.dataset.tool === this.tool.id;
      button.classList.toggle("btn-primary", on);
      button.classList.toggle("btn-outline-secondary", !on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  private updateColors(): void {
    this.paintColorInputs("fg", rgbaToHex(this.session.foreground), this.session.foreground.a === 0);
    this.paintColorInputs("bg", rgbaToHex(this.session.background), this.session.background.a === 0);
  }

  private paintColorInputs(role: string, hex: string, transparent: boolean): void {
    for (const input of this.root.querySelectorAll<HTMLInputElement>(`[data-color-role="${role}"]`)) {
      if (document.activeElement !== input) input.value = hex;
    }
    for (const label of this.root.querySelectorAll<HTMLElement>(`[data-alpha="${role}"]`)) {
      label.textContent = transparent ? text.transparent : "";
    }
  }

  private updateGridButton(): void {
    const button = this.required<HTMLButtonElement>("#btn-grid");
    button.classList.toggle("btn-primary", this.session.showPixelGrid);
    button.classList.toggle("btn-outline-secondary", !this.session.showPixelGrid);
    button.setAttribute("aria-pressed", this.session.showPixelGrid ? "true" : "false");
  }

  private updateName(): void {
    const input = this.required<HTMLInputElement>("#doc-name");
    if (document.activeElement !== input) input.value = this.session.doc.name;
    document.title = `${this.session.doc.name} — Pixeluz`;
  }

  private refreshActiveThumbs(): void {
    const frameId = this.session.activeFrameId;
    if (!frameId) return;
    for (const canvas of this.root.querySelectorAll<HTMLCanvasElement>("canvas.frame-thumb")) {
      if (canvas.dataset.frameId === frameId) drawThumb(canvas, this.session.doc, frameId);
    }
  }

  private clampPalette(): void {
    if (this.selectedPalette >= this.session.doc.palette.length) {
      this.selectedPalette = Math.max(0, this.session.doc.palette.length - 1);
    }
  }

  private hosts(selector: string): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(selector)];
  }

  private flash(message: string, kind: "ok" | "danger" = "ok"): void {
    const element = this.required("#flash");
    element.textContent = message;
    element.className = kind === "danger" ? "small text-nowrap text-danger" : "small text-nowrap text-success";
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      element.textContent = "";
    }, 2600);
  }

  private required<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Elemento ausente: ${selector}`);
    return element;
  }
}

function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A" || target.isContentEditable;
}

function isColorMode(value: string): value is ColorMode {
  return value === "rgba" || value === "indexed" || value === "grayscale";
}

function isFilter(value: string | undefined): value is FilterKind {
  return value === "invert" || value === "brightness" || value === "hue" || value === "outline" || value === "replace";
}

function isBlend(value: string): value is BlendMode {
  return [
    "normal", "darken", "multiply", "color-burn", "lighten", "screen", "color-dodge", "addition", "overlay",
    "soft-light", "hard-light", "difference", "exclusion", "subtract", "divide", "hue", "saturation", "color", "luminosity",
  ].includes(value);
}

function isLoop(value: string): value is LoopDirection {
  return value === "forward" || value === "reverse" || value === "ping-pong";
}
