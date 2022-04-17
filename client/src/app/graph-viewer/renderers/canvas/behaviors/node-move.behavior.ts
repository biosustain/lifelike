import { cloneDeep } from 'lodash-es';
import * as d3 from 'd3';

import { GraphEntityType, NodeGroup, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { isCtrlOrMetaPressed, isShiftPressed } from 'app/shared/DOMutils';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult, DragBehaviorEvent } from '../../behaviors';

export class MovableNode extends AbstractCanvasBehavior {
  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  private target: UniversalGraphNode | NodeGroup | undefined;
  private originalTarget: UniversalGraphNode | NodeGroup | undefined;
  private startMousePosition: [number, number] = [0, 0];
  private originalNodePositions = new Map<UniversalGraphNode, [number, number]>();

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
      const group = entity.entity as NodeGroup;

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

      const selectedNodes = new Set<UniversalGraphNode | NodeGroup>();
      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          const node = entity.entity as UniversalGraphNode;
          selectedNodes.add(node);
        } else if (entity.type === GraphEntityType.Group) {
          // const node = entity.entity as UniversalGraphNode;
          const group = entity.entity as NodeGroup;
          // selectedNodes.add(entity.entity as UniversalGraphNode);
          for (const n of group.members) {
            selectedNodes.add(n);
          }
        }
      }
      if (this.target.label === 'group') {
        const group = this.target as NodeGroup;
        for (const n of group.members) {
        selectedNodes.add(n);
        }
      }

      // If the user is moving a node that isn't selected, then we either (a) want to
      // deselect everything, select just the target node, and then move only the target
      // node, or (b) if the user is holding down the multiple selection modifier key
      // (CTRL or CMD), then we add the target node to the selection and move the whole group
      // (c) it is a group, and we want to move only members
      if (!selectedNodes.has(this.target) && this.target.label !== 'group') {
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
        if (!this.originalNodePositions.has(node)) {
          this.originalNodePositions.set(node, [node.data.x, node.data.y]);
        }
        const [originalX, originalY] = this.originalNodePositions.get(node);
        node.data.x = originalX + shiftX;
        node.data.y = originalY + shiftY;
        // this.graphView.nodePositionOverrideMap.set(node, [node.data.x, node.data.y]);
        this.graphView.invalidateNode(node);
        // TODO: Store this in history as ONE object
      }

      if (this.target.label === 'group') {

        const originalData = this.originalTarget.data;
        this.target.data.x = originalData.x + shiftX;
        this.target.data.y = originalData.y + shiftY;
        // this.graphView.nodePositionOverrideMap.set(node, [node.data.x, node.data.y]);
        this.graphView.invalidateGroup(this.target as NodeGroup);
      }
    }

    return BehaviorResult.Continue;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    if (this.target) {
      if (this.target.data.x !== this.originalTarget.data.x ||
          this.target.data.y !== this.originalTarget.data.y) {
        const actions: GraphAction[] = [];

        for (const [node, [originalX, originalY]] of
            this.originalNodePositions.entries()) {
          actions.push(new GraphEntityUpdate('Move node', {
            type: GraphEntityType.Node,
            entity: node,
          }, {
            data: {
              x: node.data.x,
              y: node.data.y,
            },
          } as Partial<UniversalGraphNode>, {
            data: {
              x: originalX,
              y: originalY,
            },
          } as Partial<UniversalGraphNode>));
        }

        if (this.target.label === 'group') {
          actions.push(new GraphEntityUpdate('Group move', {
            type: GraphEntityType.Group,
            entity: this.target,
          }, {
            data: {
              x: this.target.data.x,
              y: this.target.data.y,
            },
          } as Partial<NodeGroup>, {
            data: {
              x: this.originalTarget.data.x,
              y: this.originalTarget.data.y,
            },
          } as Partial<NodeGroup>));
        }


        this.graphView.execute(new CompoundAction('Node move', actions));

        this.target = null;
        this.originalNodePositions.clear();

        return BehaviorResult.Stop;
      } else {
        this.target = null;
        this.originalNodePositions.clear();

        return BehaviorResult.Continue;
      }
    } else {
      this.originalNodePositions.clear();

      return BehaviorResult.Continue;
    }
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
