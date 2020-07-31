import { Component, EventEmitter, Input, Output } from '@angular/core';

import { GraphEntity, GraphEntityType } from '../../services/interfaces';

import { GraphEntityUpdate } from '../../../graph-viewer/actions/graph';
import { EdgeDeletion, NodeDeletion } from '../../../graph-viewer/actions/nodes';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { GraphAction } from '../../../graph-viewer/actions/actions';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { MessageType } from '../../../interfaces/message-dialog.interface';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
})
export class InfoPanelComponent {
  @Input() selected: GraphEntity | undefined;
  @Output() actionCreated = new EventEmitter<GraphAction>();

  constructor(private readonly workspaceManager: WorkspaceManager,
              private readonly messageDialog: MessageDialog) {
  }

  isSelectionNode() {
    return this.selected && this.selected.type === GraphEntityType.Node;
  }

  isSelectionEdge() {
    return this.selected && this.selected.type === GraphEntityType.Edge;
  }

  save({originalData, updatedData}: { originalData: object, updatedData: object }) {
    this.actionCreated.emit(
      new GraphEntityUpdate('Update properties', this.selected, updatedData, originalData),
    );
  }

  deleteNode(node) {
    this.actionCreated.emit(new NodeDeletion('Delete node', node));
  }

  deleteEdge(edge) {
    this.actionCreated.emit(new EdgeDeletion('Delete edge', edge));
  }

  /**
   * Bring user to original source of node information
   */
  openSource(source: string): void {
    let m;

    m = source.match(/^\/projects\/[^\/]+\/(files|maps)\/[^\/]+/);
    if (m != null) {
      this.workspaceManager.navigateByUrl(source, {
        newTab: true,
        sideBySide: true,
        // Only replace tab if it's a file
        ...(m[1] === 'files' ? {
          replaceTabIfMatch: source.replace(/#.*$/g, ''),
        } : {}),
      });
      return;
    }

    m = source.match(/^\/dt\/pdf/);
    if (m != null) {
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD,
      ] = source.replace(/^\/dt\/pdf\//, '').split('/');
      const url = `/projects/beta-project/files/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
      this.workspaceManager.navigateByUrl(url, {
        newTab: true,
        sideBySide: true,
        replaceTabIfMatch: `^/projects/beta-project/files/${fileId}`,
      });
      return;
    }

    m = source.match(/^\/dt\/map\/([0-9a-f]+)$/);
    if (m != null) {
      this.workspaceManager.navigateByUrl(`/dt/map/${m[1]}`, {
        newTab: true,
        sideBySide: true,
        replaceTabIfMatch: `/maps/${m[1]}`,
      });
      return;
    }

    this.messageDialog.display({
      type: MessageType.Warning,
      title: 'Unknown Source Link',
      message: `The selected item has an unknown source link of '${source}'.`,
    });
  }
}
