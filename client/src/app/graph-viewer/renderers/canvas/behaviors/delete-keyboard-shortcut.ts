import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from '../../../../drawing-tool/services/interfaces';
import { EdgeDeletion, NodeDeletion } from '../../../actions/nodes';

/**
 * Implements the 'delete' key.
 */
export class DeleteKeyboardShortcut extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    if (event.key === 'Delete') {
      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          this.graphView.execute(new NodeDeletion('Delete node', entity.entity as UniversalGraphNode));
        } else if (entity.type === GraphEntityType.Edge) {
          this.graphView.execute(new EdgeDeletion('Delete edge', entity.entity as UniversalGraphEdge));
        }
      }
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}
