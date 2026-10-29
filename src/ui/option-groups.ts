import type { ToolId } from "../tools/tool";

const STROKE: ReadonlySet<ToolId> = new Set([
  "pencil",
  "eraser",
  "line",
  "curve",
  "rectangle",
  "ellipse",
  "contour",
  "polygon",
]);

const SELECT: ReadonlySet<ToolId> = new Set([
  "select-rect",
  "select-ellipse",
  "select-lasso",
  "select-polygon",
  "select-wand",
]);

export function optionGroupsFor(tool: ToolId, hasSelection: boolean): string[] {
  const groups: string[] = [];
  if (STROKE.has(tool)) groups.push("size", "shape", "angle", "opacity", "symmetry");
  if (STROKE.has(tool) && tool !== "eraser") groups.push("ink");
  if (tool === "pencil" || tool === "eraser" || tool === "contour") groups.push("perfect");
  if (STROKE.has(tool) || tool === "bucket" || tool === "eyedropper" || SELECT.has(tool)) groups.push("tile");
  if (tool === "gradient") groups.push("gradient", "bayer");
  if (SELECT.has(tool)) groups.push("select");
  if (tool === "move" || hasSelection) groups.push("transform");
  return groups;
}
