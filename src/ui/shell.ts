import { MAX_SPRITE_SIZE, MIN_SPRITE_SIZE } from "../domain/limits";
import { fileInputAccept, OPEN_FILE_TYPES, PALETTE_FILE_TYPES } from "../io/files";
import { currentLocale, text, blendLabels } from "./i18n";

function fa(icon: string): string {
  return `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
}

function closeButton(dismiss: "modal" | "offcanvas"): string {
  return `<button type="button" class="btn btn-sm btn-outline-secondary icon-btn ms-auto" data-bs-dismiss="${dismiss}" aria-label="${text.close}">${fa("fa-xmark")}</button>`;
}

function iconButton(action: string, icon: string, label: string, id = ""): string {
  const identity = id ? ` id="${id}"` : "";
  return `<button type="button" class="btn btn-outline-secondary btn-sm icon-btn"${identity} data-action="${action}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
}

function propRow(label: string, control: string): string {
  return `<div class="prop-row"><span class="prop-label">${label}</span><div class="prop-value">${control}</div></div>`;
}

function propTable(rows: string): string {
  return `<div class="prop-table">${rows}</div>`;
}

function colorEditors(role: string, hex: string, label: string): string {
  return `<div class="d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <input data-color-role="${role}" type="color" class="form-control form-control-color" value="${hex}" aria-label="${label}" />
      <label class="d-flex align-items-center gap-1 mb-0 small text-nowrap">${text.opacity}<input data-color-channel="${role}" data-channel="a" type="number" min="0" max="255" value="255" class="form-control form-control-sm" style="width:4.5rem" aria-label="${label} alpha" /></label>
    </div>
    <div class="d-flex flex-wrap gap-1">
      <label class="d-flex align-items-center gap-1 mb-0 small">H<input data-color-channel="${role}" data-channel="h" type="number" min="0" max="360" value="0" class="form-control form-control-sm" style="width:4rem" /></label>
      <label class="d-flex align-items-center gap-1 mb-0 small">S<input data-color-channel="${role}" data-channel="s" type="number" min="0" max="100" value="0" class="form-control form-control-sm" style="width:4rem" /></label>
      <label class="d-flex align-items-center gap-1 mb-0 small">V<input data-color-channel="${role}" data-channel="v" type="number" min="0" max="100" value="0" class="form-control form-control-sm" style="width:4rem" /></label>
    </div>
  </div>`;
}

