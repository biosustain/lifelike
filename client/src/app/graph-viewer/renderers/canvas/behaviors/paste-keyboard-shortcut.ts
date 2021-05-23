import { AbstractCanvasBehavior } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';
import { NodeCreation } from '../../../actions/nodes';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from '../../../actions/actions';
import { makeid } from 'app/shared/utils/identifiers';
import { isClipboardEventNativelyHandled } from 'app/shared/utils/clipboard';
import { extractGraphEntityActions } from '../../../../drawing-tool/utils/data';
import { DataTransferDataService } from '../../../../shared/services/data-transfer-data.service';

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

  paste(event) {
    if (isClipboardEventNativelyHandled(event)) {
      return;
    }

    const content = event.clipboardData.getData('text/plain');
    if (content) {
      const position = this.graphView.currentHoverPosition;
      if (position) {
        const items = this.dataTransferDataService.extract(event.clipboardData);
        const actions = extractGraphEntityActions(items, position);

        if (actions.length) {
          this.graphView.execute(new CompoundAction('Copy to map', actions));
          this.graphView.focus();
          event.preventDefault();
        }
      }
    }
  }
}
