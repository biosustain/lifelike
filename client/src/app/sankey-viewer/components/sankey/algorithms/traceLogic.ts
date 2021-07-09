import { symmetricDifference } from '../utils';
import { cubehelix } from 'd3';

export const colorByTraceEnding = ({sourceLinks, targetLinks, _color, _selected}: SankeyNode) => {
  const difference = symmetricDifference(sourceLinks, targetLinks, link => link._trace);
  if (difference.size === 1) {
    const traceColor = difference.values().next().value._trace._color;
    const labColor = cubehelix(_color);
    const calcColor = cubehelix(traceColor);
    // calcColor.l = labColor.l;
    // calcColor.opacity = _selected ? 1 : labColor.opacity;
    return calcColor;
  }
};
