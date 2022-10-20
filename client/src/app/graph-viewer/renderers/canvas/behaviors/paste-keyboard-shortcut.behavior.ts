import { mapValues, groupBy, map, chain } from 'lodash-es';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
  UniversalGraphGroup,
  UniversalGraphEdge,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { uuidv4 } from 'app/shared/utils/identifiers';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { GroupCreation } from '../../../actions/groups';
import { EdgeCreation } from '../../../actions/edges';

/**
 * We use this string to know that it's our own JSON.
 */
export const TYPE_STRING = 'LifelikeKnowledgeMap/1';

export interface GraphClipboardData {
  type: 'LifelikeKnowledgeMap/1';
  selection: GraphEntity[];
}

/**
 * Implements the paste key.
 */
export class PasteKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  // TODO: fix boundPaste if not coming in next patch
  constructor(private readonly graphView: CanvasGraphView,
              protected readonly dataTransferDataService: DataTransferDataService) {
    super();
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const content = event.event.clipboardData.getData('text/plain');
      if (content) {
        this.graphView.execute(this.createActionFromPasteContent(content, position));
        event.event.preventDefault();
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }

  /**
   * Returns a node creation action based on the content provided.
   * @param content the content (like from the clipboard)
   * @param position the position of the node
   */
  private createActionFromPasteContent(content: string, position: { x: number, y: number }): GraphAction {
    try {
      const actions: GraphAction[] = [];
      const {type, selection}: GraphClipboardData = JSON.parse(content);

      // First try to read the data as JSON
      if (type === TYPE_STRING) {
        const centerOfMass = chain(selection)
          .filter(s => s.type !== GraphEntityType.Edge)
          .flatMap(({entity}) => ((entity as UniversalGraphGroup).members ?? [entity]) as UniversalGraphNode[])
          .reduce(
            (prev, {data: {x = 0, y = 0}}) => ({
                x: prev.x + x,
                y: prev.y + y,
                s: prev.s + 1
            }),
            {x: 0, y: 0, s: 0}
          )
          .thru(({x, y, s}) => ({x: x / s, y: y / s}))
          .value();
        const {
          [GraphEntityType.Edge]: edges = [] as UniversalGraphEdge[],
          [GraphEntityType.Node]: nodes = [] as UniversalGraphNode[],
          [GraphEntityType.Group]: groups = [] as UniversalGraphGroup[]
        } = mapValues(groupBy(selection, 'type'), g => map(g, 'entity'));
        const hashMap = new Map<string, string>();

        const createAdjustedNode = <N extends Omit<UniversalGraphNode, 'hash'>>({data, ...rest}: N) => ({
            ...rest,
            hash: uuidv4(),
            data: {
              ...data,
              x: data.x - centerOfMass.x + position.x,
              y: data.y - centerOfMass.y + position.y,
            }
          });

        const pasteNode = <N extends UniversalGraphNode>({hash, ...rest}: N) => {
          const newNode = createAdjustedNode(rest);
          hashMap.set(hash, newNode.hash);
          actions.push(new NodeCreation('Paste node', newNode, nodes.length === 1));
          return newNode;
        };

        for (const {hash, members, ...rest} of groups as UniversalGraphGroup[]) {
          const newGroup = createAdjustedNode({
            ...rest,
            members: members.map(node => pasteNode(node))
          } as UniversalGraphGroup);
          // This works also for groups, as those inherit from the node
          hashMap.set(hash, newGroup.hash);
          actions.push(new GroupCreation('Paste group', newGroup, groups.length === 1));
        }
        for (const node of nodes as UniversalGraphNode[]) {
          if (!hashMap.has(node.hash)) {
            pasteNode(node);
          }
        }
        for (const {from, to, ...rest} of edges as UniversalGraphEdge[]) {
          // Copy only if both nodes are copied as well
          if (hashMap.has(from) && hashMap.has(to)) {
            actions.push(
              new EdgeCreation('Paste edge',
                {...rest, to: hashMap.get(to), from: hashMap.get(from)} as UniversalGraphEdge,
                edges.length === 1
              )
            );
          }
        }
        if (actions.length) {
          return new CompoundAction('Paste content', actions);
        }
      }
    } catch (e) {
      // TODO: throw error?
    }

    return new NodeCreation(
      `Paste content from clipboard`, {
        display_name: 'Note',
        hash: uuidv4(),
        label: 'note',
        sub_labels: [],
        data: {
          x: position.x,
          y: position.y,
          detail: content,
        },
        style: {
          showDetail: true
        }
      }, true,
    );
  }
}
