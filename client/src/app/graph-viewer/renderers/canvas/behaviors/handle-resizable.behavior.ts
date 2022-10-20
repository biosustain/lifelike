import { cloneDeep, zip } from 'lodash-es';
import { scaleLinear } from 'd3';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphGroup,
  UniversalGraphNode,
  UniversalGraphNodelike
} from 'app/drawing-tool/services/interfaces';
import { PlacedGroup, PlacedNode, PlacedObject } from 'app/graph-viewer/styles/styles';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { AbstractObjectHandleBehavior, Handle } from 'app/graph-viewer/utils/behaviors/abstract-object-handle-behavior';
import { BLACK_COLOR, HANDLE_BLUE_COLOR } from 'app/shared/constants';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior } from '../../behaviors';
import { CompoundAction, GraphAction } from '../../../actions/actions';
import { Point } from '../../../utils/canvas/shared';

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
        this.graphView.behaviors.add(BEHAVIOR_KEY,
          new ActiveGroupResize(this.graphView, newSelection[0].entity as UniversalGraphGroup), 100);
      } else {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
      }
    });
  }
}

/**
 * Holds the state of an active resize.
 */

export abstract class ActiveResize<Target extends UniversalGraphNodelike> extends AbstractObjectHandleBehavior<DragHandle, Target> {
  protected originalData: OriginalData | undefined;
  protected dragStartPosition: Point = {x: 0, y: 0};
  protected originalTarget: Target;

  constructor(graphView: CanvasGraphView,
              target: Target) {
    super(graphView, target);
    this.originalTarget = cloneDeep(this.target);
  }

  protected readonly sideHandleMaker = (posX, posY, halfSize, execute) => ({
    execute,
    minX: posX - halfSize,
    minY: posY - halfSize,
    maxX: posX + halfSize,
    maxY: posY + halfSize,
    displayColor: BLACK_COLOR
  })

  isPointIntersectingNodeHandles(placedObject: PlacedObject, point: Point): boolean {
    // Consider ourselves still intersecting if we have a handle
    return (!!this.handle || !!this.getHandleIntersected(placedObject, point)) ? true : undefined;
  }

  protected activeDragStart(event: MouseEvent, graphPosition: Point, subject: GraphEntity | undefined) {
    this.originalData = {x: this.target.data.x, y: this.target.data.y, ...this.getCurrentNodeSize()};
    this.dragStartPosition = graphPosition;
  }

  protected activeDrag(event: MouseEvent, graphPosition: Point) {
    this.handle.execute(this.target, this.originalData, this.dragStartPosition, graphPosition);
    this.graphView.invalidateNodelike(this.target);
    this.graphView.requestRender();
  }

}

export class ActiveNodeResize extends ActiveResize<UniversalGraphNode> {

  getHandleBoundingBoxes(placedNode: PlacedNode): DragHandle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = HANDLE_SIZE * noZoomScale;
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

const centric2edge = ([center, size]) => [center - size / 2, center + size / 2];
const edge2centric = ([edge0, edge1]) => [(edge0 + edge1) / 2, edge1 - edge0];

// TODO: Update the width parameters of all the nodes so they would not be recalculated?
export class ActiveGroupResize extends ActiveResize<UniversalGraphGroup> {

