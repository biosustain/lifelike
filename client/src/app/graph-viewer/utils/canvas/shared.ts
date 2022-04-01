import { TextElement } from './text-element';
import { Line } from './lines/lines';

// ---------------------------------
// Constants
// ---------------------------------

// First threshold - we want start to modify the fonts to increase visibility/remove text from nodes
export const visibleTextThreshold = 0.4;
// Second threshold - we remove all text from the graph
export const noTextThreshold = 0.15;

// Knowledge-map styles
export const defaultLabelFontSize = 16;
export const borderBlue = '#2B7CE9';

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
  const visibleText = k >= visibleTextThreshold * (defaultLabelFontSize / fontSize);
  if (!visibleText) {
    textbox.font = ((defaultLabelFontSize * visibleTextThreshold) / k)
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
