import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { annotationTypesMap } from 'app/shared/annotation-styles';

/**
 * Calculate the primary color for the given node.
 * @param d the node in question
 */
export function calculateNodeColor(d: UniversalGraphNode): string {
  // TODO: Refactor into reusable class
  return annotationTypesMap.get(d.label).color;
}

/**
 * Calculate the font string for a graph node.
 * @param d the node to calculate for
 * @param selected whether the node is selected
 * @param highlighted whether the node is highlighted
 * @param fontSizeScale scale factor (default 1)
 */
export function calculateNodeFont(d: UniversalGraphNode,
                                  selected: boolean,
                                  highlighted: boolean,
                                  fontSizeScale = 1): string {
  // TODO: Refactor into reusable class
  return (highlighted || selected ? 'bold ' : '') + (16 * fontSizeScale) + 'px Roboto';
}