function colorPanel(): string {
  return `<div class="color-panel p-2">
    <h2 class="h6 mb-2">${text.colors}</h2>
    ${propTable(`
      ${propRow(text.colorMode, `<select data-field="color-mode" class="form-select form-select-sm" aria-label="${text.colorMode}">
          <option value="rgba">${text.modeRgba}</option>
          <option value="indexed">${text.modeIndexed}</option>
          <option value="grayscale">${text.modeGrayscale}</option>
        </select>`)}
      ${propRow(text.foreground, colorEditors("fg", "#000000", text.foreground))}
      ${propRow(text.background, colorEditors("bg", "#ffffff", text.background))}
    `)}
    <div class="d-flex flex-wrap gap-1 my-2">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-add">${text.addColor}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-replace">${text.replaceColor}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-remove">${text.removeColor}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="bg-clear">${text.clearBackground}</button>
    </div>
    <div class="palette-host"></div>
    ${propTable(`
      ${propRow(text.presets, `<select data-field="palette-preset" class="form-select form-select-sm" aria-label="${text.presets}">
          <option value="">${text.paletteCustom}</option>
          <option value="sweetie16">Sweetie 16</option>
          <option value="db32">DB32</option>
          <option value="endesga32">Endesga 32</option>
        </select>`)}
    `)}
    <p class="palette-credit small text-secondary mb-0 mt-1"></p>
    ${propTable(`
      ${propRow(text.lospec, `<div class="d-flex flex-wrap gap-1">
          <input data-field="lospec" type="text" class="form-control form-control-sm" placeholder="${text.lospecPlaceholder}" aria-label="${text.lospecUrl}" style="min-width:8rem;flex:1 1 8rem" />
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-lospec">${text.importPalette}</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-import" title="${text.paletteFileHint}" aria-label="${text.importPaletteFile}">${text.importPaletteFile}</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="palette-export">${text.exportPalette}</button>
        </div>`)}
    `)}
    ${propTable(`
      ${propRow(text.filters, `<select data-filter="kind" class="form-select form-select-sm" aria-label="${text.filters}">
          <option value="invert">${text.filterInvert}</option>
          <option value="brightness">${text.filterBrightness}</option>
          <option value="hue">${text.filterHue}</option>
          <option value="outline">${text.filterOutline}</option>
          <option value="replace">${text.filterReplace}</option>
        </select>`)}
      ${propRow(text.brightness, `<input data-filter="brightness" type="number" min="-100" max="100" value="0" class="form-control form-control-sm prop-number" aria-label="${text.brightness}" />`)}
      ${propRow(text.contrast, `<input data-filter="contrast" type="number" min="-100" max="100" value="0" class="form-control form-control-sm prop-number" aria-label="${text.contrast}" />`)}
      ${propRow(text.hue, `<input data-filter="hue" type="number" min="-180" max="180" value="0" class="form-control form-control-sm prop-number" aria-label="${text.hue}" />`)}
      ${propRow(text.saturation, `<input data-filter="saturation" type="number" min="-100" max="100" value="0" class="form-control form-control-sm prop-number" aria-label="${text.saturation}" />`)}
      ${propRow(text.tolerance, `<input data-filter="tolerance" type="number" min="0" max="255" value="0" class="form-control form-control-sm prop-number" aria-label="${text.tolerance}" />`)}
    `)}
    <div class="d-flex flex-wrap gap-1 mt-2">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="apply-filter">${text.applyFilter}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="clear-filter-preview">${text.cancel}</button>
    </div>
  </div>`;
}

function layerPanel(): string {
  return `<div class="p-2 border-top">
    <div class="d-flex align-items-center gap-1 mb-2">
      <h2 class="h6 mb-0 me-auto">${text.layers}</h2>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-layer" title="${text.addLayer}" aria-label="${text.addLayer}">${fa("fa-plus")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-group" title="${text.addGroup}" aria-label="${text.addGroup}">${fa("fa-layer-group")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-reference" title="${text.addReference}" aria-label="${text.addReference}">${fa("fa-image")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-tilemap" title="${text.addTilemap}" aria-label="${text.addTilemap}">${fa("fa-table-cells")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="delete-layer" title="${text.deleteLayer}" aria-label="${text.deleteLayer}">${fa("fa-trash")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="layer-up" title="${text.layerUp}" aria-label="${text.layerUp}">${fa("fa-arrow-up")}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="layer-down" title="${text.layerDown}" aria-label="${text.layerDown}">${fa("fa-arrow-down")}</button>
    </div>
    <div class="layers-host"></div>
    ${propTable(`
      ${propRow(text.drawTiles, `<select data-field="tile-draw" class="form-select form-select-sm" aria-label="${text.drawTiles}"><option value="tiles">${text.drawTiles}</option><option value="pixels">${text.drawPixels}</option></select>`)}
      ${propRow(text.drawPixels, `<select data-field="tile-pixel" class="form-select form-select-sm" aria-label="${text.drawPixels}"><option value="manual">${text.tileManual}</option><option value="auto">${text.tileAuto}</option><option value="stack">${text.tileStack}</option></select>`)}
    `)}
    <div class="tile-host d-flex flex-wrap gap-1 mt-2"></div>
    ${propTable(`
      ${propRow(text.layerOpacity, `<input data-field="layer-opacity" type="number" min="0" max="255" class="form-control form-control-sm prop-number" aria-label="${text.layerOpacity}" />`)}
      ${propRow(text.blend, `<select data-field="layer-blend" class="form-select form-select-sm" aria-label="${text.blend}">${blendLabels().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>`)}
      ${propRow(text.celX, `<input data-field="cel-x" type="number" class="form-control form-control-sm prop-number" aria-label="${text.celX}" />`)}
      ${propRow(text.celY, `<input data-field="cel-y" type="number" class="form-control form-control-sm prop-number" aria-label="${text.celY}" />`)}
      ${propRow(text.celOpacity, `<input data-field="cel-opacity" type="number" min="0" max="255" class="form-control form-control-sm prop-number" aria-label="${text.celOpacity}" />`)}
    `)}
    <div class="d-flex flex-wrap gap-1 mt-2">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="link-cel">${text.linkCel}</button>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="unlink-cel">${text.unlinkCel}</button>
    </div>
  </div>`;
}