  getHandleBoundingBoxes(placedGroup: PlacedGroup): DragHandle[] {
    const bbox = placedGroup.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = HANDLE_SIZE * noZoomScale;
    const halfSize = size / 2;
    const handleDiagonal = Math.sqrt(2) * size;

    const scaleMemberFactory = (scale, originalTargetData, targetData, internalSize, centerAccessor, sizeAccessor) =>
      ([targetGroupMember, originalGroupMember]) => {
        const originalMemberSize = originalGroupMember.data[sizeAccessor] || this.getNodeSize(originalGroupMember)[sizeAccessor];
        const scalledEdges = centric2edge([originalGroupMember.data[centerAccessor], originalMemberSize])
          .map(scale) as [number, number];
        if (originalMemberSize < internalSize) {
          if (originalGroupMember.data[centerAccessor] < originalTargetData[centerAccessor]) {
            scalledEdges[1] = scalledEdges[0] + originalMemberSize;
          } else if (originalGroupMember.data[centerAccessor] > originalTargetData[centerAccessor]) {
            scalledEdges[0] = scalledEdges[1] - originalMemberSize;
          }
          // for originalGroupMember.data[centerAccessor] === this.originalTarget..data[centerAccessor]
          // we just scale without adjustment
          [targetGroupMember.data[centerAccessor], targetGroupMember.data[sizeAccessor]] = edge2centric(scalledEdges);
        } else {
          [targetGroupMember.data[centerAccessor], targetGroupMember.data[sizeAccessor]] = [targetData[centerAccessor], internalSize];
        }
      };

    const handleExecuteFactory = (edge2grab: 0 | 1, centerAccessor: 'x' | 'y', sizeAccessor: 'width' | 'height') =>
      (target, originalData, dragStartPosition, graphPosition) => {
        const {
          originalTarget: {data: originalTargetData},
          target: {data: targetData, margin}
        } = this;
        const distance = (graphPosition[centerAccessor] - this.dragStartPosition[centerAccessor]) * noZoomScale;
        const orgEdges = centric2edge([originalTargetData[centerAccessor], originalTargetData[sizeAccessor]]);
        const scale = scaleLinear()
          .domain(orgEdges)
          .range(
            orgEdges
              .map((edge, index) => edge + (index === edge2grab ? distance : 0))
              .sort((a, b) => a - b)  // if we pull it past the box start we do not want to reverse scale
          )
          .clamp(true);
        [targetData[centerAccessor], targetData[sizeAccessor]] = edge2centric(orgEdges.map(scale) as [number, number]);
        zip(this.target.members, this.originalTarget.members)
          .forEach(
            scaleMemberFactory(scale, originalTargetData, targetData, targetData[sizeAccessor] - margin * 2, centerAccessor, sizeAccessor)
          );
      };

    const handles = [
      // Right - one-dim scaling
      this.sideHandleMaker(
        bbox.maxX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        handleExecuteFactory(1, 'x', 'width')
      ),
      // Left - one-dim scaling
      this.sideHandleMaker(
        bbox.minX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        halfSize,
        handleExecuteFactory(0, 'x', 'width')
      ),
      // Bottom - one-dim scaling
      this.sideHandleMaker(
        bbox.minX + (bbox.maxX - bbox.minX) / 2,
        bbox.maxY,
        halfSize,
        handleExecuteFactory(1, 'y', 'height')
      ),
      // There is no top one since the interactive edge creation button takes its place
    ];

    const execute = (target, originalData: OriginalData, dragStartPosition, graphPosition) => {
      const ratio = originalData.width / originalData.height;
      const sizingVecLen = Math.hypot(graphPosition.x - originalData.x, graphPosition.y - originalData.y) - handleDiagonal / 2;
      const normY = Math.abs(sizingVecLen / Math.sqrt(ratio ** 2 + 1));

      target.data.height = 2 * normY;
      const orgYEdges = centric2edge([originalData.y, originalData.height]);
      const targetYEdges = centric2edge([target.data.y, target.data.height]);
      const scaleY = scaleLinear()
        .domain(orgYEdges)
        .range(targetYEdges)
        .clamp(true);

      target.data.width = 2 * normY * ratio;
      const orgXEdges = centric2edge([originalData.x, originalData.width]);
      const targetXEdges = centric2edge([target.data.x, target.data.width]);
      const scaleX = scaleLinear()
        .domain(orgXEdges)
        .range(targetXEdges)
        .clamp(true);

      const scaleXMember = scaleMemberFactory(scaleX, originalData, target.data, target.data.width - target.margin * 2, 'x', 'width');
      const scaleYMember = scaleMemberFactory(scaleY, originalData, target.data, target.data.height - target.margin * 2, 'y', 'height');
      zip(this.target.members, this.originalTarget.members)
        .forEach(d => {
          scaleXMember(d);
          scaleYMember(d);
        });
    };

    const cornerHandleMaker = (posX, posY) => ({
      execute,
      minX: posX - halfSize,
      minY: posY - halfSize,
      maxX: posX + halfSize,
      maxY: posY + halfSize,
      displayColor: HANDLE_BLUE_COLOR
    });

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
    this.graphView.invalidateGroup(this.target as UniversalGraphGroup);
    this.graphView.requestRender();
  }

  /**
   * Once active drag is ended, update group and members in bulk.
   * We spread entire data entry here as x and y parameters are affected as well
   * @param event - event information. Not used.
   * @protected
   */
  protected activeDragEnd(event: MouseEvent) {
    const actions: GraphAction[] = [];

    zip(this.originalTarget.members, this.target.members)
      .forEach(([originalGroupMember, targetGroupMember]) => {
        actions.push(new GraphEntityUpdate('Node resize from group resize', {
          type: GraphEntityType.Node,
          entity: targetGroupMember,
        }, {
          data: {
            ...targetGroupMember.data
          },
        } as Partial<UniversalGraphNode>, {
          data: {
            // TODO: This is not really that precise - the groups are larger. Fix that.
            ...this.getNodeSize(originalGroupMember),
            ...originalGroupMember.data,
          },
        } as Partial<UniversalGraphNode>));
      });

    actions.push(new GraphEntityUpdate('Group resize', {
      type: GraphEntityType.Group,
      entity: this.target,
    }, {
      data: {
        ...this.target.data
      },
    } as Partial<UniversalGraphGroup>, {
      data: {
        ...this.originalTarget.data
      },
    } as Partial<UniversalGraphGroup>));

    this.graphView.execute(new CompoundAction('Group resize', actions));
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

export const HANDLE_SIZE = 10;
