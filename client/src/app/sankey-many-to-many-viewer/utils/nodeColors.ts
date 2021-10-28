/**
 * Till the time we have some mechanism to share these value this file contains copy of values from scss file with
 * the same name.
 */

export enum NodePosition {
  left,
  right,
  multi
}

export const nodeLightness = 60;
export const nodeSaturation = 40;

export const nodeColor = `hsl(0, 0, ${nodeLightness}%)`;

export const nodeColors = new Map<NodePosition, string>([
  [NodePosition.left, `hsl(240, ${nodeSaturation}%, ${nodeLightness}%)`],
  [NodePosition.right, `hsl(120, ${nodeSaturation}%, ${nodeLightness}%)`],
  [NodePosition.multi, `hsl(180, ${nodeSaturation}%, ${nodeLightness}%)`],
]);
