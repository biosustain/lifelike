import { GraphEntityType, GraphGroup, GraphNode } from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new group addition to the graph.
 */
export class GroupCreation implements GraphAction {
  constructor(public description: string,
              public group: GraphGroup,
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
 * Represents the deletion of a group.
 */
export class GroupDeletion implements GraphAction {
  constructor(public description: string,
              public group: GraphGroup) {
  }

  apply(component: GraphActionReceiver) {
    component.removeGroup(this.group);
  }

  rollback(component: GraphActionReceiver) {
    component.addGroup(this.group);
  }
}

/**
 * Represents the addition of a new member(s) to the group.
 */
export class GroupExtension implements GraphAction {
  constructor(public description: string,
              public group: GraphGroup,
              public newMembers: GraphNode[]) {
  }

  apply(component: GraphActionReceiver) {
    component.addToGroup(this.newMembers, this.group);
  }

  rollback(component: GraphActionReceiver) {
    component.removeFromGroup(this.newMembers, this.group);
  }
}


