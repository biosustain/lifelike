import { defaultLabelFontSize } from 'app/shared/constants';

import { TextElement } from './text-element';


// First threshold - we want start to modify the fonts to increase visibility/remove text from nodes
export const visibleTextThreshold = 0.4;
// Second threshold - we remove all text from the graph
export const noTextThreshold = 0.15;

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
  if (visibleText) {
    textbox.drawCenteredAt(x, y);
  } else {
    const newFont = ((defaultLabelFontSize * visibleTextThreshold) / k)
      + 'px' + oldFont.split('px').pop();
    textbox.drawWithDifferentFont(x, y, newFont);
  }
}
