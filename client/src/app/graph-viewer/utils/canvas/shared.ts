import { TextElement } from './text-element';
import { Line } from './lines/lines';

// ---------------------------------
// Constants
// ---------------------------------

// First threshold - we want start to modify the fonts to increase visibility/remove text from nodes
export const VISIBLE_TEXT_THRESHOLD = 0.4;
// Second threshold - we remove all text from the graph
export const NO_TEXT_THRESHOLD = 0.15;

// Knowledge-map styles
export const DEFAULT_LABEL_FONT_SIZE = 16;
export const BORDER_BLUE_COLOR = '#2B7CE9';


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
  if (!visibleText) {
    textbox.font = ((DEFAULT_LABEL_FONT_SIZE * VISIBLE_TEXT_THRESHOLD) / k)
      + 'px' + oldFont.split('px').pop();
  }
  textbox.drawCenteredAt(x, y);
  textbox.font = oldFont;
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
