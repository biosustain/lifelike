import { FilesystemObject, ProjectImpl } from '../models/filesystem-object';
import { TextElement } from '../../graph-viewer/utils/canvas/text-element';
import 'canvas-plus';
import { DragImage } from '../../shared/utils/drag';

function createDragImage(label: string, fontAwesomeIconCode: string): DragImage {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const paddingX = 18;
  const paddingY = 12;
  const iconLabelSpacing = 7;
  const shadowSize = 10;

  let width = paddingX * 2 + shadowSize;
  let height = paddingY * 2 + shadowSize;

  const iconTextElement = new TextElement(ctx, {
    text: fontAwesomeIconCode,
    font: '900 16px "Font Awesome 5 Pro"',
    fillStyle: '#adb5bd',
  });

  width += iconTextElement.actualWidth + iconLabelSpacing;

  const labelTextElement = new TextElement(ctx, {
    text: label,
    font: '16px Roboto',
    fillStyle: 'black',
  });

  width += labelTextElement.actualWidth;
  height += labelTextElement.actualHeight;

  canvas.width = width;
  canvas.height = height;

  (ctx as any).roundedRect(
    1,
    1,
    width - shadowSize - 2,
    height - shadowSize - 2,
    5,
  );
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#ccc';
  ctx.shadowBlur = shadowSize;
  ctx.fill();

  (ctx as any).roundedRect(
    1,
    1,
    width - shadowSize - 2,
    height - shadowSize - 2,
    5,
  );
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 1;
  ctx.stroke();

  iconTextElement.draw(paddingX, paddingY + 2);
  labelTextElement.draw(paddingX + iconTextElement.actualWidth + iconLabelSpacing, paddingY);

  return new DragImage(canvas, 0, 0);
}

export function createProjectDragImage(project: ProjectImpl): DragImage {
  return createDragImage(project.name, '\uf5fd');
}

export function createObjectDragImage(object: FilesystemObject): DragImage {
  return createDragImage(object.filename, object.fontAwesomeIconCode);
}