function optionSelect(option: string, label: string, choices: Array<[string, string]>): string {
  const options = choices.map(([value, name]) => `<option value="${value}">${name}</option>`).join("");
  return `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap">${label}<select class="form-select form-select-sm" data-option="${option}">${options}</select></label>`;
}

function iconOnly(action: string, icon: string, label: string): string {
  return `<button type="button" class="btn btn-sm btn-outline-secondary icon-btn" data-action="${action}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`;
}

function previewPanel(): string {
  return `<section class="preview-panel px-2 pb-2">
    <div class="preview-frame">
      <canvas class="sprite-preview" width="32" height="32" aria-label="${text.preview}"></canvas>
    </div>
  </section>`;
}

function optionGroup(id: string, html: string, visible = false): string {
  const hidden = visible ? "" : " hidden";
  return `<div class="option-group d-flex align-items-center gap-2" data-option-group="${id}"${hidden}>${html}</div>`;
}

function optionsBar(): string {
  return `<div class="options-bar d-flex align-items-center gap-2 overflow-auto border-bottom bg-body px-2 py-1 small">
    ${optionGroup("size", `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap">${text.size}<input data-option="brush-size" type="number" min="1" max="32" value="1" class="form-control form-control-sm" style="width:4rem" /></label>`, true)}
    ${optionGroup("shape", optionSelect("brush-shape", text.shape, [["square", text.square], ["circle", text.circle], ["custom", text.custom]]), true)}
    ${optionGroup("angle", `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap">${text.angle}<input data-option="brush-angle" type="number" min="0" max="359" value="0" class="form-control form-control-sm" style="width:4.5rem" /></label>`, true)}
    ${optionGroup("opacity", `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap">${text.opacity}<input data-option="brush-opacity" type="number" min="0" max="255" value="255" class="form-control form-control-sm" style="width:4.5rem" /></label>`, true)}
    ${optionGroup("ink", optionSelect("ink", text.ink, [["simple", text.inkSimple], ["alpha", text.inkAlpha], ["copy", text.inkCopy], ["lock-alpha", text.inkLock], ["shading", text.inkShade]]), true)}
    ${optionGroup("perfect", `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap"><input data-option="pixel-perfect" type="checkbox" class="form-check-input mt-0" />${text.perfect}</label>`, true)}
    ${optionGroup("symmetry", optionSelect("symmetry", text.symmetry, [["off", text.symmetryOff], ["horizontal", text.symmetryH], ["vertical", text.symmetryV], ["both", text.symmetryBoth]]), true)}
    ${optionGroup("tile", optionSelect("tile", text.tile, [["off", text.tileOff], ["x", "X"], ["y", "Y"], ["both", text.symmetryBoth]]), true)}
    ${optionGroup("gradient", optionSelect("gradient", text.gradient, [["linear", text.linear], ["radial", text.radial]]))}
    ${optionGroup("bayer", optionSelect("bayer", text.bayer, [["2", "2×2"], ["4", "4×4"], ["8", "8×8"]]))}
    ${optionGroup("tolerance", `<label class="d-flex align-items-center gap-1 mb-0 text-nowrap">${text.tolerance}<input data-option="flood-tolerance" type="number" min="0" max="255" value="0" class="form-control form-control-sm" style="width:4.5rem" /></label>`)}
    ${optionGroup("select", optionSelect("select-mode", text.selection, [["replace", text.selectReplace], ["add", text.selectAdd], ["subtract", text.selectSubtract], ["intersect", text.selectIntersect]]))}
    ${optionGroup("transform", `
      ${iconOnly("flip-h", "fa-right-left", text.flipH)}
      ${iconOnly("flip-v", "fa-up-down", text.flipV)}
      ${iconOnly("rotate-selection", "fa-arrow-rotate-right", text.rotate)}
      ${iconOnly("scale-up", "fa-up-right-and-down-left-from-center", text.scaleUp)}
      ${iconOnly("scale-down", "fa-down-left-and-up-right-to-center", text.scaleDown)}
      ${iconOnly("expand-selection", "fa-expand", text.expandSelection)}
      ${iconOnly("contract-selection", "fa-compress", text.contractSelection)}
      ${iconOnly("invert-selection", "fa-circle-half-stroke", text.invertSelection)}
      ${iconOnly("border-selection", "fa-border-all", text.borderSelection)}
      <label class="d-flex align-items-center gap-1 mb-0 text-nowrap small">${text.freeRotate}<input data-option="free-rotate" type="number" min="-180" max="180" value="15" class="form-control form-control-sm" style="width:4rem" /></label>
      ${iconOnly("apply-free-rotate", "fa-rotate", text.applyFreeRotate)}
      <label class="d-flex align-items-center gap-1 mb-0 text-nowrap small">${text.freeScale}<input data-option="free-scale" type="number" min="25" max="400" value="150" class="form-control form-control-sm" style="width:4.5rem" /></label>
      ${iconOnly("apply-free-scale", "fa-maximize", text.applyFreeScale)}
      ${iconOnly("copy-selection", "fa-copy", text.copySelection)}
      ${iconOnly("cut-selection", "fa-scissors", text.cutSelection)}
      ${iconOnly("paste-selection", "fa-paste", text.pasteSelection)}
      ${iconOnly("delete-selection", "fa-trash-can", text.deleteSelection)}
      ${iconOnly("clear-selection", "fa-xmark", text.clearSelection)}
      ${iconOnly("brush-from-selection", "fa-paintbrush", text.brushFromSelection)}
    `)}
  </div>`;
}

function timelineToolbar(): string {
  const icon = (action: string, iconName: string, label: string) =>
    `<button type="button" class="btn btn-sm btn-outline-secondary icon-btn" data-action="${action}" title="${label}" aria-label="${label}">${fa(iconName)}</button>`;
  return `<div class="timeline-toolbar d-flex flex-wrap align-items-center gap-1 p-2">
    ${icon("first-frame", "fa-backward-step", text.firstFrame)}
    ${icon("prev-frame", "fa-chevron-left", text.prevFrame)}
    ${icon("play", "fa-play", text.play)}
    ${icon("next-frame", "fa-chevron-right", text.nextFrame)}
    ${icon("last-frame", "fa-forward-step", text.lastFrame)}
    <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.duration}
      <input data-action="duration" type="number" min="20" max="5000" step="10" class="form-control form-control-sm" style="width:5.5rem" value="100" />
      ms
    </label>
    <button type="button" class="btn btn-sm btn-outline-secondary icon-btn" data-action="toggle-frame-edit" title="${text.frameActions}" aria-label="${text.frameActions}" aria-expanded="false">${fa("fa-ellipsis")}</button>
    <div class="timeline-more d-flex flex-wrap align-items-center gap-1" hidden>
      ${icon("add-frame", "fa-plus", text.addFrame)}
      ${icon("duplicate-frame", "fa-copy", text.duplicateFrame)}
      ${icon("delete-frame", "fa-trash", text.deleteFrame)}
      ${icon("frame-earlier", "fa-arrow-left", text.moveFrameBack)}
      ${icon("frame-later", "fa-arrow-right", text.moveFrameForward)}
      ${icon("reverse-range", "fa-arrow-right-arrow-left", text.reverseRange)}
      ${icon("copy-cels", "fa-clipboard", text.copyCels)}
      ${icon("add-tag", "fa-tag", text.addTag)}
      <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.onionBefore}
        <input data-field="onion-before" type="number" min="0" max="8" value="0" class="form-control form-control-sm" style="width:3.5rem" />
      </label>
      <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.onionAfter}
        <input data-field="onion-after" type="number" min="0" max="8" value="0" class="form-control form-control-sm" style="width:3.5rem" />
      </label>
      <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.onionOpacity}
        <input data-field="onion-opacity-before" type="number" min="5" max="100" value="28" class="form-control form-control-sm" style="width:3.5rem" title="${text.onionBefore}" />
        <input data-field="onion-opacity-after" type="number" min="5" max="100" value="18" class="form-control form-control-sm" style="width:3.5rem" title="${text.onionAfter}" />
      </label>
      <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.onionTintBefore}
        <input data-field="onion-tint-before" type="color" value="#50a0ff" class="form-control form-control-sm form-control-color" style="width:2.5rem;padding:0.15rem" />
      </label>
      <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.onionTintAfter}
        <input data-field="onion-tint-after" type="color" value="#ff7850" class="form-control form-control-sm form-control-color" style="width:2.5rem;padding:0.15rem" />
      </label>
      ${icon("anim-preview", "fa-clapperboard", text.openAnimPreview)}
    </div>
  </div>
  <div class="tags-host px-2"></div>
  <div class="timeline-frames overflow-auto px-2 pb-2"></div>`;
}

function sheet(id: string, title: string, body: string): string {
  return `<div class="offcanvas offcanvas-bottom pixeluz-sheet" tabindex="-1" id="${id}" aria-labelledby="${id}-label">
    <div class="offcanvas-header flex-column align-items-stretch pb-2">
      <div class="sheet-grab" data-sheet-grab></div>
      <div class="d-flex align-items-center gap-2">
        <h2 class="offcanvas-title h5 mb-0 me-auto" id="${id}-label">${title}</h2>
        ${closeButton("offcanvas")}
      </div>
    </div>
    <div class="offcanvas-body">${body}</div>
  </div>`;
}

export function mountShell(root: HTMLElement): void {
  root.className = "pixeluz-app d-flex flex-column";
  root.innerHTML = `
    <header class="app-header d-flex align-items-center bg-body border-bottom px-2 py-1 gap-2 flex-nowrap">
      <span class="navbar-brand mb-0 py-0 fs-5">${text.appName}</span>
      <input id="doc-name" class="form-control form-control-sm doc-name" aria-label="Nome" autocomplete="off" />
      <div id="flash" class="small text-nowrap" role="status"></div>
      <div class="header-actions d-flex gap-1 overflow-auto flex-nowrap ms-auto">
        ${iconButton("new", "fa-file-circle-plus", text.newSprite, "btn-new")}
        ${iconButton("open", "fa-folder-open", text.open)}
        ${iconButton("save", "fa-floppy-disk", text.save, "btn-save")}
        <div class="dropdown">
          <button type="button" class="btn btn-outline-secondary btn-sm icon-btn dropdown-toggle" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' title="${text.exportMenu}" aria-label="${text.exportMenu}"><i class="fa-solid fa-file-export" aria-hidden="true"></i></button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button type="button" class="dropdown-item" data-action="export">${text.exportPng}</button></li>
            <li><button type="button" class="dropdown-item" data-action="export-gif">${text.exportGif}</button></li>
            <li><button type="button" class="dropdown-item" data-action="export-video">${text.exportVideo}</button></li>
            <li><button type="button" class="dropdown-item" data-action="export-sequence">${text.exportSequence}</button></li>
            <li><button type="button" class="dropdown-item" data-action="export-sheet">${text.exportSheet}</button></li>
            <li><button type="button" class="dropdown-item" data-action="export-ase">${text.exportAse}</button></li>
          </ul>
        </div>
        ${iconButton("download", "fa-download", text.download, "btn-download")}
        ${iconButton("undo", "fa-rotate-left", text.undo, "btn-undo")}
        ${iconButton("redo", "fa-rotate-right", text.redo, "btn-redo")}
        ${iconButton("shortcuts", "fa-keyboard", text.shortcuts, "btn-shortcuts")}
        ${iconButton("grid", "fa-table-cells", text.grid, "btn-grid")}
        ${iconButton("fit", "fa-expand", text.fit, "btn-fit")}
        ${iconButton("settings", "fa-gear", text.settings, "btn-settings")}
      </div>
    </header>
    <div id="doc-tabs" class="doc-tabs d-flex align-items-center gap-1 overflow-auto border-bottom bg-body px-2"></div>
    ${optionsBar()}
    <div class="workspace d-flex flex-grow-1 min-h-0">
      <nav class="tool-rail tool-host d-none d-lg-flex flex-column gap-1 border-end bg-body p-1" aria-label="${text.tools}"></nav>
      <div class="viewport-host flex-grow-1" id="viewport-host"></div>
      <aside class="side-panel d-none d-lg-flex flex-column border-start bg-body">
        <div class="panel-resize-x" data-resize="side" role="separator" aria-orientation="vertical" aria-label="${text.resizePanel}"></div>
        <div class="d-flex align-items-center gap-1 px-2 pt-2">
          <button type="button" class="btn btn-sm btn-outline-secondary panel-toggle" data-action="toggle-panel" data-panel="side" title="${text.minimizePanel}" aria-label="${text.minimizePanel}">${fa("fa-chevron-right")}</button>
          <span class="small text-secondary panel-label">${text.preview}</span>
        </div>
        <div class="panel-body overflow-auto">
          ${previewPanel()}
          ${colorPanel()}
          ${layerPanel()}
        </div>
      </aside>
    </div>
    <div class="status-bar border-top bg-body px-2 py-1 d-flex align-items-center gap-2 small">
      <span id="status-doc" class="text-nowrap"></span>
      <span id="browser-notice" class="text-secondary text-truncate flex-grow-1 min-w-0" hidden></span>
      <span id="status-pos" class="text-secondary"></span>
      <span id="status-pixel" class="text-secondary text-nowrap"></span>
      <span id="status-swatch" class="status-swatch" hidden></span>
      <span id="status-selection" class="text-secondary text-nowrap"></span>
      <span class="ms-auto" id="status-zoom"></span>
    </div>
    <section class="timeline-desktop timeline-host d-none d-lg-flex flex-column border-top bg-body" aria-label="${text.frames}">
      <div class="panel-resize-y" data-resize="timeline" role="separator" aria-orientation="horizontal" aria-label="${text.resizePanel}"></div>
      <div class="d-flex align-items-center gap-1 px-2 pt-1">
        <button type="button" class="btn btn-sm btn-outline-secondary panel-toggle" data-action="toggle-panel" data-panel="timeline" title="${text.minimizePanel}" aria-label="${text.minimizePanel}">${fa("fa-chevron-down")}</button>
        <span class="small text-secondary panel-label">${text.frames}</span>
      </div>
      <div class="timeline-body overflow-auto d-flex flex-column flex-grow-1">
        ${timelineToolbar()}
      </div>
    </section>
    <nav class="mobile-bar d-lg-none border-top bg-body" aria-label="${text.tools}">
      <div class="tool-host mobile-tools d-flex gap-1 overflow-auto p-1"></div>
      <div class="d-flex gap-1 px-1 pb-1">
        <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" data-bs-toggle="offcanvas" data-bs-target="#offcanvas-colors">${text.colors}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" data-bs-toggle="offcanvas" data-bs-target="#offcanvas-layers">${text.layers}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" data-bs-toggle="offcanvas" data-bs-target="#offcanvas-timeline">${text.frames}</button>
      </div>
    </nav>
    ${sheet("offcanvas-colors", text.colors, `${previewPanel()}${colorPanel()}`)}
    ${sheet("offcanvas-layers", text.layers, layerPanel())}
    ${sheet("offcanvas-timeline", text.frames, `<div class="timeline-host">${timelineToolbar()}</div>`)}
    <div class="modal fade" id="modal-new" tabindex="-1" aria-labelledby="modal-new-label" aria-hidden="true">
      <div class="modal-dialog">
        <form class="modal-content" id="form-new">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-new-label">${text.newTitle}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <div class="row g-2">
              <div class="col">
                <label class="form-label" for="new-width">${text.width}</label>
                <input class="form-control" id="new-width" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" value="32" required inputmode="numeric" />
              </div>
              <div class="col">
                <label class="form-label" for="new-height">${text.height}</label>
                <input class="form-control" id="new-height" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" value="32" required inputmode="numeric" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${text.cancel}</button>
            <button type="submit" class="btn btn-primary">${text.create}</button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal fade" id="modal-video" tabindex="-1" aria-labelledby="modal-video-label" aria-hidden="true">
      <div class="modal-dialog">
        <form class="modal-content" id="form-video">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-video-label">${text.videoTitle}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <label class="form-label" for="video-scale">${text.videoScale}</label>
            <select class="form-select" id="video-scale">
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4" selected>4×</option>
              <option value="8">8×</option>
            </select>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${text.cancel}</button>
            <button type="submit" class="btn btn-primary">${text.exportMenu}</button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal fade" id="modal-shortcuts" tabindex="-1" aria-labelledby="modal-shortcuts-label" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-shortcuts-label">${text.shortcuts}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <p class="small text-secondary">${text.shortcutHold}</p>
            <div class="shortcuts-host"></div>
            <button type="button" class="btn btn-sm btn-outline-secondary mt-2" data-action="reset-shortcuts">${text.shortcutReset}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="modal-settings" tabindex="-1" aria-labelledby="modal-settings-label" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-settings-label">${text.settings}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body d-flex flex-column gap-3">
            <section>
              <label class="form-label" for="locale-select">${text.language}</label>
              <select class="form-select" id="locale-select" aria-label="${text.language}">
                <option value="pt-BR" ${currentLocale() === "pt-BR" ? "selected" : ""}>Português (Brasil)</option>
                <option value="en" ${currentLocale() === "en" ? "selected" : ""}>English</option>
                <option value="es" ${currentLocale() === "es" ? "selected" : ""}>Español</option>
              </select>
            </section>
            <section>
              <h3 class="h6">${text.canvasSize}</h3>
              <form id="form-canvas">
                <div class="row g-2">
                  <div class="col"><label class="form-label" for="canvas-width">${text.width}</label><input class="form-control" id="canvas-width" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" inputmode="numeric" required /></div>
                  <div class="col"><label class="form-label" for="canvas-height">${text.height}</label><input class="form-control" id="canvas-height" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" inputmode="numeric" required /></div>
                  <div class="col-12"><label class="form-label" for="canvas-anchor">${text.anchor}</label><select class="form-select" id="canvas-anchor"><option value="nw">↖</option><option value="n">↑</option><option value="ne">↗</option><option value="w">←</option><option value="center" selected>⊙</option><option value="e">→</option><option value="sw">↙</option><option value="s">↓</option><option value="se">↘</option></select></div>
                </div>
                <h3 class="h6 mt-3">${text.grid}</h3>
                <div class="row g-2">
                  <div class="col"><label class="form-label" for="grid-width">${text.width}</label><input class="form-control" id="grid-width" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" inputmode="numeric" required /></div>
                  <div class="col"><label class="form-label" for="grid-height">${text.height}</label><input class="form-control" id="grid-height" type="number" min="${MIN_SPRITE_SIZE}" max="${MAX_SPRITE_SIZE}" inputmode="numeric" required /></div>
                </div>
                <p class="small text-secondary mb-0 mt-2">${text.gridHint}</p>
              </form>
              <div class="d-flex flex-wrap gap-1 mt-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="crop-selection">${text.cropSelection}</button>
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="autocrop">${text.autocrop}</button>
              </div>
            </section>
            <details class="settings-more">
              <summary class="h6">${text.moreTools}</summary>
              <div class="d-flex flex-column gap-3 mt-3">
                <section>
                  <h3 class="h6">${text.rotsprite}</h3>
                  <div class="d-flex gap-2">
                    <input class="form-control" id="rotsprite-angle" type="number" min="-360" max="360" value="90" aria-label="${text.angleDeg}" />
                    <button type="button" class="btn btn-outline-secondary" data-action="rotsprite">${text.rotsprite}</button>
                  </div>
                </section>
                <section>
                  <h3 class="h6">${text.textTool}</h3>
                  <div class="d-flex gap-2">
                    <input class="form-control" id="text-input" type="text" maxlength="64" aria-label="${text.textTool}" />
                    <button type="button" class="btn btn-outline-secondary" data-action="insert-text">${text.insertText}</button>
                  </div>
                </section>
                <section>
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <h3 class="h6 mb-0 me-auto">${text.slices}</h3>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="add-slice">${text.addSlice}</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="export-slices">${text.exportSlices}</button>
                  </div>
                  <div class="slices-host"></div>
                </section>
              </div>
            </details>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${text.cancel}</button>
            <button type="submit" form="form-canvas" class="btn btn-primary">${text.save}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="modal-open" tabindex="-1" aria-labelledby="modal-open-label" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-open-label">${text.openTitle}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h3 class="h6 mb-0">${text.stored}</h3>
              <button type="button" class="btn btn-sm btn-outline-primary" data-action="browse">${text.browse}</button>
            </div>
            <div id="project-list" class="list-group"></div>
            <input id="file-input" type="file" accept="${fileInputAccept(OPEN_FILE_TYPES)}" class="d-none" />
            <input id="palette-file" type="file" accept="${fileInputAccept(PALETTE_FILE_TYPES)}" class="d-none" />
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="modal-dialog" tabindex="-1" aria-labelledby="dialog-title" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="dialog-title">${text.dialogTitle}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <p id="dialog-message" class="mb-0"></p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-dialog="cancel">${text.cancel}</button>
            <button type="button" class="btn btn-primary" data-dialog="confirm">${text.dialogConfirm}</button>
            <button type="button" class="btn btn-primary" data-dialog="ok" hidden>${text.dialogOk}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal fade" id="modal-anim-preview" tabindex="-1" aria-labelledby="modal-anim-preview-label" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title h5" id="modal-anim-preview-label">${text.animPreview}</h2>
            ${closeButton("modal")}
          </div>
          <div class="modal-body">
            <div class="anim-preview-stage bg-dark d-flex align-items-center justify-content-center mb-3">
              <canvas id="anim-preview-canvas" class="anim-preview-canvas" width="32" height="32"></canvas>
            </div>
            <div class="d-flex flex-wrap align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary" data-action="anim-preview-toggle" aria-label="${text.play}">${fa("fa-play")}</button>
              <label class="small text-secondary d-flex align-items-center gap-1 mb-0">${text.animSpeed}
                <input id="anim-preview-speed" type="number" min="0.25" max="4" step="0.25" value="1" class="form-control form-control-sm" style="width:4.5rem" />
                ×
              </label>
              <label class="small text-secondary d-flex align-items-center gap-1 mb-0">Zoom
                <input id="anim-preview-zoom" type="number" min="1" max="32" value="8" class="form-control form-control-sm" style="width:4.5rem" />
                ×
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
