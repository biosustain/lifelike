import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new node addition to the graph.
 */
export class NodeCreation implements GraphAction {
  constructor(public description: string,
              public node: UniversalGraphNode) {
  }

  apply(component: GraphActionReceiver) {
    component.addNode(this.node);
  }

  rollback(component: GraphActionReceiver) {
    component.removeNode(this.node);
  }
}

/**
 * Represents the deletion of a node.
 */
export class NodeDeletion implements GraphAction {
  constructor(public description: string,
              public node: UniversalGraphNode) {
  }

  apply(component: GraphActionReceiver) {
    component.removeNode(this.node);
  }

  rollback(component: GraphActionReceiver) {
    component.addNode(this.node);
  }
}

/**
 * Represents the movement of a node.
 */
export class NodeMove implements GraphAction {
  previousX: number;
  previousY: number;

  constructor(public description: string,
              public node: UniversalGraphNode,
              public nextX: number,
              public nextY: number) {
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
