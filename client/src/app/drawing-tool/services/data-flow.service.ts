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
  providedIn: 'root'
})
export class DataFlowService {

  /** Communication route to canvas for node dropping */
  private pdf2Canvas = new BehaviorSubject<any>(null);
  $pdfDataSource = this.pdf2Canvas.asObservable();

  /** Communication route to info-panel-ui */
  private graph2Form = new BehaviorSubject<any>(null);
  graphDataSource = this.graph2Form.asObservable();

  /** Communication route to canvas component */
  private form2Graph = new BehaviorSubject<any>(null);
  formDataSource = this.form2Graph.asObservable();

  /** Communication route from project-list to drawing-tool */
  private projectlist2Canvas = new BehaviorSubject<Project>(null);
  $projectlist2Canvas = this.projectlist2Canvas.asObservable();

  constructor() { }

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
  pushGraphData(nodeData) {
    this.graph2Form.next(nodeData);
  }

  /**
   * Send update of node or edge's properties
   * @param graphDataChange represents a change to the graph data
   */
  pushGraphUpdate(graphDataChange) {
    this.form2Graph.next(graphDataChange);
  }
}
