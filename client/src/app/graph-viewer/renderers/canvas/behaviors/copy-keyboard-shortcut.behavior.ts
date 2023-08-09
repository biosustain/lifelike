import { MatSnackBar } from '@angular/material/snack-bar';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphGroup,
} from 'app/drawing-tool/services/interfaces';

import { AbstractCanvasBehavior } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { GraphClipboardData, TYPE_STRING } from './paste-keyboard-shortcut.behavior';

/**
 * Implements the copy key.
 */
export class CopyKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  /**
   * Bound copy event handler that we need to remove later.
   */
  boundCopy = this.copy.bind(this);

  constructor(private readonly graphView: CanvasGraphView, private readonly snackBar: MatSnackBar) {
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
    let clipboardData;
    if (selection.length === 0) {
      this.snackBar.open('Nothing to copy!', 'Close', {
        duration: 5000,
      });
      clipboardData = '';
    } else {
      const nestedNodes = new Set(
        selection
          .filter(({ type }) => type === GraphEntityType.Group)
          .flatMap(({ entity }) => (entity as UniversalGraphGroup).members.map(({ hash }) => hash))
      );
      const nestedEdges = this.graphView.edges.filter(
        ({ from, to }) => nestedNodes.has(from) && nestedNodes.has(to)
      );
      clipboardData = JSON.stringify({
        type: TYPE_STRING,
        selection: selection.concat(
          nestedEdges.map(
            (entity) =>
              ({
                type: GraphEntityType.Edge,
                entity,
              } as GraphEntity)
          )
        ),
      } as GraphClipboardData);
    }

    event.clipboardData.setData('text/plain', clipboardData);
    event.preventDefault();
  }
}
