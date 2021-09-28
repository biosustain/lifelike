import {
  GraphEntity, GraphEntityType, UniversalGraphNode
} from 'app/drawing-tool/services/interfaces';
import {CompoundAction, GraphAction} from 'app/graph-viewer/actions/actions';
import { isClipboardEventNativelyHandled } from 'app/shared/utils/clipboard';
import { extractGraphEntityActions } from 'app/graph-viewer/../drawing-tool/utils/data';
import { DataTransferDataService } from 'app/graph-viewer/../shared/services/data-transfer-data.service';
import {NodeCreation} from 'app/graph-viewer/actions/nodes';
import {uuidv4} from 'app/shared/utils';

import {AbstractCanvasBehavior, BehaviorEvent, BehaviorResult} from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

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
export class PasteKeyboardShortcut extends AbstractCanvasBehavior {
  /**
   * Bound paste event handler that we need to remove later.
   */
  boundPaste = this.paste.bind(this);

  constructor(private readonly graphView: CanvasGraphView,
              protected readonly dataTransferDataService: DataTransferDataService) {
    super();
    document.addEventListener('paste', this.boundPaste);
  }

  destroy() {
    document.removeEventListener('paste', this.boundPaste);
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const content = event.event.clipboardData.getData('text/plain');
    if (content) {
      const position = this.graphView.currentHoverPosition;
      if (position) {
        const items = this.dataTransferDataService.extract(event.event.clipboardData);
        const actions = extractGraphEntityActions(items, position);
        if (actions.length) {
          this.graphView.execute(new CompoundAction('Copy to map', actions));
          this.graphView.focus();
          event.event.preventDefault();
        }
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
      const actions = [];
      const data: GraphClipboardData = JSON.parse(content);

      // First try to read the data as JSON
      if (data.type === TYPE_STRING) {
        for (const entry of data.selection) {
          if (entry.type === GraphEntityType.Node) {
            const node = entry.entity as UniversalGraphNode;
            actions.push(new NodeCreation(
              `Paste content from clipboard`, {
                ...node,
                hash: uuidv4(),
                data: {
                  ...node.data,
                  x: position.x,
                  y: position.y,
                },
              }, true,
            ));
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
      }, true,
    );
  }
}
