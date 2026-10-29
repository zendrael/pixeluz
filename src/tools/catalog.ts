import type { ToolId } from "./tool";
import type { Messages } from "../ui/i18n";

export interface ToolMeta {
  id: ToolId;
  icon: string;
  labelKey: keyof Messages;
  key: string;
}

export const TOOL_META: ToolMeta[] = [
  { id: "pencil", icon: "fa-solid fa-pencil", labelKey: "toolPencil", key: "b" },
  { id: "eraser", icon: "fa-solid fa-eraser", labelKey: "toolEraser", key: "e" },
  { id: "eyedropper", icon: "fa-solid fa-eye-dropper", labelKey: "toolEyedropper", key: "i" },
  { id: "bucket", icon: "fa-solid fa-fill-drip", labelKey: "toolBucket", key: "g" },
  { id: "line", icon: "fa-solid fa-slash", labelKey: "toolLine", key: "l" },
  { id: "curve", icon: "fa-solid fa-bezier-curve", labelKey: "toolCurve", key: "c" },
  { id: "rectangle", icon: "fa-regular fa-square", labelKey: "toolRectangle", key: "u" },
  { id: "ellipse", icon: "fa-regular fa-circle", labelKey: "toolEllipse", key: "o" },
  { id: "contour", icon: "fa-solid fa-pen-nib", labelKey: "toolContour", key: "k" },
  { id: "polygon", icon: "fa-solid fa-draw-polygon", labelKey: "toolPolygon", key: "p" },
  { id: "gradient", icon: "fa-solid fa-fill", labelKey: "toolGradient", key: "m" },
  { id: "select-rect", icon: "fa-solid fa-crop-simple", labelKey: "toolSelectRect", key: "s" },
  { id: "select-ellipse", icon: "fa-solid fa-circle-dot", labelKey: "toolSelectEllipse", key: "q" },
  { id: "select-lasso", icon: "fa-solid fa-signature", labelKey: "toolSelectLasso", key: "f" },
  { id: "select-polygon", icon: "fa-solid fa-draw-polygon", labelKey: "toolSelectPolygon", key: "y" },
  { id: "select-wand", icon: "fa-solid fa-wand-magic-sparkles", labelKey: "toolSelectWand", key: "w" },
  { id: "move", icon: "fa-solid fa-up-down-left-right", labelKey: "toolMove", key: "v" },
  { id: "zoom", icon: "fa-solid fa-magnifying-glass-plus", labelKey: "toolZoom", key: "z" },
  { id: "hand", icon: "fa-solid fa-hand", labelKey: "toolHand", key: "h" },
];
