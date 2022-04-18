import { cloneDeep } from 'lodash-es';

import { GraphEntity, GraphEntityType, NodeGroup, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PlacedGroup, PlacedNode, PlacedObject } from 'app/graph-viewer/styles/styles';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { AbstractObjectHandleBehavior, Handle, Point } from 'app/graph-viewer/utils/behaviors/abstract-object-handle-behavior';
import { BLACK_COLOR, HANDLE_BLUE_COLOR } from 'app/shared/constants';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior } from '../../behaviors';

const BEHAVIOR_KEY = '_handle-resizable/active';

/**
 * Adds the UX to let nodes be resized via handles.
 */
export class HandleResizableBehavior extends AbstractCanvasBehavior {
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
        this.graphView.behaviors.add(BEHAVIOR_KEY, new ActiveNodeResize(this.graphView, newSelection[0].entity as UniversalGraphNode), 100);
      } else if (newSelection.length === 1 && newSelection[0].type === GraphEntityType.Group) {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
        this.graphView.behaviors.add(BEHAVIOR_KEY, new ActiveGroupResize(this.graphView, newSelection[0].entity as NodeGroup), 100);
      } else {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
      }
    });
  }
}

/**
 * Holds the state of an active resize.
 */

export abstract class ActiveResize extends AbstractObjectHandleBehavior<DragHandle> {
  protected originalData: OriginalData | undefined;
  protected dragStartPosition: Point = {x: 0, y: 0};
  protected originalTarget: UniversalGraphNode | NodeGroup;

  protected readonly sideHandleMaker = (posX, posY, halfSize, execute) => ({
      execute,
      minX: posX - halfSize,
      minY: posY - halfSize,
      maxX: posX + halfSize,
      maxY: posY + halfSize,
      displayColor: BLACK_COLOR
    })

  constructor(graphView: CanvasGraphView,
              target: UniversalGraphNode | NodeGroup) {
    super(graphView, target);
    this.originalTarget = cloneDeep(this.target);
  }

  // TODO: Why this is here? Its not related to the handle, at least the usage
  isPointIntersectingNode(placedObject: PlacedObject, point: Point): boolean {
    // Consider ourselves still intersecting if we have a handle
    return (!!this.handle || !!this.getHandleIntersected(placedObject, point)) ? true : undefined;
  }

  protected activeDragStart(event: MouseEvent, graphPosition: Point, subject: GraphEntity | undefined) {
    this.originalData = {x: this.target.data.x, y: this.target.data.y, ...this.getCurrentNodeSize()};
    this.dragStartPosition = graphPosition;
  }

  protected getUniformScalingRatio(originalData, graphPosition, handleDiagonal) {
    const ratio = originalData.width / originalData.height;
    const sizingVecLen = Math.hypot(graphPosition.x - originalData.x, graphPosition.y - originalData.y) - handleDiagonal / 2;
    // const normY = Math.abs(sizingVecLen / Math.sqrt(ratio ** 2 + 1));
    return sizingVecLen;
  }

}

export class ActiveNodeResize extends ActiveResize {

  getHandleBoundingBoxes(placedNode: PlacedNode): DragHandle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = handleSize * noZoomScale;
    const halfSize = size / 2;
    const handleDiagonal = Math.sqrt(2) * size;
    const [x, y] = [(bbox.maxX + bbox.minX) / 2, (bbox.maxY + bbox.minY) / 2];

    // There is no handle on top: edge creation button is there.

