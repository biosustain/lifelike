import { Component, EventEmitter, Input, Output } from '@angular/core';

import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { EdgeDeletion } from 'app/graph-viewer/actions/edges';
import { NodeDeletion } from 'app/graph-viewer/actions/nodes';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { openPotentialExternalLink } from 'app/shared/utils/browser';
import { GroupDeletion } from 'app/graph-viewer/actions/groups';

import { GraphEntity, GraphEntityType } from '../../services/interfaces';
import { InfoPanel } from '../../models/info-panel';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
})
export class InfoPanelComponent {
  @Input() infoPanel: InfoPanel = new InfoPanel();
  @Input() selected: GraphEntity | undefined;
  @Output() actionCreated = new EventEmitter<GraphAction>();

  constructor(private readonly workspaceManager: WorkspaceManager) {}

  isSelectionNode() {
    return this.selected && this.selected.type === GraphEntityType.Node;
  }

  isSelectionEdge() {
    return this.selected && this.selected.type === GraphEntityType.Edge;
  }

  isSelectionGroup() {
    return this.selected && this.selected.type === GraphEntityType.Group;
  }

  save({ originalData, updatedData }: { originalData: object; updatedData: object }) {
    this.actionCreated.emit(
      new GraphEntityUpdate('Update properties', this.selected, updatedData, originalData)
    );
  }

  deleteNode(node) {
    this.actionCreated.emit(new NodeDeletion('Delete node', node));
  }

  deleteEdge(edge) {
    this.actionCreated.emit(new EdgeDeletion('Delete edge', edge));
  }

  deleteGroup(group) {
    this.actionCreated.emit(new GroupDeletion('Delete group', group));
  }

  /**
   * Bring user to original source of node information
   */
  openSource(source: string): void {
    openPotentialExternalLink(this.workspaceManager, source, { newTab: true, sideBySide: true });
  }
}
