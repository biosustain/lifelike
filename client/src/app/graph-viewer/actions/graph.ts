import { GraphEntity } from 'app/drawing-tool/services/interfaces';
import { GraphAction, GraphActionReceiver } from './actions';
import { mergeDeep } from '../utils/objects';

/**
 * Represents the movement of a node.
 */
export class GraphEntityUpdate implements GraphAction {
  constructor(public description: string,
              public entity: GraphEntity,
              public newData: object) {
  }

  apply(component: GraphActionReceiver) {
    mergeDeep(this.entity.entity, this.newData);
  }

  rollback(component: GraphActionReceiver) {
  }
}
