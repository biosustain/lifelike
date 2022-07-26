import { TextElement } from './text-element';
import { Line } from './lines/lines';

// ---------------------------------
// Constants
// ---------------------------------

// First threshold - we want start to modify the fonts to increase visibility/remove text from nodes
export const VISIBLE_TEXT_THRESHOLD = 0.6;

// Second threshold - we remove all text from the graph
export const NO_TEXT_THRESHOLD = 0.15;

// Knowledge-map styles
export const DEFAULT_LABEL_FONT_SIZE = 16;
export const BORDER_BLUE_COLOR = '#2B7CE9';

export const SELECTION_SHADOW_COLOR = 'rgba(0, 0, 0, 0.075)';
export const DEFAULT_SELECTION_MARGIN = 10;
// Review note: Move to the PlacedEdge?
export const EDGE_SELECTION_WIDTH = 20;


export enum LineTypes {
  Dashed = 'dashed',
  LongDashed = 'long-dashed',
  Dotted = 'dotted',
  Blank = 'none',
  Solid = 'solid',
  TwoDash = 'two-dashed'
}

// ---------------------------------
// Shared functions
// ---------------------------------

/**
 * Draw textbox, ensuring that the font appear at least as big, as at visibleTextThreshold.
 * @param textbox - text to draw
 * @param k - k part of the transform - describing zoom
 * @param x - x pos of the textbox
 * @param y - y pos of the textbox
 */
export function drawTextNotSmallerThanMin(textbox: TextElement, k: number, x: number, y: number) {
  const oldFont = textbox.font;
  const fontSize = parseFloat(oldFont);
  const visibleText = k >= VISIBLE_TEXT_THRESHOLD * (DEFAULT_LABEL_FONT_SIZE / fontSize);
  if (visibleText) {
    textbox.drawCenteredAt(x, y);
  } else {
    const newFont = ((DEFAULT_LABEL_FONT_SIZE * VISIBLE_TEXT_THRESHOLD) / k)
      + 'px' + oldFont.split('px').pop();
    textbox.drawWithDifferentFont(x, y, newFont);
  }
}

export function drawStrokeAndFill(ctx: CanvasRenderingContext2D, shapeFillColor: string) {
  if (shapeFillColor) {
    ctx.fillStyle = shapeFillColor;
    ctx.fill();
  }
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Line, zoomResetScale: number) {
  if (stroke) {
    stroke.setContext(ctx);
    ctx.lineWidth = zoomResetScale * ctx.lineWidth;
    ctx.stroke();
  }
}

export function getRectWithMargin(bbox: BoundingBox, margin: number = 0): Rect {
  const {minX, minY, maxX, maxY} = bbox;
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Check if one (child) bbox is cointained in full by the other (parent) bbox.
 * @param parent - possibly larger Bounding Box to contain child
 * @param child - possible smaller Bounding Box to be contained within parent
 * PS Feel free to change the naming, I am not sure about it, just did not want to do bbox1 and bbox2
 */
export function isBBoxEnclosing(parent: BoundingBox, child: BoundingBox): boolean {
  return child.minX >= parent.minX
    && child.minY >= parent.minY
    && child.maxX <= parent.maxX
    && child.maxY <= parent.maxY;
}

export function isPointIntersecting(bbox: BoundingBox, {x, y}: Point): boolean {
  return (bbox.minX <= x && bbox.maxX >= x && bbox.minY <= y && bbox.maxY >= y);
}
