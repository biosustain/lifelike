import {
  GraphEntityType,
  UniversalGraphGroup,
  UniversalGraphEdge,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new node addition to the graph.
 */
export class NodeCreation implements GraphAction {
  constructor(
    public readonly description: string,
    public readonly node: UniversalGraphNode,
    public readonly select = false,
    public readonly focus = false
  ) {}

  apply(component: GraphActionReceiver) {
    component.addNode(this.node);
    if (this.select) {
      component.selection.add([
        {
          type: GraphEntityType.Node,
          entity: this.node,
        },
      ]);
    }
    if (this.focus) {
      component.focusEditorPanel();
    }
  }

  rollback(component: GraphActionReceiver) {
    component.removeNode(this.node);
  }
}

/**
 * Represents the deletion of a node.
 */
export class NodeDeletion implements GraphAction {
  private removedEdges: UniversalGraphEdge[];

  constructor(public description: string, public node: UniversalGraphNode) {}

  apply(component: GraphActionReceiver) {
    if (this.removedEdges != null) {
      throw new Error('cannot double apply NodeDeletion()');
    }
    const { removedEdges } = component.removeNode(this.node);
    this.removedEdges = removedEdges;
  }

  rollback(component: GraphActionReceiver) {
    if (this.removedEdges == null) {
      throw new Error('cannot rollback NodeDeletion() if not applied');
    }
    component.addNode(this.node);
    for (const edge of this.removedEdges) {
      component.addEdge(edge);
    }
    this.removedEdges = null;
  }
}

/**
 * Represents the movement of a node.
 */
export class NodeMove implements GraphAction {
  previousX: number;
  previousY: number;

  constructor(
    public description: string,
    public node: UniversalGraphNode,
    public nextX: number,
    public nextY: number
  ) {
    this.previousX = node.data.x;
    this.previousY = node.data.y;
  }

  apply(component: GraphActionReceiver) {
    this.node.data.x = this.nextX;
    this.node.data.y = this.nextY;
  }

  rollback(component: GraphActionReceiver) {
    this.node.data.x = this.previousX;
    this.node.data.y = this.previousY;
  }
}

/**
 * Used to handle adding of the node(s) into the group
 */
export class NodesGroupAdd implements GraphAction {
  constructor(
    public description: string,
    public nodes: UniversalGraphNode[],
    public group: UniversalGraphGroup
  ) {}

  apply(component: GraphActionReceiver): void {
    component.addToGroup(this.nodes, this.group);
  }

  rollback(component: GraphActionReceiver): void {
    component.removeFromGroup(this.nodes, this.group);
  }
}

/**
 * Used to handle removal of the node(s) from the group
 */
export class NodesGroupRemoval implements GraphAction {
  constructor(
    public description: string,
    public nodes: UniversalGraphNode[],
    public group: UniversalGraphGroup
  ) {}

  apply(component: GraphActionReceiver): void {
    component.removeFromGroup(this.nodes, this.group);
  }

  rollback(component: GraphActionReceiver): void {
    component.addToGroup(this.nodes, this.group);
  }
}
