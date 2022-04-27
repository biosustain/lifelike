import { cloneDeep } from 'lodash-es';
import * as d3 from 'd3';

import { GraphEntityType, UniversalGraphGroup, UniversalGraphNode, UniversalGraphNodelike } from 'app/drawing-tool/services/interfaces';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { isCtrlOrMetaPressed, isShiftPressed } from 'app/shared/DOMutils';
import { GROUP_LABEL } from 'app/shared/constants';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult, DragBehaviorEvent } from '../../behaviors';

export class MovableEntity extends AbstractCanvasBehavior {
  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  private target: UniversalGraphNodelike | undefined;
  private originalTarget: UniversalGraphNodelike | undefined;
  private startMousePosition: [number, number] = [0, 0];
  private originalNodelikePositions = new Map<UniversalGraphNodelike, [number, number]>();

  constructor(protected readonly graphView: CanvasGraphView) {
    super();
  }

  dragStart(event: DragBehaviorEvent): BehaviorResult {
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;
    const entity = event.entity;

    if (entity?.type === GraphEntityType.Node) {
      const node = entity.entity as UniversalGraphNode;

      this.startMousePosition = [transform.invertX(mouseX), transform.invertY(mouseY)];

      this.target = node;
      this.originalTarget = cloneDeep(this.target);
    } else if (entity?.type === GraphEntityType.Group) {
      const group = entity.entity as UniversalGraphGroup;

      this.startMousePosition = [transform.invertX(mouseX), transform.invertY(mouseY)];

      this.target = group;
      this.originalTarget = cloneDeep(this.target);
    }

    return BehaviorResult.Continue;
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    // TODO: cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;

    if (this.target) {
      const shiftX = transform.invertX(mouseX) - this.startMousePosition[0];
      const shiftY = transform.invertY(mouseY) - this.startMousePosition[1];

      const selectedNodes = new Set<UniversalGraphNodelike>();
      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          const node = entity.entity as UniversalGraphNode;
          selectedNodes.add(node);
        }
      }
      if (this.target.label === GROUP_LABEL) {
        const group = this.target as UniversalGraphGroup;
        selectedNodes.add(group);
        for (const n of group.members) {
          selectedNodes.add(n);
        }
      }

      // If the user is moving a node that isn't selected, then we either (a) want to
      // deselect everything, select just the target node, and then move only the target
      // node, or (b) if the user is holding down the multiple selection modifier key
      // (CTRL or CMD), then we add the target node to the selection and move the whole group
      // (c) it is a group, and we want to move only members
      if (!selectedNodes.has(this.target) && this.target.label !== GROUP_LABEL) {
        // Case (a)
        if (!isCtrlOrMetaPressed(event.event) && !isShiftPressed(event.event)) {
          selectedNodes.clear();
        }

        selectedNodes.add(this.target);

        // Update the selection
        this.graphView.selection.replace([...selectedNodes].map(node => ({
          type: GraphEntityType.Node,
          entity: node,
        })));
      }

      for (const node of selectedNodes) {
        if (!this.originalNodelikePositions.has(node)) {
          this.originalNodelikePositions.set(node, [node.data.x, node.data.y]);
        }
        const [originalX, originalY] = this.originalNodelikePositions.get(node);
        node.data.x = originalX + shiftX;
        node.data.y = originalY + shiftY;
        this.graphView.invalidateNodelike(node);
      }

      // if (this.target.label === GROUP_LABEL) {
      //
      //   const originalData = this.originalTarget.data;
      //   this.target.data.x = originalData.x + shiftX;
      //   this.target.data.y = originalData.y + shiftY;
      //   this.graphView.invalidateGroup(this.target as UniversalGraphGroup);
      // }
    }

    return BehaviorResult.Continue;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    if (this.target) {
      if (this.target.data.x !== this.originalTarget.data.x ||
          this.target.data.y !== this.originalTarget.data.y) {
        const actions: GraphAction[] = [];

        for (const [nodelike, [originalX, originalY]] of
            this.originalNodelikePositions.entries()) {
          actions.push(new GraphEntityUpdate('Move nodelike', {
            type: nodelike.label === GROUP_LABEL ? GraphEntityType.Group : GraphEntityType.Node,
            entity: nodelike,
          }, {
            data: {
              x: nodelike.data.x,
              y: nodelike.data.y,
            },
          } as Partial<UniversalGraphNodelike>, {
            data: {
              x: originalX,
              y: originalY,
            },
          } as Partial<UniversalGraphNodelike>));
        }

        // if (this.target.label === GROUP_LABEL) {
        //   actions.push(new GraphEntityUpdate('Group move', {
        //     type: GraphEntityType.Group,
        //     entity: this.target,
        //   }, {
        //     data: {
        //       x: this.target.data.x,
        //       y: this.target.data.y,
        //     },
        //   } as Partial<UniversalGraphGroup>, {
        //     data: {
        //       x: this.originalTarget.data.x,
        //       y: this.originalTarget.data.y,
        //     },
        //   } as Partial<UniversalGraphGroup>));
        // }


        this.graphView.execute(new CompoundAction('Node move', actions));

        this.target = null;
        this.originalNodelikePositions.clear();

        return BehaviorResult.Stop;
      } else {
        this.target = null;
        this.originalNodelikePositions.clear();

        return BehaviorResult.Continue;
      }
    } else {
      this.originalNodelikePositions.clear();

      return BehaviorResult.Continue;
    }
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