    const handles = [
      // Right - one-dim scaling
      this.sideHandleMaker(
        bbox.maxX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          target.data.width = Math.abs(this.originalData.width + distance);
          target.data.x = this.originalData.x + distance / 2.0;
        }),
      // Left - one-dim scaling
      this.sideHandleMaker(
        bbox.minX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          target.data.width = Math.abs(this.originalData.width - distance);
          target.data.x = this.originalData.x + distance / 2.0;
        }),
      // Bottom - one-dim scaling
      this.sideHandleMaker(
        bbox.minX + (bbox.maxX - bbox.minX) / 2,
        bbox.maxY,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.y - this.dragStartPosition.y) * noZoomScale;
          target.data.height = Math.abs(this.originalData.height + distance);
          target.data.y = this.originalData.y + distance / 2.0;
        }),
      // Top left
    ];
    // If node (currently: images) can be scaled uniformly, add those handles.
    if (placedNode.uniformlyResizable) {
      const cornerHandleMaker = (posX, posY) => ({
        execute,
        minX: posX - halfSize,
        minY: posY - halfSize,
        maxX: posX + halfSize,
        maxY: posY + halfSize,
        displayColor: HANDLE_BLUE_COLOR
      });

      const execute = (target, originalData: OriginalData, dragStartPosition, graphPosition) => {
        const ratio = this.originalData.width / this.originalData.height;
        const sizingVecLen = Math.hypot(graphPosition.x - x, graphPosition.y - y) - handleDiagonal / 2;
        const normY = Math.abs(sizingVecLen / Math.sqrt(ratio ** 2 + 1));
        target.data.width = 2 * normY * ratio;
        target.data.height = 2 * normY;
      };


      handles.push(
        cornerHandleMaker(bbox.minX, bbox.minY), // Top left
        cornerHandleMaker(bbox.minX, bbox.maxY), // Bottom left
        cornerHandleMaker(bbox.maxX, bbox.maxY), // Bottom right
        cornerHandleMaker(bbox.maxX, bbox.minY), // Top right
      );
    }
    return handles;
  }


  protected activeDrag(event: MouseEvent, graphPosition: Point) {
    this.handle.execute(this.target, this.originalData, this.dragStartPosition, graphPosition);
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

}

// TODO: Update the width parameters of all the nodes so they would not be recalculated?
// TODO: Update Actions that allow rollbacks
export class ActiveGroupResize extends ActiveResize {
  private originalGroup: NodeGroup;
  private targetGroup: NodeGroup;

  constructor(graphView: CanvasGraphView,
              target: UniversalGraphNode | NodeGroup) {
    super(graphView, target);
    this.originalGroup = cloneDeep(this.target) as NodeGroup;
    this.targetGroup = this.target as NodeGroup;
  }

