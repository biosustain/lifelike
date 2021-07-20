import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { isClipboardEventNativelyHandled } from 'app/shared/utils/clipboard';
import { NodeCreation } from '../../../actions/nodes';
import { isCtrlOrMetaPressed } from 'app/shared/utils';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from '../../../../drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from '../../../actions/actions';
import { smartTruncate } from '../../../utils/strings';
import { GraphClipboardData, TYPE_STRING } from './paste-keyboard-shortcut.behavior';

/**
 * Implements the copy key.
 */
export class CopyKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  /**
   * Bound copy event handler that we need to remove later.
   */
  boundCopy = this.copy.bind(this);

  constructor(private readonly graphView: CanvasGraphView) {
    super();
    document.addEventListener('copy', this.boundCopy);
  }

  destroy() {
    document.removeEventListener('copy', this.boundCopy);
  }

  copy(event: ClipboardEvent) {
    // We can't set the copy handler onto the canvas itself (doesn't trigger any
    // events, as of writing), so we need to filter out the copies we want to override
    if (document.activeElement !== this.graphView.canvas) {
      return;
    }

    const selection: GraphEntity[] = this.graphView.selection.get();

    const clipboardData = JSON.stringify({
      type: TYPE_STRING,
      selection,
    } as GraphClipboardData);

    event.clipboardData.setData('text/plain', clipboardData);
    event.preventDefault();
  }
}
