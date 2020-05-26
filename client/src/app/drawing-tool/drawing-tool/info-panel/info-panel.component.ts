import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

import { DataFlowService } from '../../services';
import { GraphEntity, GraphEntityType, LaunchApp } from '../../services/interfaces';

import { Subscription } from 'rxjs';
import { GraphEntityUpdate } from '../../../graph-viewer/actions/graph';
import { EdgeDeletion, NodeDeletion } from '../../../graph-viewer/actions/nodes';

@Component({
  selector: 'app-info-panel',
  templateUrl: './info-panel.component.html',
  styleUrls: ['./info-panel.component.scss']
})
export class InfoPanelComponent implements OnInit, OnDestroy {
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();

  selected: GraphEntity | undefined;

  private graphDataSubscription: Subscription = null;

  constructor(private dataFlow: DataFlowService) {
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

  save(data) {
    this.dataFlow.pushFormChange(
      new GraphEntityUpdate('Update properties', this.selected, data)
    );
  }

  deleteNode(node) {
    this.dataFlow.pushFormChange(new NodeDeletion('Delete node', node));
  }

  deleteEdge(edge) {
    this.dataFlow.pushFormChange(new EdgeDeletion('Delete edge', edge));
  }
}
