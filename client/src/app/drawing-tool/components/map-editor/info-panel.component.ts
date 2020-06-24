import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

import { DataFlowService } from '../../services';
import { GraphEntity, GraphEntityType, LaunchApp } from '../../services/interfaces';

import { Subscription } from 'rxjs';
import { GraphEntityUpdate } from '../../../graph-viewer/actions/graph';
import { EdgeDeletion, NodeDeletion } from '../../../graph-viewer/actions/nodes';
import { openLink } from '../../../shared/utils/browser';
import { WorkspaceManager } from '../../../shared/workspace-manager';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit, OnDestroy {
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();

  selected: GraphEntity | undefined;

  private graphDataSubscription: Subscription = null;

  constructor(private dataFlow: DataFlowService,
              private workspaceManager: WorkspaceManager) {
  }

  ngOnInit() {
    // Handle data received from the graph
    this.graphDataSubscription = this.dataFlow.graphEntitySource.subscribe((selected: GraphEntity) => {
      this.selected = selected;
    });
  }

  ngOnDestroy() {
    this.graphDataSubscription.unsubscribe();
  }

  isSelectionNode() {
    return this.selected && this.selected.type === GraphEntityType.Node;
  }

  isSelectionEdge() {
    return this.selected && this.selected.type === GraphEntityType.Edge;
  }

  save({originalData, updatedData}: { originalData: object, updatedData: object }) {
    this.dataFlow.pushFormChange(
      new GraphEntityUpdate('Update properties', this.selected, updatedData, originalData)
    );
  }

  deleteNode(node) {
    this.dataFlow.pushFormChange(new NodeDeletion('Delete node', node));
  }

  deleteEdge(edge) {
    this.dataFlow.pushFormChange(new EdgeDeletion('Delete edge', edge));
  }

  /**
   * Bring user to original source of node information
   */
  openSource(source: string): void {
    let m;

    m = source.match(/^\/dt\/pdf/);
    if (m != null) {
      const [
        fileId,
        page,
        coordA,
        coordB,
        coordC,
        coordD
      ] = source.replace(/^\/dt\/pdf\//, '').split('/');
      const url = `/pdf-viewer/${fileId}#page=${page}&coords=${coordA},${coordB},${coordC},${coordD}`;
      this.workspaceManager.navigateByUrl(url, {
        newTab: true,
      });
      return;
    }

    m = source.match(/^\/dt\/map\/([0-9a-f]+)$/);
    if (m != null) {
      this.workspaceManager.navigateByUrl(`/dt/map/${m[1]}`, {
        newTab: true,
      });
    }
  }
}
