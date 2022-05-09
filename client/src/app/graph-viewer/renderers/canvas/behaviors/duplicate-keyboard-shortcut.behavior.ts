import { partition } from 'lodash-es';

import { GraphEntityType, UniversalGraphEdge, UniversalGraphNode, } from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { isCtrlOrMetaPressed } from 'app/shared/DOMutils';
import { uuidv4 } from 'app/shared/utils/identifiers';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { NodeCreation } from '../../../actions/nodes';
import { EdgeCreation } from '../../../actions/edges';


export class DuplicateKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  // TODO: Test that
  private DEFAULT_OFFSET = 50;
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  // TODO: This is developed parallel to the groups - it can go into master before them
  // TODO: so it is required to adjust that on groups PR as well
  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    if (event.event.key === 'd' && isCtrlOrMetaPressed(event.event)) {
      const actions: GraphAction[] = [];
      const selection = this.graphView.selection.get();
      if (selection.length === 0) {
        // TODO: Maybe we want t just terminate early instead pf continuing the behaviour
        return BehaviorResult.Continue;
      }
      const [edges, otherEntities] = partition(selection, entity => {
        return entity.type === GraphEntityType.Edge;
      });
      // Select if there is only one entity copied
      const shouldSelect = selection.length === 1;
      const hashMap = new Map<string, string>();
      for (const entity of otherEntities) {
        const node = entity.entity as UniversalGraphNode;
        const newHash = uuidv4();
        // This works also for groups, as those inherit from the node
        hashMap.set(node.hash, newHash);
        const entityData = node.data;
        actions.push(new NodeCreation('Duplicate node',
          {
            ...node,
            hash: newHash,
            data: {
              ...entityData,
              x: entityData.x + this.DEFAULT_OFFSET,
              y: entityData.y + this.DEFAULT_OFFSET,
            }
          } as UniversalGraphNode,
          shouldSelect));
      }
      for (const entity of edges) {
        const edge = entity.entity as UniversalGraphEdge;
        // Copy only if both nodes are copied as well
        if (hashMap.has(edge.from) && hashMap.has(edge.to)) {
          actions.push(new EdgeCreation('Duplicate edge',
          {
            ...edge,
            to: hashMap.get(edge.to),
            from: hashMap.get(edge.from),
          } as UniversalGraphEdge,
            shouldSelect));
        }
      }
      // Remove selection to prevent user from copying multiple nodes a couple of times
      this.graphView.selection.replace([]);
      this.graphView.execute(new CompoundAction('Duplicate selected entities', actions));
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}
