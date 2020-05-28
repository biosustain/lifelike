import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { GraphCanvasView } from '../graph-canvas-view';
import { isCtrlOrMetaPressed } from '../../../../shared/utils';

/**
 * Implements CTRL/CMD-Z and CTRL/CMD-Y.
 */
export class HistoryKeyboardShortcuts extends AbstractCanvasBehavior {
  constructor(private readonly graphView: GraphCanvasView) {
    super();
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    if (isCtrlOrMetaPressed(event) && event.code === 'KeyZ') {
      this.graphView.undo();
      return BehaviorResult.Stop;
    } else if (isCtrlOrMetaPressed(event) && event.code === 'KeyY') {
      this.graphView.redo();
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

}
