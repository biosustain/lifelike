import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { GraphCanvasView } from '../graph-canvas-view';
import { NodeCreation } from '../../../actions/nodes';
import { isCtrlOrMetaPressed } from 'app/shared/utils';
import { makeid } from 'app/drawing-tool/services';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from '../../../../drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from '../../../actions/actions';
import { smartTruncate } from '../../../utils/strings';

interface GraphClipboardData {
  lifelike: true;
  selection: GraphEntity[];
}

/**
 * Implements the copy and paste keys.
 */
export class ClipboardKeyboardShortcut extends AbstractCanvasBehavior {
  virtualClipboardContent: string | undefined;
  boundPaste = this.paste.bind(this);

  constructor(private readonly graphView: GraphCanvasView) {
    super();
    document.addEventListener('paste', this.boundPaste);
  }

  destroy() {
    document.removeEventListener('paste', this.boundPaste);
  }

  paste(event) {
    const content = this.virtualClipboardContent || event.clipboardData.getData('text/plain');
    if (content) {
      const position = this.graphView.currentHoverPosition;
      if (position) {
        this.graphView.execute(this.pasteContent(content, position));
        event.preventDefault();
      }
    }
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    if (isCtrlOrMetaPressed(event) && event.code === 'KeyC') {
      const selection: GraphEntity[] = this.graphView.selection.get();
      const clipboardData = JSON.stringify({
        lifelike: true,
        selection,
      } as GraphClipboardData);

      if (navigator.clipboard) {
        navigator.clipboard.writeText(clipboardData).then(() => {
          this.virtualClipboardContent = null;
        }, () => {
          this.virtualClipboardContent = clipboardData;
        });
      } else {
        this.virtualClipboardContent = clipboardData;
      }

    } else {
      return BehaviorResult.Continue;
    }
  }

  private pasteContent(content: string, position: { x: number, y: number }): GraphAction {
    try {
      const actions = [];
      const data: GraphClipboardData = JSON.parse(content);
      if (data.lifelike) {
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
}
