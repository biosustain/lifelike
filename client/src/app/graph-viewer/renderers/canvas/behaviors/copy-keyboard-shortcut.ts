import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { isCtrlOrMetaPressed } from 'app/shared/utils';
import { GraphEntity } from '../../../../drawing-tool/services/interfaces';
import { GraphClipboardData, TYPE_STRING } from './paste-keyboard-shortcut';

/**
 * Implements the copy key.
 */
export class CopyKeyboardShortcut extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    // TODO: Copy event handler might fire more reliably than this
    if (isCtrlOrMetaPressed(event) && event.code === 'KeyC') {
      const selection: GraphEntity[] = this.graphView.selection.get();

      const clipboardData = JSON.stringify({
        type: TYPE_STRING,
        selection,
      } as GraphClipboardData);

      if (navigator.clipboard) {
        // We cannot store text/json on the clipboard unfortunately, so
        // the following result can't be pasted in any other app
        navigator.clipboard.writeText(clipboardData);
      }

    } else {
      return BehaviorResult.Continue;
    }
  }
}
