import { Component, EventEmitter, Input, Output } from '@angular/core';

import { first as _first } from 'lodash/fp';

import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { EdgeDeletion } from 'app/graph-viewer/actions/edges';
import { NodeDeletion } from 'app/graph-viewer/actions/nodes';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { openPotentialExternalLink } from 'app/shared/utils/browser';
import { GroupDeletion } from 'app/graph-viewer/actions/groups';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';

import { GraphEntity, GraphEntityType } from '../../services/interfaces';
import { InfoPanel } from '../../models/info-panel';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
})
export class InfoPanelComponent {
  @Input() infoPanel: InfoPanel = new InfoPanel();
  @Input() selected: GraphEntity[];
  @Input() graphView: CanvasGraphView;
  @Output() actionCreated = new EventEmitter<GraphAction>();

  constructor(private readonly workspaceManager: WorkspaceManager) {}

  // Return entity if there is only one selected, otherwise return undefined
  get one() {
    if (this.selected.length === 1) {
      return _first(this.selected);
    }
  }

  isSelectionNode() {
    return this.one?.type === GraphEntityType.Node;
  }

  isSelectionEdge() {
    return this.one?.type === GraphEntityType.Edge;
  }

  isSelectionGroup() {
    return this.one?.type === GraphEntityType.Group;
  }

  isMultiSelect() {
    return this.selected.length > 1;
  }

  save({ originalData, updatedData }: { originalData: object; updatedData: object }) {
    this.actionCreated.emit(
      new GraphEntityUpdate('Update properties', this.one, updatedData, originalData)
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
