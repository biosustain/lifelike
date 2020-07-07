import { GraphAction, GraphActionReceiver } from './actions';
import { UniversalGraphEdge } from '../../drawing-tool/services/interfaces';

/**
 * Represents a new edge addition to the graph.
 */
export class EdgeCreation implements GraphAction {
  constructor(public description: string,
              public edge: UniversalGraphEdge) {
  }

  apply(component: GraphActionReceiver) {
    component.addEdge(this.edge);
  }

  rollback(component: GraphActionReceiver) {
    component.removeEdge(this.edge);
  }
}
