import {
  mapValues as _mapValues,
  groupBy as _groupBy,
  map as _map,
  flow as _flow,
  filter as _filter,
  flatMap as _flatMap,
  reduce as _reduce,
} from 'lodash/fp';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
  UniversalGraphGroup,
  UniversalGraphEdge,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { createNode, createGroupNode } from 'app/graph-viewer/utils/objects';
import { SelectionEntity } from 'app/sankey/interfaces/selection';

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
  private readonly CASCADE_OFFSET = 50;
  private burstPosition: { x: number; y: number };
  private burstIteration = 0;

  // TODO: fix boundPaste if not coming in next patch
  constructor(
    private readonly graphView: CanvasGraphView,
    protected readonly dataTransferDataService: DataTransferDataService
  ) {
    super();
  }

  calculatePosition() {
    const { burstPosition, CASCADE_OFFSET } = this;
    const cursorPosition = this.graphView.currentHoverPosition;
    if (cursorPosition) {
      let nextPastePosition = cursorPosition;
      const manhattanDistanceFromLastPasteBurst =
        Math.abs(cursorPosition.x - burstPosition?.x) +
        Math.abs(cursorPosition.y - burstPosition?.y);
      if (manhattanDistanceFromLastPasteBurst <= CASCADE_OFFSET) {
        this.burstIteration++;
        nextPastePosition = {
          x: burstPosition.x + this.burstIteration * CASCADE_OFFSET,
          y: burstPosition.y + this.burstIteration * CASCADE_OFFSET,
        };
      } else {
        this.burstPosition = nextPastePosition;
        this.burstIteration = 0;
      }
      return nextPastePosition;
    }
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.calculatePosition();
    if (position) {
      const content = event.event.clipboardData.getData('text/plain');
      if (content) {
        this.graphView.selection.replace([]);
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
  private createActionFromPasteContent(
    content: string,
    position: { x: number; y: number }
  ): GraphAction {
    try {
      const actions: GraphAction[] = [];
      const { type, selection }: GraphClipboardData = JSON.parse(content);

      // First try to read the data as JSON
      if (type === TYPE_STRING) {
        const centerOfMass = _flow(
          _filter((e: GraphEntity) => e.type !== GraphEntityType.Edge),
          _flatMap(
            ({ entity }) =>
              ((entity as UniversalGraphGroup).members ?? [entity]) as UniversalGraphNode[]
          ),
          _reduce(
            (prev, { data: { x = 0, y = 0 } }) => ({
              x: prev.x + x,
              y: prev.y + y,
              s: prev.s + 1,
            }),
            { x: 0, y: 0, s: 0 }
          ),
          ({ x, y, s }) => ({ x: x / s, y: y / s })
        )(selection);
        const {
          [GraphEntityType.Edge]: edges = [] as UniversalGraphEdge[],
          [GraphEntityType.Node]: nodes = [] as UniversalGraphNode[],
          [GraphEntityType.Group]: groups = [] as UniversalGraphGroup[],
        } = _flow(_groupBy('type'), _mapValues(_map('entity')))(selection);
        const hashMap = new Map<string, string>();
        const isSingularNode = nodes.length === 1;
        const isSingularEdge = edges.length === 1;
        const isSingularGroup = groups.length === 1;
        this.graphView.selection.replace([]);

        const adjust = <N extends UniversalGraphNode>({ data, ...rest }: N) =>
          ({
            ...rest,
            data: {
              ...data,
              x: data.x - centerOfMass.x + position.x,
              y: data.y - centerOfMass.y + position.y,
            },
          } as N);

        const pasteNode = <N extends UniversalGraphNode>({ hash, ...rest }: N) => {
          const newNode = adjust(createNode(rest));
          hashMap.set(hash, newNode.hash);
          actions.push(new NodeCreation('Paste node', newNode, true, isSingularNode));
          return newNode;
        };

        for (const { hash, members, ...rest } of groups as UniversalGraphGroup[]) {
          const newGroup = adjust(
            createGroupNode({
              ...rest,
              members: members.map((node) => pasteNode(node)),
            })
          );
          // This works also for groups, as those inherit from the node
          hashMap.set(hash, newGroup.hash);
          actions.push(new GroupCreation('Paste group', newGroup, true, isSingularGroup));
        }
        for (const node of nodes as UniversalGraphNode[]) {
          if (!hashMap.has(node.hash)) {
            pasteNode(node);
          }
        }
        for (const { from, to, ...rest } of edges as UniversalGraphEdge[]) {
          // Copy only if both nodes are copied as well
          if (hashMap.has(from) && hashMap.has(to)) {
            actions.push(
              new EdgeCreation(
                'Paste edge',
                { ...rest, to: hashMap.get(to), from: hashMap.get(from) } as UniversalGraphEdge,
                true,
                isSingularEdge
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
      `Paste content from clipboard`,
      createNode({
        display_name: 'Note',
        label: 'note',
        data: {
          x: position.x,
          y: position.y,
          detail: content,
        },
        style: {
          showDetail: true,
        },
      }),
      true,
      true
    );
  }
}
