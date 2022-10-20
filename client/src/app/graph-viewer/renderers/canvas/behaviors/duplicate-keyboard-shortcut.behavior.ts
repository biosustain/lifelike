import { partition, groupBy, mapValues, map, uniq, uniqBy } from 'lodash-es';

import { GraphEntityType, UniversalGraphEdge, UniversalGraphGroup, UniversalGraphNode, } from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { isCtrlOrMetaPressed } from 'app/shared/DOMutils';
import { uuidv4 } from 'app/shared/utils/identifiers';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { NodeCreation } from '../../../actions/nodes';
import { EdgeCreation } from '../../../actions/edges';
import { GroupCreation } from '../../../actions/groups';


export class DuplicateKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  // TODO: Test that
  private DEFAULT_OFFSET = 50;

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    if (event.event.key === 'd' && isCtrlOrMetaPressed(event.event)) {
      const actions: GraphAction[] = [];
      const selection = this.graphView.selection.get();
      if (selection.length === 0) {
        // TODO: Maybe we want t just terminate early instead pf continuing the behaviour
        return BehaviorResult.Continue;
      }
      const {
        [GraphEntityType.Edge]: edges = [] as UniversalGraphEdge[],
        [GraphEntityType.Node]: nodes = [] as UniversalGraphNode[],
        [GraphEntityType.Group]: groups = [] as UniversalGraphGroup[]
      } = mapValues(groupBy(selection, 'type'), g => map(g, 'entity'));
      const hashMap = new Map<string, string>();

      const cloneNode = ({hash, data, ...rest}) => {
        const newNode = {
          ...rest,
          hash: uuidv4(),
          data: {
            ...data,
            x: data.x + this.DEFAULT_OFFSET,
            y: data.y + this.DEFAULT_OFFSET,
          }
        } as UniversalGraphNode;
        hashMap.set(hash, newNode.hash);
        actions.push(new NodeCreation('Duplicate node', newNode, nodes.length === 1));
        return newNode;
      };

      for (const {hash, data, members, ...rest} of groups) {
        const newGroup = {
          ...rest,
          hash: uuidv4(),
          data: {
            ...data,
            x: data.x + this.DEFAULT_OFFSET,
            y: data.y + this.DEFAULT_OFFSET,
          },
          members: members.map(node => cloneNode(node))
        } as UniversalGraphGroup;
        // This works also for groups, as those inherit from the node
        hashMap.set(hash, newGroup.hash);
        actions.push(new GroupCreation('Duplicate group', newGroup, groups.length === 1));
      }
      for (const node of nodes) {
        if (!hashMap.has(node.hash)) {
          cloneNode(node);
        }
      }
      for (const {from, to, ...rest} of this.graphView.edges) {
        // Copy only if both nodes are copied as well
        if (hashMap.has(from) && hashMap.has(to)) {
          actions.push(
            new EdgeCreation('Duplicate edge',
              {...rest, to: hashMap.get(to), from: hashMap.get(from)} as UniversalGraphEdge,
              edges.length === 1
            )
          );
        }
      }
      // Remove selection to prevent user from copying multiple nodes a couple of times
      this.graphView.selection.replace([]);
      this.graphView.execute(new CompoundAction('Duplicate selected entities', actions));
      event.event.preventDefault();
      event.event.stopPropagation();
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}
