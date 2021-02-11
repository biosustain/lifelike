import { UniversalGraphNode } from '../services/interfaces';
import { PlacedNode } from '../../graph-viewer/styles/styles';
import * as d3 from 'd3';
import { DragImage } from '../../shared/utils/drag';
import { KnowledgeMapStyle } from '../../graph-viewer/styles/knowledge-map-style';

const style = new KnowledgeMapStyle();

export function createNodeDragImage(d: UniversalGraphNode): DragImage {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const placedNode: PlacedNode = style.placeNode(d, ctx, {
    highlighted: false,
    selected: false,
  });
  const bbox = placedNode.getBoundingBox();
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  ctx.translate(width / 2 + 1, height / 2 + 1);
  placedNode.draw(d3.zoomIdentity);

  return new DragImage(canvas, width / 2, height / 2);
}
