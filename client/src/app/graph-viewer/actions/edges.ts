import { GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

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
      component.focusEditorPanel();
    }
  }

  rollback(component: GraphActionReceiver) {
    component.removeEdge(this.edge);
  }
}
