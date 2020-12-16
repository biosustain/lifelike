import { Component, EventEmitter, Input, Output } from '@angular/core';

import { GraphEntity, GraphEntityType } from '../../services/interfaces';

import { GraphEntityUpdate } from '../../../graph-viewer/actions/graph';
import { EdgeDeletion, NodeDeletion } from '../../../graph-viewer/actions/nodes';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { GraphAction } from '../../../graph-viewer/actions/actions';
import { openPotentialInternalLink } from '../../../shared/utils/browser';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
})
export class InfoPanelComponent {
  @Input() selected: GraphEntity | undefined;
  @Output() actionCreated = new EventEmitter<GraphAction>();

  constructor(private readonly workspaceManager: WorkspaceManager) {
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
    openPotentialInternalLink(this.workspaceManager, source, false);
  }
}
