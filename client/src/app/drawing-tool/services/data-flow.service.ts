import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import {
  Project,
  VisNetworkGraphNode
} from './interfaces';

/**
 * Handle communication between components
 */
@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class DataFlowService {

  /** Communication route to canvas for node dropping */
  private pdf2Canvas = new BehaviorSubject<Object>(null);
  $pdfDataSource = this.pdf2Canvas.asObservable();

  /** Communication route to info-panel-ui */
  private graph2Form = new BehaviorSubject<Object>(null);
  graphDataSource = this.graph2Form.asObservable();

  /** Communication route to canvas component */
  private form2Graph = new BehaviorSubject<Object>(null);
  formDataSource = this.form2Graph.asObservable();

  /** Communication route from project-list to drawing-tool */
  private projectlist2Canvas = new BehaviorSubject<Project>(null);
  $projectlist2Canvas = this.projectlist2Canvas.asObservable();

  constructor() { }

  /**
   * Send dropped node to be interecepted in
   * drawing-tool.component.ts
   * @param node 
   */
  pushNode2Canvas(node: VisNetworkGraphNode) {
    this.pdf2Canvas.next(node);
  }

  /**
   * Load project onto drawing-tool view's canvas
   * @param project 
   */
  pushProject2Canvas(project: Project) {
    this.projectlist2Canvas.next(project);
  }

  /**
   * Send data representing node or edge
   * and its properties
   * @param node_data 
   */
  pushGraphData(node_data) {
    this.graph2Form.next(node_data);
  }

  /**
   * Send update of node or edge's properties
   * @param graph_data_change 
   */
  pushGraphUpdate(graph_data_change) {
    this.form2Graph.next(graph_data_change);
  }
}
