import { GraphAction, GraphActionReceiver } from './actions';
import { GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from '../../drawing-tool/services/interfaces';

/**
 * Represents a new edge addition to the graph.
 */
export class EdgeCreation implements GraphAction {
  constructor(public description: string,
              public edge: UniversalGraphEdge,
              public readonly select = false) {
  }

  apply(component: GraphActionReceiver) {
    component.addEdge(this.edge);
    if (this.select) {
      component.selection.replace([{
        type: GraphEntityType.Edge,
        entity: this.edge,
      }]);
    }
  }

  rollback(component: GraphActionReceiver) {
    component.removeEdge(this.edge);
  }
}
