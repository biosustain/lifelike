import { cloneDeep } from 'lodash';

import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PlacedNode } from 'app/graph-viewer/styles/styles';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { AbstractNodeHandleBehavior, Handle } from 'app/graph-viewer/utils/behaviors/abstract-node-handle-behavior';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior } from '../../behaviors';

const BEHAVIOR_KEY = '_handle-resizable/active';

/**
 * Adds the UX to let nodes be resized via handles.
 */
export class HandleResizable extends AbstractCanvasBehavior {
  /**
   * Subscription for when the selection changes.
   */
  private selectionChangeSubscription;

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  setup() {
    this.selectionChangeSubscription = this.graphView.selection.changeObservable.subscribe(([newSelection, oldSelection]) => {
      if (newSelection.length === 1 && newSelection[0].type === GraphEntityType.Node &&
        this.graphView.placeNode(newSelection[0].entity as UniversalGraphNode).resizable) {
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
export class ActiveResize extends AbstractNodeHandleBehavior<DragHandle> {
  private originalSize: { width: number, height: number } | undefined;
  private dragStartPosition: { x: number, y: number } = {x: 0, y: 0};
  private originalTarget: UniversalGraphNode;

  constructor(graphView: CanvasGraphView,
              target: UniversalGraphNode,
              private size = 10) {
    super(graphView, target);
    this.originalTarget = cloneDeep(this.target);
  }

  isPointIntersectingNode(placedNode: PlacedNode, x: number, y: number): boolean {
    // Consider ourselves still intersecting if we have a handle
    return (!!this.handle || !!this.getHandleIntersected(placedNode, x, y)) ? true : undefined;
  }

  protected activeDragStart(event: MouseEvent, graphX: number, graphY: number, subject: GraphEntity | undefined) {
    this.originalSize = this.getCurrentNodeSize();
    this.dragStartPosition = {x: graphX, y: graphY};
  }

  protected activeDrag(event: MouseEvent, graphX: number, graphY: number) {
    this.handle.execute(this.target, this.originalSize, this.dragStartPosition, {x: graphX, y: graphY});
    this.graphView.invalidateNode(this.target);
    this.graphView.requestRender();
  }

  protected activeDragEnd(event: MouseEvent) {
    if (this.target.data.width !== this.originalTarget.data.width ||
      this.target.data.height !== this.originalTarget.data.height) {
      this.graphView.execute(new GraphEntityUpdate('Resize node', {
        type: GraphEntityType.Node,
        entity: this.target,
      }, {
        data: {
          width: this.target.data.width,
          height: this.target.data.height,
        },
      } as Partial<UniversalGraphNode>, {
        data: {
          width: this.originalTarget.data.width,
          height: this.originalTarget.data.height,
        },
      } as Partial<UniversalGraphNode>));
      this.originalTarget = cloneDeep(this.target);
    }
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

interface DragHandle extends Handle {
  execute: (target: UniversalGraphNode,
            originalSize: { width: number, height: number },
            dragStartPosition: { x: number, y: number },
            graphPosition: { x: number, y: number }) => void;
}