  getHandleBoundingBoxes(placedGroup: PlacedGroup): DragHandle[] {
    const bbox = placedGroup.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = handleSize * noZoomScale;
    const halfSize = size / 2;
    const handleDiagonal = Math.sqrt(2) * size;
    const [x, y] = [(bbox.maxX + bbox.minX) / 2, (bbox.maxY + bbox.minY) / 2];

    const handles = [
      // Right - one-dim scaling
      this.sideHandleMaker(
        bbox.maxX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          this.targetGroup.data.width = Math.abs(this.originalGroup.data.width + distance);
          this.targetGroup.data.x = this.originalGroup.data.x + distance / 2.0;
          for (let i = 0; i < this.targetGroup.members.length; i++) {
            this.targetGroup.members[i].data.width = Math.abs((this.originalGroup.members[i].data.width ||
              this.getNodeSize(this.originalGroup.members[i]).width) + distance);
            this.targetGroup.members[i].data.x = this.originalGroup.members[i].data.x + distance / 2.0;
          }

        }),
      // Left - one-dim scaling
      this.sideHandleMaker(
        bbox.minX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          this.targetGroup.data.width = Math.abs(this.originalGroup.data.width - distance);
          this.targetGroup.data.x = this.originalGroup.data.x + distance / 2.0;
          for (let i = 0; i < this.targetGroup.members.length; i++) {
            this.targetGroup.members[i].data.width = Math.abs((this.originalGroup.members[i].data.width ||
              this.getNodeSize(this.originalGroup.members[i]).width) - distance);
            this.targetGroup.members[i].data.x = this.originalGroup.members[i].data.x + distance / 2.0;
          }

        }),
      // Bottom - one-dim scaling
      this.sideHandleMaker(
        bbox.minX + (bbox.maxX - bbox.minX) / 2,
        bbox.maxY,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.y - this.dragStartPosition.y) * noZoomScale;
          this.targetGroup.data.height = Math.abs(this.originalGroup.data.height + distance);
          this.targetGroup.data.y = this.originalGroup.data.y + distance / 2.0;
          for (let i = 0; i < this.targetGroup.members.length; i++) {
            this.targetGroup.members[i].data.height = Math.abs((this.originalGroup.members[i].data.height ||
              this.getNodeSize(this.originalGroup.members[i]).height) + distance);
            this.targetGroup.members[i].data.y = this.originalGroup.members[i].data.y + distance / 2.0;
          }
        }),
      // Top - one-dim scaling
      this.sideHandleMaker(
        bbox.minX + (bbox.maxX - bbox.minX) / 2,
        bbox.minY,
        halfSize,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.y - this.dragStartPosition.y) * noZoomScale;
          this.targetGroup.data.height = Math.abs(this.originalGroup.data.height - distance);
          this.targetGroup.data.y = this.originalGroup.data.y + distance / 2.0;
          for (let i = 0; i < this.targetGroup.members.length; i++) {
            this.targetGroup.members[i].data.height = Math.abs((this.originalGroup.members[i].data.height ||
              this.getNodeSize(this.originalGroup.members[i]).height) - distance);
            this.targetGroup.members[i].data.y = this.originalGroup.members[i].data.y + distance / 2.0;
          }
        }),
    ];
    const cornerHandleMaker = (posX, posY) => ({
      execute,
      minX: posX - halfSize,
      minY: posY - halfSize,
      maxX: posX + halfSize,
      maxY: posY + halfSize,
      displayColor: HANDLE_BLUE_COLOR
    });

    const execute = (target, originalData: OriginalData, dragStartPosition, graphPosition) => {
      const ratio = originalData.width / originalData.height;
      const sizingVecLen = Math.hypot(graphPosition.x - originalData.x, graphPosition.y - originalData.y) - handleDiagonal / 2;
      const normY = Math.abs(sizingVecLen / Math.sqrt(ratio ** 2 + 1));

      target.data.width = 2 * normY * ratio;
      target.data.height = 2 * normY;
      const finalRatio = target.data.height / originalData.height;
      for (let i = 0; i < this.originalGroup.members.length; i++) {
        const xOriginDistance = Math.abs(originalData.x - this.originalGroup.members[i].data.x);
        const yOriginDistance = Math.abs(originalData.y - this.originalGroup.members[i].data.y);


        const xDirection = this.originalGroup.members[i].data.x > this.originalGroup.data.x ? 1 : -1;
        const yDirection = this.originalGroup.members[i].data.y > this.originalGroup.data.y ? 1 : -1;
        const baseWidth = this.originalGroup.members[i].data.width || this.getNodeSize(this.originalGroup.members[i]).width;
        const baseHeight = this.originalGroup.members[i].data.height || this.getNodeSize(this.originalGroup.members[i]).height;
        this.targetGroup.members[i].data.width = Math.abs(baseWidth * finalRatio);
        this.targetGroup.members[i].data.height = Math.abs(baseHeight * finalRatio);
        this.targetGroup.members[i].data.x = this.originalGroup.members[i].data.x +
          (xOriginDistance * finalRatio - xOriginDistance ) * xDirection;
        this.targetGroup.members[i].data.y = this.originalGroup.members[i].data.y +
          (yOriginDistance * finalRatio - yOriginDistance ) * yDirection;

      }
    };

    handles.push(
      cornerHandleMaker(bbox.minX, bbox.minY), // Top left
      cornerHandleMaker(bbox.minX, bbox.maxY), // Bottom left
      cornerHandleMaker(bbox.maxX, bbox.maxY), // Bottom right
      cornerHandleMaker(bbox.maxX, bbox.minY), // Top right
    );
    return handles;
  }

  protected activeDrag(event: MouseEvent, graphPosition: Point) {
    this.handle.execute(this.target, this.originalData, this.dragStartPosition, graphPosition);
    this.graphView.invalidateGroup(this.target as NodeGroup);
    this.graphView.requestRender();
  }


  protected activeDragEnd(event: MouseEvent) {
    this.graphView.execute(new GraphEntityUpdate('Resize Group', {
      type: GraphEntityType.Group,
      entity: this.target,
    }, {
      members: this.targetGroup.members,
    } as Partial<UniversalGraphNode>, {
      members: this.originalGroup.members,
    } as Partial<UniversalGraphNode>));
    this.originalTarget = cloneDeep(this.target);
  }

}

interface DragHandle extends Handle {
  execute: (target: UniversalGraphNode,
            originalData: OriginalData,
            dragStartPosition: Point,
            graphPosition: Point) => void;
}

interface OriginalData {
  width: number;
  height: number;
  x: number;
  y: number;
}

export const handleSize = 10;
