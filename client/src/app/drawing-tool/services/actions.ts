/**
 * This file contains actions for the graph, such as adding or removing nodes,
 * which may be committed to history for rollback or re-application.
 */

import { GraphAction, GraphComponent, GraphEntity, UniversalGraphNode } from './interfaces';

/**
 * Represents a new node addition to the graph.
 */
export class NodeCreation implements GraphAction {
  constructor(public description: string,
              public node: UniversalGraphNode) {
  }

  apply(component: GraphComponent) {
    component.addNode(this.node);
  }

  rollback(component: GraphComponent) {
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

  apply(component: GraphComponent) {
    component.removeNode(this.node);
  }

  rollback(component: GraphComponent) {
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

  apply(component: GraphComponent) {
    this.node.data.x = this.nextX;
    this.node.data.y = this.nextY;
  }

  rollback(component: GraphComponent) {
    this.node.data.x = this.previousX;
    this.node.data.y = this.previousY;
  }
}

/**
 * Represents the movement of a node.
 */
export class GraphEntityUpdate implements GraphAction {
  constructor(public description: string,
              public entity: GraphEntity,
              public newData: object) {
  }

  apply(component: GraphComponent) {
    Object.assign(this.entity.entity, this.newData);
  }

  rollback(component: GraphComponent) {
  }
}
