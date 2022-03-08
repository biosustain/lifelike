import { GraphEntityType, NodeGroup } from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new edge addition to the graph.
 */
export class GroupCreation implements GraphAction {
  constructor(public description: string,
              public group: NodeGroup,
              public readonly select = false) {
  }
  apply(component: GraphActionReceiver) {
    component.addGroup(this.group);
    if (this.select) {
      component.selection.replace([{
        type: GraphEntityType.Group,
        entity: this.group,
      }]);
      component.focusEditorPanel();
    }
  }
  rollback(component: GraphActionReceiver) {
    component.removeGroup(this.group);
  }
}

/**
 * Represents the deletion of a edge.
 */
export class GroupDeletion implements GraphAction {
  constructor(public description: string,
              public group: NodeGroup) {
  }

  apply(component: GraphActionReceiver) {
    component.removeGroup(this.group);
  }

  rollback(component: GraphActionReceiver) {
    component.addGroup(this.group);
  }
}


