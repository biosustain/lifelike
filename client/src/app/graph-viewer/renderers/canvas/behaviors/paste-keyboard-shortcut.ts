import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { NodeCreation } from '../../../actions/nodes';
import { isCtrlOrMetaPressed } from 'app/shared/utils';
import { makeid } from 'app/drawing-tool/services';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from '../../../../drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from '../../../actions/actions';
import { smartTruncate } from '../../../utils/strings';

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

  /**
   * Returns a node creation action based on the content provided.
   * @param content the content (like from the clipboard)
   * @param position the position of the node
   */
  private static createActionFromPasteContent(content: string, position: { x: number, y: number }): GraphAction {
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
                hash: makeid(),
                data: {
                  ...node.data,
                  x: position.x,
                  y: position.y,
                }
              }, true
            ));
          }
        }
        if (actions.length) {
          return new CompoundAction('Paste content', actions);
        }
      }
    } catch (e) {
    }

    return new NodeCreation(
      `Paste content from clipboard`, {
        display_name: smartTruncate(content, 20),
        hash: makeid(),
        label: 'note',
        sub_labels: [],
        data: {
          x: position.x,
          y: position.y,
          detail: content,
        }
      }, true
    );
  }

  constructor(private readonly graphView: CanvasGraphView) {
    super();
    document.addEventListener('paste', this.boundPaste);
  }

  destroy() {
    document.removeEventListener('paste', this.boundPaste);
  }

  paste(event) {
    const content = event.clipboardData.getData('text/plain');
    if (content) {
      const position = this.graphView.currentHoverPosition;
      if (position) {
        this.graphView.execute(PasteKeyboardShortcut.createActionFromPasteContent(content, position));
        event.preventDefault();
      }
    }
  }
}
