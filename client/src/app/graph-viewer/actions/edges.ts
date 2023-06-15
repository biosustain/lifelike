import { GraphEntityType, UniversalGraphEdge } from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new edge addition to the graph.
 */
export class EdgeCreation implements GraphAction {
  constructor(
    public description: string,
    public edge: UniversalGraphEdge,
    public readonly select = false
  ) {}

  apply(component: GraphActionReceiver) {
    component.addEdge(this.edge);
    if (this.select) {
      component.selection.add([
        {
          type: GraphEntityType.Edge,
          entity: this.edge,
        },
      ]);
    }
  }

  rollback(component: GraphActionReceiver) {
    component.removeEdge(this.edge);
  }
}

/**
 * Represents the deletion of a edge.
 */
export class EdgeDeletion implements GraphAction {
  constructor(public description: string, public edge: UniversalGraphEdge) {}

  apply(component: GraphActionReceiver) {
    component.removeEdge(this.edge);
  }

  rollback(component: GraphActionReceiver) {
    component.addEdge(this.edge);
  }
}
