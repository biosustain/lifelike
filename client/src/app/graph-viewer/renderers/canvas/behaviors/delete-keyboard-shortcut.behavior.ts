import { GraphEntityType, UniversalGraphGroup, UniversalGraphEdge, UniversalGraphNode, } from 'app/drawing-tool/services/interfaces';
import { EdgeDeletion } from 'app/graph-viewer/actions/edges';
import { NodeDeletion, NodesGroupRemoval } from 'app/graph-viewer/actions/nodes';
import { GraphAction } from 'app/graph-viewer/actions/actions';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { GroupDeletion } from '../../../actions/groups';


/**
 * Implements the 'delete' key.
 */
export class DeleteKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    if (event.event.key === 'Delete') {
      const actions0: GraphAction[] = [];
      const actions1: GraphAction[] = [];
      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          const node = entity.entity as UniversalGraphNode;
          const group = this.graphView.getNodeGroup(node);
          if (group) {
            actions1.push(new NodesGroupRemoval('Delete node and remove group',
              [node],
              group));
          }
          actions1.push(new NodeDeletion('Delete node', node));
        } else if (entity.type === GraphEntityType.Edge) {
          actions0.push(new EdgeDeletion('Delete edge', entity.entity as UniversalGraphEdge));
        } else if (entity.type === GraphEntityType.Group) {
          actions0.push(new GroupDeletion('Delete group', entity.entity as UniversalGraphGroup));
        }
      }
      this.graphView.execute(...actions0);
      this.graphView.execute(...actions1);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}
