import { constrainSquare, ellipsePixels, linePixels, rectanglePixels, snapLineEnd } from "../render/raster";
import { BucketTool } from "./bucket";
import { EyedropperTool } from "./eyedropper";
import { GradientTool } from "./gradient-tool";
import { MoveTool } from "./move-tool";
import { PencilTool } from "./pencil";
import { PlotTool } from "./plot-tool";
import { SelectTool } from "./select-tool";
import { ShapeTool } from "./shape-tool";
import type { Tool, ToolId } from "./tool";
import { HandTool, ZoomTool } from "./view-tools";

export function createTools(): Map<ToolId, Tool> {
  const tools: Tool[] = [
    new PencilTool("paint"),
    new PencilTool("erase"),
    new EyedropperTool(),
    new BucketTool(),
    new ShapeTool("line", linePixels, snapLineEnd),
    new PlotTool("curve", "curve"),
    new ShapeTool("rectangle", rectanglePixels, constrainSquare),
    new ShapeTool("ellipse", ellipsePixels, constrainSquare),
    new PlotTool("contour", "contour"),
    new PlotTool("polygon", "polygon"),
    new GradientTool(),
    new SelectTool("select-rect", "rect"),
    new SelectTool("select-ellipse", "ellipse"),
    new SelectTool("select-lasso", "lasso"),
    new SelectTool("select-polygon", "polygon"),
    new SelectTool("select-wand", "wand"),
    new MoveTool(),
    new ZoomTool(),
    new HandTool(),
  ];
  return new Map(tools.map((tool) => [tool.id, tool]));
}
