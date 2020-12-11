import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { GraphEntity } from 'app/drawing-tool/services/interfaces';
import { GraphClipboardData, TYPE_STRING } from './paste-keyboard-shortcut';
import { isClipboardEventNativelyHandled } from 'app/shared/utils/clipboard';

/**
 * Implements the copy key.
 */
export class CopyKeyboardShortcut extends AbstractCanvasBehavior {
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

  /** // Albert's incoming change from commit d5388a675
  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    // TODO: Copy event handler might fire more reliably than this
    if (isCtrlOrMetaPressed(event.event) && event.event.code === 'KeyC') {
      const selection: GraphEntity[] = this.graphView.selection.get();
  */

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
