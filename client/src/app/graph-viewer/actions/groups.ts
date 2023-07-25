import {
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphGroup,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents a new group addition to the graph.
 */
export class GroupCreation implements GraphAction {
  constructor(
    public description: string,
    public group: UniversalGraphGroup,
    public readonly select = false,
    public readonly focus = false
  ) {}
  apply(component: GraphActionReceiver) {
    component.addGroup(this.group);
    if (this.select) {
      component.selection.add([
        {
          type: GraphEntityType.Group,
          entity: this.group,
        },
      ]);
    }
    if (this.focus) {
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
  private removedEdges: UniversalGraphEdge[];

  constructor(public description: string, public group: UniversalGraphGroup) {}

  apply(component: GraphActionReceiver) {
    if (this.removedEdges != null) {
      throw new Error('cannot double apply GroupDeletion()');
    }
    const { removedEdges } = component.removeGroup(this.group);
    this.removedEdges = removedEdges;
  }

  rollback(component: GraphActionReceiver) {
    if (this.removedEdges == null) {
      throw new Error('cannot rollback NodeDeletion() if not applied');
    }
    component.addGroup(this.group);
    for (const edge of this.removedEdges) {
      component.addEdge(edge);
    }
    this.removedEdges = null;
  }
}

/**
 * Represents the addition of a new member(s) to the group.
 */
export class GroupExtension implements GraphAction {
  constructor(
    public description: string,
    public group: UniversalGraphGroup,
    public newMembers: UniversalGraphNode[]
  ) {}

  apply(component: GraphActionReceiver) {
    component.addToGroup(this.newMembers, this.group);
  }

  rollback(component: GraphActionReceiver) {
    component.removeFromGroup(this.newMembers, this.group);
  }
}
