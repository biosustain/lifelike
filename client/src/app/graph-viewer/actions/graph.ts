import { merge } from "lodash-es";

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphGroup,
  UniversalGraphEdge,
  UniversalGraphNode,
} from "app/drawing-tool/services/interfaces";

import { GraphAction, GraphActionReceiver } from "./actions";

/**
 * Represents the movement of a node.
 */
export class GraphEntityUpdate implements GraphAction {
  constructor(
    public description: string,
    public entity: GraphEntity,
    public updatedData: object,
    public originalData: object
  ) {}

  apply(component: GraphActionReceiver) {
    merge(this.entity.entity, this.updatedData);
    this.matchAndUpdateEntity(component);
  }

  rollback(component: GraphActionReceiver) {
    merge(this.entity.entity, this.originalData);
    this.matchAndUpdateEntity(component);
  }

  private matchAndUpdateEntity(component: GraphActionReceiver) {
    if (this.entity.type === GraphEntityType.Node) {
      component.updateNode(this.entity.entity as UniversalGraphNode);
    } else if (this.entity.type === GraphEntityType.Edge) {
      component.updateEdge(this.entity.entity as UniversalGraphEdge);
    } else if (this.entity.type === GraphEntityType.Group) {
      component.updateGroup(this.entity.entity as UniversalGraphGroup);
    }
  }
}
