import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

import { GraphAction, GraphEntity, Project, VisNetworkGraphNode } from './interfaces';
import { coronavirus } from './mock_data';

/**
 * Handle communication between components
 */
@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class DataFlowService {

  // Communication route to canvas for node dropping
  private pdf2Canvas = new Subject<any>();
  $pdfDataSource = this.pdf2Canvas.asObservable();

  // Communication route to info-panel-ui
  private graph2Form = new Subject<GraphEntity>();
  graphEntitySource = this.graph2Form.asObservable();

  // Communication route to canvas component
  private form2Graph = new Subject<GraphAction>();
  formDataSource = this.form2Graph.asObservable();

  // Communication route from project-list to drawing-tool
  private projectlist2Canvas = new BehaviorSubject<Project>(coronavirus);
  $projectlist2Canvas = this.projectlist2Canvas.asObservable();

  constructor() {
  }

  /**
   * Send dropped node to be interecepted in
   * drawing-tool.component.ts
   * @param node a VisNetworkGraphNode object
   */
  pushNode2Canvas(node: VisNetworkGraphNode) {
    this.pdf2Canvas.next(node);
  }

  /**
   * Load project onto drawing-tool view's canvas
   * @param project a Project object
   */
  pushProject2Canvas(project: Project) {
    this.projectlist2Canvas.next(project);
  }

  /**
   * Send data representing node or edge
   * and its properties
   * @param nodeData represents node data
   */
  pushSelection(nodeData) {
    this.graph2Form.next(nodeData);
  }

  /**
   * Send update of node or edge's properties
   * @param action represents a change to the graph data
   */
  pushFormChange(action: GraphAction) {
    this.form2Graph.next(action);
  }
}
