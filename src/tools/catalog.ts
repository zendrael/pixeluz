import type { ToolId } from "./tool";
import type { Messages } from "../ui/i18n";

export interface ToolMeta {
  id: ToolId;
  icon: string;
  labelKey: keyof Messages;
  key: string;
}

export const TOOL_META: ToolMeta[] = [
  { id: "pencil", icon: "pencil-simple", labelKey: "toolPencil", key: "b" },
  { id: "eraser", icon: "eraser", labelKey: "toolEraser", key: "e" },
  { id: "eyedropper", icon: "eyedropper", labelKey: "toolEyedropper", key: "i" },
  { id: "bucket", icon: "paint-bucket", labelKey: "toolBucket", key: "g" },
  { id: "line", icon: "line-segment", labelKey: "toolLine", key: "l" },
  { id: "curve", icon: "bezier-curve", labelKey: "toolCurve", key: "c" },
  { id: "rectangle", icon: "rectangle", labelKey: "toolRectangle", key: "u" },
  { id: "ellipse", icon: "circle", labelKey: "toolEllipse", key: "o" },
  { id: "contour", icon: "pen-nib", labelKey: "toolContour", key: "k" },
  { id: "polygon", icon: "polygon", labelKey: "toolPolygon", key: "p" },
  { id: "gradient", icon: "gradient", labelKey: "toolGradient", key: "m" },
  { id: "select-rect", icon: "selection", labelKey: "toolSelectRect", key: "s" },
  { id: "select-ellipse", icon: "circle-dashed", labelKey: "toolSelectEllipse", key: "q" },
  { id: "select-lasso", icon: "lasso", labelKey: "toolSelectLasso", key: "f" },
  { id: "select-polygon", icon: "polygon", labelKey: "toolSelectPolygon", key: "y" },
  { id: "select-wand", icon: "magic-wand", labelKey: "toolSelectWand", key: "w" },
  { id: "move", icon: "arrows-out-cardinal", labelKey: "toolMove", key: "v" },
  { id: "zoom", icon: "magnifying-glass-plus", labelKey: "toolZoom", key: "z" },
  { id: "hand", icon: "hand", labelKey: "toolHand", key: "h" },
];
