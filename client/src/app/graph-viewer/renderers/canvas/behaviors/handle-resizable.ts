import { cloneDeep } from 'lodash';
import * as d3 from 'd3';

import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PlacedNode } from 'app/graph-viewer/styles/styles';
import { GraphCanvasView } from '../graph-canvas-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { GraphEntityUpdate } from '../../../actions/graph';

const BEHAVIOR_KEY = '_handle-resizable/active';

/**
 * Adds the UX to let nodes be resized via handles.
 */
export class HandleResizable extends AbstractCanvasBehavior {
  /**
   * Subscription for when the selection changes.
   */
  private selectionChangeSubscription;

  constructor(private readonly graphView: GraphCanvasView) {
    super();
  }

  setup() {
    this.selectionChangeSubscription = this.graphView.selection.changeObservable.subscribe(([newSelection, oldSelection]) => {
      if (newSelection.length === 1 && newSelection[0].type === GraphEntityType.Node) {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
        this.graphView.behaviors.add(BEHAVIOR_KEY, new ActiveResize(this.graphView, newSelection[0].entity as UniversalGraphNode), 100);
      } else {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
      }
    });
  }
}

/**
 * Holds the state of an active resize.
 */
export class ActiveResize extends AbstractCanvasBehavior {
  private originalSize: { width: number, height: number } | undefined;
  private dragStartPosition: { x: number, y: number } = {x: 0, y: 0};
  private handle: DragHandle | undefined;
  private originalTarget: UniversalGraphNode;

  constructor(private readonly graphView: GraphCanvasView,
              private readonly target: UniversalGraphNode,
              private size = 10) {
    super();
    this.originalTarget = cloneDeep(this.target);
  }

  dragStart(): BehaviorResult {
    const transform = this.graphView.transform;
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = transform.invertX(mouseX);
    const graphY = transform.invertY(mouseY);
    const subject: GraphEntity | undefined = d3.event.subject;

    if (subject.type === GraphEntityType.Node) {
      this.handle = this.getHandleIntersected(this.graphView.placeNode(this.target), graphX, graphY);
      this.originalSize = this.getCurrentNodeSize();
      this.dragStartPosition = {x: graphX, y: graphY};
    }

    return BehaviorResult.Continue;
  }

  drag(): BehaviorResult {
    if (this.handle) {
      const transform = this.graphView.transform;
      const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
      const graphX = transform.invertX(mouseX);
      const graphY = transform.invertY(mouseY);

      this.handle.execute(this.target, this.originalSize, this.dragStartPosition, {x: graphX, y: graphY});
      this.graphView.invalidateNode(this.target);
      this.graphView.requestRender();
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  dragEnd(): BehaviorResult {
    this.drag();
    this.handle = null;
    this.graphView.execute(new GraphEntityUpdate('Resize node', {
      type: GraphEntityType.Node,
      entity: this.target,
    }, {
      data: {
        width: this.target.data.width,
        height: this.target.data.height,
      }
    } as Partial<UniversalGraphNode>, {
      data: {
        width: this.originalTarget.data.width,
        height: this.originalTarget.data.height,
      }
    } as Partial<UniversalGraphNode>));
    this.originalTarget = cloneDeep(this.target);
    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
    const placedNode = this.graphView.placeNode(this.target);

    ctx.beginPath();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (const {minX, minY, maxX, maxY} of Object.values(this.getHandleBoundingBoxes(placedNode))) {
      ctx.rect(minX, minY, maxX - minX, maxY - minY);
      ctx.fill();
      ctx.stroke();
    }
  }

  getCurrentNodeSize(): { width: number, height: number } {
    let width = this.target.data.width;
    let height = this.target.data.height;

    if (width == null || height == null) {
      const bbox = this.graphView.placeNode(this.target).getBoundingBox();

      if (width == null) {
        width = bbox.maxX - bbox.minX + 1;
      }
      if (height == null) {
        height = bbox.maxY - bbox.minY + 1;
      }
    }

    return {width, height};
  }

  isPointIntersectingNode(placedNode: PlacedNode, x: number, y: number): boolean {
    return !!this.handle || !!this.getHandleIntersected(placedNode, x, y);
  }

  getHandleIntersected(placedNode: PlacedNode, x: number, y: number): DragHandle | undefined {
    for (const handle of this.getHandleBoundingBoxes(placedNode)) {
      if (x >= handle.minX && x <= handle.maxX && y >= handle.minY && y <= handle.maxY) {
        return handle;
      }
    }
    return null;
  }

  getHandleBoundingBoxes(placedNode: PlacedNode): DragHandle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = this.size * noZoomScale;
    const halfSize = size / 2;
    return [
      // Top left
      {
        execute: (target, originalSize, dragStartPosition, graphPosition) => {
          target.data.width = Math.abs(this.originalSize.width - (graphPosition.x - this.dragStartPosition.x) * 2);
          target.data.height = Math.abs(this.originalSize.height - (graphPosition.y - this.dragStartPosition.y) * 2);
        },
        minX: bbox.minX - halfSize,
        minY: bbox.minY - halfSize,
        maxX: bbox.minX + halfSize,
        maxY: bbox.minY + halfSize,
      },
      // Bottom left
      {
        execute: (target, originalSize, dragStartPosition, graphPosition) => {
          target.data.width = Math.abs(this.originalSize.width - (graphPosition.x - this.dragStartPosition.x) * 2);
          target.data.height = Math.abs(this.originalSize.height + (graphPosition.y - this.dragStartPosition.y) * 2);
        },
        minX: bbox.minX - halfSize,
        minY: bbox.maxY - halfSize,
        maxX: bbox.minX + halfSize,
        maxY: bbox.maxY + halfSize,
      },
      // Top right
      {
        execute: (target, originalSize, dragStartPosition, graphPosition) => {
          target.data.width = Math.abs(this.originalSize.width + (graphPosition.x - this.dragStartPosition.x) * 2);
          target.data.height = Math.abs(this.originalSize.height - (graphPosition.y - this.dragStartPosition.y) * 2);
        },
        minX: bbox.maxX - halfSize,
        minY: bbox.minY - halfSize,
        maxX: bbox.maxX + halfSize,
        maxY: bbox.minY + halfSize,
      },
      // Bottom right
      {
        execute: (target, originalSize, dragStartPosition, graphPosition) => {
          target.data.width = Math.abs(this.originalSize.width + (graphPosition.x - this.dragStartPosition.x) * 2);
          target.data.height = Math.abs(this.originalSize.height + (graphPosition.y - this.dragStartPosition.y) * 2);
        },
        minX: bbox.maxX - halfSize,
        minY: bbox.maxY - halfSize,
        maxX: bbox.maxX + halfSize,
        maxY: bbox.maxY + halfSize,
      },
    ];
  }
}

interface DragHandle {
  execute: (target: UniversalGraphNode,
            originalSize: { width: number, height: number },
            dragStartPosition: { x: number, y: number },
            graphPosition: { x: number, y: number }) => void;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
