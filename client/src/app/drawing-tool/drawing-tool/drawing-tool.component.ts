import { AfterViewInit, Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Options } from '@popperjs/core';

import * as d3 from 'd3';
import intersects from 'intersects';
import 'canvas-plus';
import './canvas-arrow';

import { fromEvent, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, filter, first, takeUntil } from 'rxjs/operators';

import { IdType } from 'vis-network';

import { Coords2D } from 'app/interfaces/shared.interface';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { keyCodeRepresentsPasteEvent } from 'app/shared/utils';
import { DataFlowService, makeid, ProjectsService } from '../services';
import {
  GraphAction,
  GraphComponent,
  GraphData,
  GraphEntity,
  GraphEntityType,
  LaunchApp,
  Project,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphNode
} from '../services/interfaces';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';
import { CopyPasteMapsService } from '../services/copy-paste-maps.service';

import { InfoPanelComponent } from './info-panel/info-panel.component';

import { annotationTypesMap } from 'app/shared/annotation-styles';
import { ExportModalComponent } from './export-modal/export-modal.component';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { NodeCreation } from '../services/actions';

interface GraphNodeMetrics {
  textWidth: number;
  textActualHeight: number;
  nodeX: number;
  nodeY: number;
  nodeX2: number;
  nodeY2: number;
  nodeWidth: number;
  nodeHeight: number;
}

interface EdgeCreationNodeData {
  x: number;
  y: number;
}

interface EdgeCreationNode {
  data: EdgeCreationNodeData;
}

interface EdgeCreationState {
  from: UniversalGraphNode;
  to?: EdgeCreationNode;
}

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './drawing-tool.component.html',
  styleUrls: ['./drawing-tool.component.scss'],
  providers: [ClipboardService],
})
export class DrawingToolComponent implements OnInit, AfterViewInit, OnDestroy, GraphComponent {
  /** Communicate to parent component to open another app side by side */
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();
  /** Communicate which app is active for app icon presentation */
  @Input() currentApp = '';

  /** Communicate what map to load by map hash id */
  CURRENT_MAP = '';

  get currentMap() {
    return this.CURRENT_MAP;
  }

  @Input()
  set currentMap(val) {
    this.CURRENT_MAP = val;
  }

  @ViewChild(InfoPanelComponent, {
    static: false
  }) infoPanel: InfoPanelComponent;

  mouseMoveEventStream: Observable<MouseEvent>;
  endMouseMoveEventSource: Subject<boolean>;
  mouseMoveSub: Subscription;

  pasteEventStream: Observable<KeyboardEvent>;
  endPasteEventSource: Subject<boolean>;
  pasteSub: Subscription;

  cursorDocumentPos: Coords2D; // Represents the position of the cursor within the document { x: number; y: number }

  selectedNodes: IdType[];
  selectedEdges: IdType[];

  contextMenuTooltipSelector: string;
  contextMenuTooltipOptions: Partial<Options>;


  /** Obj representation of knowledge model with metadata */
  project: Project = null;

  /** Communicate save state to parent component */
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();

  /** Whether or not graph is saved from modification */
  SAVE_STATE = true;

  get saveState() {
    return this.SAVE_STATE;
  }

  set saveState(val) {
    this.SAVE_STATE = val;
    // communicate to parent component of save state change
    this.saveStateListener.emit(this.SAVE_STATE);
  }

  /**
   * Subscription for subjects
   * to quit in destroy lifecycle
   */
  formDataSubscription: Subscription = null;
  pdfDataSubscription: Subscription = null;

  /**
   * The canvas element from the template.
   */
  @ViewChild('canvas', {static: true}) canvasChild;
  /**
   * Holds the canvas after ngAfterViewInit() is run.
   */
  canvas: HTMLCanvasElement;
  /**
   * The transform represents the current zoom of the graph, which must be
   * taken into consideration whenever mapping between graph coordinates and
   * viewport coordinates.
   */
  transform = d3.zoomIdentity.scale(0.8).translate(700, 500);
  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of nodes being rendered.
   */
  nodes: UniversalGraphNode[] = [];
  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of edges being rendered.
   */
  edges: UniversalGraphEdge[] = [];
  /**
   * Maps node's hashes to nodes for O(1) lookup, essential to the speed
   * of most of this graph code.
   */
  nodeHashMap: Map<string, UniversalGraphNode> = new Map();
  /**
   * Used for the double-click-to-create-an-edge function to store the from
   * node and other details regarding the connection.
   */
  interactiveEdgeCreationState: EdgeCreationState | undefined = null;
  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  offsetBetweenNodeAndMouseInitialPosition: number[] = [0, 0];
  /**
   * Holds the currently selected node or edge.
   */
  highlighted: GraphEntity | undefined;
  /**
   * Holds the currently highlighted node or edge.
   */
  selected: GraphEntity | undefined;

  /**
   * Stack of actions in the history.
   */
  history: GraphAction[] = [];
  /**
   * Stores where we are in the history, where the number is the next free index
   * in the history array if there is nothing to redo/rollback. When the user
   * calls undo(), the index goes -1 and when the user calls redo(), the index
   * goes +1.
   */
  nextHistoryIndex = 0;

  // Prevent the user from leaving the page
  // if work is left un-saved
  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    return this.saveState ? true : confirm(
      'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.'
    );
  }

  get saveStyle() {
    return {
      saved: this.saveState,
      not_saved: !this.saveState
    };
  }

  constructor(
    private dataFlow: DataFlowService,
    private drawingToolContextMenuControlService: DrawingToolContextMenuControlService,
    private projectService: ProjectsService,
    private snackBar: MatSnackBar,
    private copyPasteMapsService: CopyPasteMapsService,
    private clipboardService: ClipboardService,
    private dialog: MatDialog
  ) {
  }

  ngOnInit() {
    this.endMouseMoveEventSource = new Subject();
    this.endPasteEventSource = new Subject();

    this.selectedNodes = [];
    this.selectedEdges = [];

    this.contextMenuTooltipSelector = '#root-menu';
    this.contextMenuTooltipOptions = {
      placement: 'right-start',
    };

    // Listen for node addition from pdf-viewer
    this.pdfDataSubscription = this.dataFlow.$pdfDataSource.subscribe(
      (node: GraphData) => this.fileDropped(node)
    );

    // Listen for graph update from info-panel-ui
    this.formDataSubscription = this.dataFlow.formDataSource.subscribe((action: GraphAction) => {
      this.execute(action);
    });
  }

  ngAfterViewInit() {
    this.canvas = this.canvasChild.nativeElement as HTMLCanvasElement;
    this.canvas.width = (this.canvas.parentNode as HTMLElement).clientWidth;
    this.canvas.height = (this.canvas.parentNode as HTMLElement).clientHeight;

    d3.select(this.canvas)
      .on('click', this.canvasClicked.bind(this))
      .on('dblclick', this.canvasDoubleClicked.bind(this))
      .on('mousemove', this.canvasMouseMoved.bind(this))
      .call(d3.drag()
        .container(this.canvas)
        .subject(this.getEntityAtMouse.bind(this))
        .on('start', this.canvasDragStarted.bind(this))
        .on('drag', this.canvasDragged.bind(this))
        .on('end', this.canvasDragEnded.bind(this)))
      .call(d3.zoom()
        .scaleExtent([1 / 10, 20])
        .on('zoom', this.canvasZoomed.bind(this)))
      .on('dblclick.zoom', null);

    this.loadMap(this.currentMap);
  }

  ngOnDestroy() {
    // Unsubscribe from subscriptions
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();

    // Complete the vis canvas element event listeners
    this.endMouseMoveEventSource.complete();
    this.endPasteEventSource.complete();
  }

  // ========================================
  // Graph I/O
  // ========================================

  /**
   * Pull map from server by hash id and draw it onto canvas
   * @param hashId - identifier to pull by from the server
   */
  loadMap(hashId: string): void {
    this.projectService.serveProject(hashId).subscribe(
      (resp: any) => {
        this.project = resp.project;
        this.setGraph(this.project.graph);
      }
    );
  }

  /**
   * Replace the graph that is being rendered by the drawing tool.
   * @param graph the graph to replace with
   */
  setGraph(graph: UniversalGraph): void {
    console.log('graph loaded', graph);

    this.nodes = [...graph.nodes];
    this.edges = [...graph.edges];

    // We need O(1) lookup of nodes
    this.nodeHashMap = graph.nodes.reduce(
      (map, node) => map.set(node.hash, node),
      new Map()
    );

    this.requestRender();
  }

  // ========================================
  // Accessors
  // ========================================

  /**
   * Grab the node referenced by the given hash. Throws errors if not found.
   * Should never not be found, otherwise there is a serious data integrity problem.
   * @param hash the hash
   */
  nodeReference(hash: string): UniversalGraphNode {
    const node = this.nodeHashMap.get(hash);
    if (node == null) {
      throw new Error('missing node link');
    }
    return node;
  }

  /**
   * Return if any one of the given items has been selected.
   * @param entities a list of entities to check
   */
  isAnySelected(...entities: UniversalGraphEntity[]) {
    if (!this.selected) {
      return false;
    }
    for (const d of entities) {
      if (this.selected.entity === d) {
        return true;
      }
    }
  }

  /**
   * Return if any one of the given items has been highlighted.
   * @param entities a list of entities to check
   */
  isAnyHighlighted(...entities: UniversalGraphEntity[]) {
    if (!this.highlighted) {
      return false;
    }
    for (const d of entities) {
      if (this.highlighted.entity === d) {
        return true;
      }
    }
    return false;
  }

  // ========================================
  // Styles
  // ========================================

  /**
   * Calculate the primary color for the given node.
   * @param d the node in question
   */
  calculateNodeColor(d: UniversalGraphNode): string {
    return annotationTypesMap.get(d.label).color;
  }

  /**
   * Calculate the font string for a graph node.
   * @param d the node to calculate for
   */
  calculateNodeFont(d: UniversalGraphNode): string {
    const scaleFactor = 1 / this.transform.scale(1).k;
    return (this.isAnyHighlighted(d) || this.isAnySelected(d) ? 'bold ' : '') + (scaleFactor * 15) + 'px Roboto';
  }

  /**
   * Calculate the font string for a graph edge.
   * @param d the edge to calculate for
   */
  calculateEdgeFont(d: UniversalGraphEdge): string {
    const scaleFactor = 1 / this.transform.scale(1).k;
    const from = this.nodeReference(d.from);
    const to = this.nodeReference(d.to);
    return (this.isAnyHighlighted(d, from, to) ? 'bold ' : '')
      + (scaleFactor * 14) + 'px Roboto';
  }

  /**
   * Calculate the box metrics (dimensions) for a node.
   * @param d the node in question
   */
  calculateNodeMetrics(d: UniversalGraphNode): GraphNodeMetrics {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    const textSize = ctx.measureText(d.display_name);
    const textActualHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
    const nodeWidth = textSize.width + 10;
    const nodeHeight = textActualHeight + 10;
    const nodeX = d.data.x - nodeWidth / 2;
    const nodeY = d.data.y - nodeHeight / 2;
    return {
      textWidth: textSize.width,
      textActualHeight,
      nodeX,
      nodeY,
      nodeX2: nodeX + nodeWidth,
      nodeY2: nodeY + nodeHeight,
      nodeWidth,
      nodeHeight,
    };
  }

  // ========================================
  // Utility geometric operations
  // ========================================

  /**
   * Find the best matching node at the given position.
   * @param nodes list of nodes to search through
   * @param x graph X location
   * @param y graph Y location
   */
  findNode(nodes: UniversalGraphNode[], x: number, y: number): UniversalGraphNode | undefined {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      ctx.font = this.calculateNodeFont(d);
      const metrics = this.calculateNodeMetrics(d);
      if (x >= metrics.nodeX && x <= metrics.nodeX2 && y >= metrics.nodeY && y <= metrics.nodeY2) {
        return d;
      }
    }
    return undefined;
  }

  /**
   * Find the best matching edge at the given position.
   * @param edges list of edges to search through
   * @param x graph X location
   * @param y graph Y location
   */
  findEdge(edges: UniversalGraphEdge[], x: number, y: number): UniversalGraphEdge | undefined {
    const candidates = [];
    for (const edge of edges) {
      const from = this.nodeReference(edge.from);
      const to = this.nodeReference(edge.to);

      const x1 = Math.min(from.data.x, to.data.x);
      const x2 = Math.max(from.data.x, to.data.x);
      const y1 = Math.min(from.data.y, to.data.y);
      const y2 = Math.max(from.data.y, to.data.y);
      const distance = this.getLinePointIntersectionDistance(x, y, x1, x2, y1, y2);

      if (distance <= 2) {
        candidates.push([edge, distance]);
      }
    }

    if (candidates.length) {
      let bestCandidate = candidates[0];
      for (let i = 1; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate[1] < bestCandidate[1]) {
          bestCandidate = candidate;
        }
      }
      return bestCandidate[0];
    }
    return undefined;
  }

  /**
   * Get the graph entity located where the mouse is, if there is one.
   */
  getEntityAtMouse(): GraphEntity | undefined {
    const canvas = this.canvas;
    const [mouseX, mouseY] = d3.mouse(canvas);
    const x = this.transform.invertX(mouseX);
    const y = this.transform.invertY(mouseY);
    const node = this.findNode(this.nodes, x, y);
    if (node) {
      return {
        type: GraphEntityType.Node,
        entity: node
      };
    }
    const edge = this.findEdge(this.edges, x, y);
    if (edge) {
      return {
        type: GraphEntityType.Edge,
        entity: edge
      };
    }
    return undefined;
  }

  // ========================================
  // Rendering
  // ========================================

  /**
   * Re-render the graph.
   */
  requestRender() {
    // TODO: Maybe flag as a render being required and do it in requestAnimationFrame()
    this.render();
  }

  /**
   * Re-render the graph.
   */
  render() {
    const transform = this.transform;
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');

    // Multiply any values by this number to have it *NOT* scale with zoom
    const noZoomScale = 1 / transform.scale(1).k;

    ctx.save();
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    //
    // Draws the elements needed for the interactive edge creation feature
    // Note that we draw this feature below everything else
    //
    if (this.interactiveEdgeCreationState && this.interactiveEdgeCreationState.to) {
      ctx.beginPath();

      const {from, to} = this.interactiveEdgeCreationState;

      // Draw line
      const lineWidth = 0.5 * noZoomScale;
      ctx.lineWidth = 3 / transform.scale(3).k;
      ctx.fillStyle = '#2B7CE9';
      (ctx as any).arrow(
        from.data.x, from.data.y, to.data.x, to.data.y,
        [0, lineWidth, -10 * noZoomScale, lineWidth, -10 * noZoomScale, 5 * noZoomScale]);
      ctx.fill();

      // Draw the 'o' node at the end of the line
      const nodeRadius = 6 * noZoomScale;
      const x = to.data.x;
      const y = to.data.y;
      ctx.moveTo(x, y);
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#2B7CE9';
      ctx.stroke();
      ctx.fillStyle = '#97C2FC';
      ctx.fill();
    }

    //
    // Draw edge lines, without the labels (for correct z-ordering)
    //
    this.edges.forEach(d => {
      ctx.beginPath();

      const from = this.nodeReference(d.from);
      const to = this.nodeReference(d.to);

      ctx.font = this.calculateNodeFont(this.nodeReference(d.to));
      const toMetrics = this.calculateNodeMetrics(this.nodeReference(d.to));

      // Because we draw an arrowhead at the end, we need the line to stop at the
      // shape's edge and not at the node center, so we need to find the intersection between
      // the line and the node box
      const toCollision = this.pointOnRect(
        this.nodeReference(d.from).data.x,
        this.nodeReference(d.from).data.y,
        toMetrics.nodeX,
        toMetrics.nodeY,
        toMetrics.nodeX2,
        toMetrics.nodeY2,
        true
      );

      // Draw line
      const lineWidth = (this.isAnyHighlighted(d, from, to) ? 1 : 0.5) * noZoomScale;
      ctx.fillStyle = (!this.highlighted || this.isAnyHighlighted(d, from, to)) ? '#2B7CE9' : '#ACCFFF';
      (ctx as any).arrow(
        this.nodeReference(d.from).data.x,
        this.nodeReference(d.from).data.y,
        toCollision.x,
        toCollision.y,
        [0, lineWidth, -10 * noZoomScale, lineWidth, -10 * noZoomScale, 5 * noZoomScale]);
      ctx.fill();
    });

    //
    // Draw edge labels (after we've drawn the lines, for correct z-ordering)
    //
    this.edges.forEach(d => {
      ctx.beginPath();

      // Draw label
      if (d.label) {
        const from = this.nodeReference(d.from);
        const to = this.nodeReference(d.to);

        ctx.font = this.calculateNodeFont(to);
        const toMetrics = this.calculateNodeMetrics(to);
        const toCollision = this.pointOnRect(from.data.x, from.data.y,
          toMetrics.nodeX, toMetrics.nodeY, toMetrics.nodeX2, toMetrics.nodeY2, true);

        ctx.font = this.calculateNodeFont(from);
        const fromMetrics = this.calculateNodeMetrics(from);
        const fromCollision = this.pointOnRect(to.data.x, to.data.y,
          fromMetrics.nodeX, fromMetrics.nodeY, fromMetrics.nodeX2, fromMetrics.nodeY2, true);

        ctx.font = this.calculateEdgeFont(d);
        const textSize = ctx.measureText(d.label);
        const width = textSize.width;
        const height = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
        const x = Math.abs(fromCollision.x - toCollision.x) / 2 + Math.min(fromCollision.x, toCollision.x) - width / 2;
        const y = Math.abs(fromCollision.y - toCollision.y) / 2 + Math.min(fromCollision.y, toCollision.y) + height / 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * noZoomScale;
        ctx.strokeText(d.label, x, y);
        ctx.fillStyle = '#888';
        ctx.fillText(d.label, x, y);
      }
    });

    //
    // Draw node
    //
    this.nodes.forEach((d, i) => {
      ctx.beginPath();

      ctx.font = this.calculateNodeFont(d);
      const metrics = this.calculateNodeMetrics(d);

      // Node box
      (ctx as any).roundedRect(
        metrics.nodeX,
        metrics.nodeY,
        metrics.nodeWidth,
        metrics.nodeHeight,
        5 * noZoomScale
      );
      ctx.strokeStyle = '#2B7CE9';
      ctx.lineWidth = noZoomScale * (this.isAnyHighlighted(d) ? 2 : 1.5);
      ctx.fillStyle = (this.isAnyHighlighted(d) ? '#E4EFFF' : (this.isAnySelected(d) ? '#efefef' : '#fff'));
      ctx.fill();
      ctx.stroke();

      // Node outline
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = noZoomScale * 1.5;

      // Node text
      ctx.fillStyle = this.calculateNodeColor(d);
      ctx.fillText(d.display_name, d.data.x - metrics.textWidth / 2, d.data.y + metrics.textActualHeight / 2);
    });

    ctx.restore();
  }

  // ========================================
  // Event handlers
  // ========================================

  // Canvas events
  // ---------------------------------

  canvasClicked() {
    const subject = this.getEntityAtMouse();
    if (this.interactiveEdgeCreationState) {
      if (subject && subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        if (node !== this.interactiveEdgeCreationState.from) {
          const label = prompt('Label please', '') || ''; // Doesn't work for 0
          this.edges.push({
            data: {},
            from: this.interactiveEdgeCreationState.from.hash,
            to: node.hash,
            label,
          });
          this.interactiveEdgeCreationState = null;
        }
      } else {
        this.interactiveEdgeCreationState = null;
      }
    } else {
      this.select(subject);
    }
    this.requestRender();
  }

  canvasDoubleClicked() {
    if (!this.interactiveEdgeCreationState) {
      const subject = this.getEntityAtMouse();
      if (subject && subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        this.interactiveEdgeCreationState = {
          from: node,
          to: null,
        };
      }
    }
  }

  canvasMouseMoved() {
    const canvas = this.canvas;
    const [mouseX, mouseY] = d3.mouse(canvas);
    this.highlighted = this.getEntityAtMouse();
    if (this.interactiveEdgeCreationState) {
      this.interactiveEdgeCreationState.to = {
        data: {
          x: this.transform.invertX(mouseX),
          y: this.transform.invertY(mouseY),
        },
      };
    }
    this.requestRender();
  }

  /**
   * Handle when the mouse is first clicked to start a drag.
   */
  canvasDragStarted(): void {
    const canvas = this.canvas;
    const [mouseX, mouseY] = d3.mouse(canvas);
    const subject: GraphEntity | undefined = d3.event.subject;

    if (subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;

      // We need to store the offset between the mouse and the node, because when
      // we actually move the node, we need to move it relative to this offset
      this.offsetBetweenNodeAndMouseInitialPosition = [
        node.data.x - this.transform.invertX(mouseX),
        node.data.y - this.transform.invertY(mouseY),
      ];
    }

    this.select(subject);
  }

  /**
   * Handle when the mouse is clicked and then dragged across the canvas.
   */
  canvasDragged(): void {
    if (!this.interactiveEdgeCreationState) {
      const canvas = this.canvas;
      const [mouseX, mouseY] = d3.mouse(canvas);
      const subject: GraphEntity | undefined = d3.event.subject;

      if (subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        node.data.x = this.transform.invertX(mouseX) + this.offsetBetweenNodeAndMouseInitialPosition[0];
        node.data.y = this.transform.invertY(mouseY) + this.offsetBetweenNodeAndMouseInitialPosition[1];
        // TODO: Store this in history as ONE object
      }
      this.requestRender();
    }
  }

  /**
   * Handle when the mouse is clicked, dragged across the canvas, and then let go.
   */
  canvasDragEnded(): void {
  }

  /**
   * Handle when the user zooms on the canvas.
   */
  canvasZoomed(): void {
    this.transform = d3.event.transform.scale(0.8).translate(700, 500);
    this.requestRender();
  }

  // Drop events
  // ---------------------------------

  /**
   * Handle something being dropped onto the canvas.
   * @param event object representing a drag-and-drop event
   */
  drop(event: CdkDragDrop<any>) {
    if (event.item.element.nativeElement.classList.contains('map-template')) {
      this.mapDropped(event);
    } else {
      this.paletteNodeDropped(event);
    }
  }

  /**
   * Handle node template being dropped onto the canvas.
   * @param event object representing a drag-and-drop event
   */
  paletteNodeDropped(event: CdkDragDrop<any>) {
    const hash = makeid();
    const label = event.item.element.nativeElement.id;
    const displayName = `Unnamed ${label}`;

    // Get DOM coordinate of dropped node relative to container DOM
    const nodeCoord: DOMRect = document.getElementById(label)
      .getBoundingClientRect() as DOMRect;
    const containerCoord: DOMRect = document.getElementById('drawing-tool-view-container')
      .getBoundingClientRect() as DOMRect;
    const x = this.transform.invertX(nodeCoord.x - containerCoord.x + event.distance.x);
    const y = this.transform.invertY(nodeCoord.y + event.distance.y);

    this.execute(new NodeCreation(
      `Create ${label} node`, {
        display_name: displayName,
        hash,
        label,
        sub_labels: [],
        data: {
          x,
          y,
        }
      }
    ));
  }

  /**
   * Handle a map being dropped onto the canvas.
   * @param event object representing a drag-and-drop event
   */
  mapDropped(event: CdkDragDrop<any>) {
    const nativeElement = event.item.element.nativeElement;

    const hash = makeid();
    const mapId = nativeElement.id;
    const mapName = nativeElement.children[0].textContent;
    const source = '/dt/map/' + mapId;

    // Get DOM coordinate of dropped node relative to container DOM
    const nodeCoord: DOMRect = document.getElementById(mapId)
      .getBoundingClientRect() as DOMRect;
    const containerCoord: DOMRect = document.getElementById('drawing-tool-view-container')
      .getBoundingClientRect() as DOMRect;
    const x = this.transform.invertX(nodeCoord.x - containerCoord.x + event.distance.x + 100);
    const y = this.transform.invertY(nodeCoord.y + event.distance.y + 80);

    this.execute(new NodeCreation(
      `Add '${mapName}' map to graph`, {
        display_name: mapName,
        hash,
        label: 'map',
        sub_labels: [],
        data: {
          x,
          y,
          source,
        }
      }
    ));
  }

  /**
   * Handle a file being dropped onto the canvas.
   * @param node the node being dropped
   */
  fileDropped(node: GraphData) {
    if (!node) {
      return;
    }

    const hash = makeid();
    const fileName = node.label;
    const x = this.transform.invertX(node.x);
    const y = this.transform.invertY(node.y);

    this.execute(new NodeCreation(
      `Add '${fileName}' map to graph`, {
        display_name: fileName,
        hash,
        label: node.group,
        sub_labels: [],
        data: {
          x,
          y,
          ...node.data,
        }
      }
    ));
  }

  // ========================================
  // Graph modification routines
  // ========================================

  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void {
    this.nodes.push(node);
    this.requestRender();
  }

  /**
   * Remove the given node from the graph.
   * @param node the node
   * @return true if the node was found
   */
  removeNode(node: UniversalGraphNode): boolean {
    let found = false;

    let i = this.nodes.length;
    while (i--) {
      if (this.nodes[i] === node) {
        this.nodes.splice(i, 1);
        found = true;
      }
    }

    let j = this.edges.length;
    while (j--) {
      if (this.nodeReference(this.edges[j].from) === node
        || this.nodeReference(this.edges[j].to) === node) {
        this.edges.splice(j, 1);
      }
    }

    return found;
  }

  /**
   * Select an entity.
   * @param entity the entity
   */
  select(entity: GraphEntity) {
    this.selected = entity;
    this.dataFlow.pushSelection(entity);
  }

  // ========================================
  // History
  // ========================================

  /**
   * Perform an undo, if there is anything to undo.
   * @return true if there was something to undo
   */
  undo(): boolean {
    // Check to see if there is anything to undo
    if (this.nextHistoryIndex > 0) {
      this.nextHistoryIndex--;
      this.history[this.nextHistoryIndex].rollback(this);
      this.requestRender();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Perform a redo, if there is anything to redo.
   * @return true if there was something to redo
   */
  redo(): boolean {
    // Check to see if there is anything to redo
    if (this.nextHistoryIndex < this.history.length) {
      this.history[this.nextHistoryIndex].apply(this);
      this.nextHistoryIndex++;
      this.requestRender();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Execute an action and store the action to the history stack, while also resetting the
   * history pointer.
   * @param action the action to execute
   */
  execute(action: GraphAction): void {
    // We have unsaved changes
    // this.saveState = false;  // TODO: remove this

    // Drop all changes after this one
    this.history = this.history.slice(0, this.nextHistoryIndex);
    this.history.push(action);
    this.nextHistoryIndex++;

    // Apply the change
    action.apply(this);
  }

  // ========================================
  // TODO
  // ========================================

  updateCursorDocumentPos(event: MouseEvent) {
    this.cursorDocumentPos = {
      x: event.clientX - 59, // The canvas is offset a bit by the toolbar menu, so we modify the x-pos a bit here
      y: event.clientY,
    };
  }

  setupCtrlVPasteOnCanvas() {
    const visCanvas = document.querySelector('#canvas');

    // We need to get the cursor coords the first time the user clicks the canvas (i.e. when they focus it for the first time).
    // Otherwise they would be undefined if the user focused the canvas but didn't move the mouse at all and tried to paste.
    (fromEvent(visCanvas, 'click') as Observable<MouseEvent>).pipe(
      first(),
    ).subscribe((event) => {
      this.updateCursorDocumentPos(event);
    });

    // When the canvas is focused, keep track of where the mouse is so we know where to paste
    visCanvas.addEventListener('focusin', () => {
      // We should take great care with this listener, as it fires VERY often if we don't
      // properly debounce it
      this.mouseMoveEventStream = fromEvent(visCanvas, 'mousemove').pipe(
        debounceTime(25),
        takeUntil(this.endMouseMoveEventSource),
      ) as Observable<MouseEvent>;

      this.mouseMoveSub = this.mouseMoveEventStream.subscribe((event) => {
        this.updateCursorDocumentPos(event);
      });

      // We also want to keep track of when the "Paste" command is issued by the user
      this.pasteEventStream = (fromEvent(visCanvas, 'keydown') as Observable<KeyboardEvent>).pipe(
        filter(event => keyCodeRepresentsPasteEvent(event)),
        takeUntil(this.endPasteEventSource),
      );

      this.pasteSub = this.pasteEventStream.subscribe(() => {
        this.createLinkNodeFromClipboard(this.cursorDocumentPos);
      });
    });

    // If the canvas isn't focused, we don't care where the mouse is, nor do we care about catching paste events
    visCanvas.addEventListener('focusout', () => {
      // This will complete the mouseMoveEventStream observable, and the corresponding mouseMoveSub
      this.endMouseMoveEventSource.next(true);

      // Similar to above
      this.endPasteEventSource.next(true);
    });
  }

  /**
   * Handle closing or opening apps
   * @param app - any app such as pdf-viewer, map-search, kg-visualizer
   */
  toggle(app, arg = null) {
    if (this.currentApp === app) {
      // Shutdown app
      this.openApp.emit(null);
    } else {
      // Open app
      this.openApp.emit({
        app,
        arg
      });
    }
  }

  toggleApp(appCmd: LaunchApp) {
    this.openApp.emit(appCmd);
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
  }

  /**
   * Asks for the format to download the map
   */
  download() {
    if (!this.saveState) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {

      const dialogConfig = new MatDialogConfig();
      dialogConfig.autoFocus = true;
      dialogConfig.panelClass = 'export-dialog';

      const dialogRef = this.dialog.open(ExportModalComponent, dialogConfig);
      dialogRef.afterClosed().subscribe(fileFormat => {
        if (fileFormat === 'pdf') {
          this.downloadPDF();
        }
        if (fileFormat === 'svg') {
          this.downloadSVG();
        }
        if (fileFormat === 'png') {
          this.downloadPNG();
        }
      });

    }

  }

  /**
   * Saves and downloads the PDF version of the current map
   */
  downloadPDF() {
    if (!this.saveState) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {
      this.projectService.getPDF(this.project).subscribe(resp => {
        // It is necessary to create a new blob object with mime-type explicitly set
        // otherwise only Chrome works like it should
        const newBlob = new Blob([resp], {
          type: 'application/pdf'
        });

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(newBlob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(newBlob);

        const link = document.createElement('a');
        link.href = data;
        link.download = this.project.label + '.pdf';
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
      });
    }
  }


  /**
   * Saves and downloads the SVG version of the current map
   */
  downloadSVG() {
    if (!this.saveState) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {
      this.projectService.getSVG(this.project).subscribe(resp => {
        // It is necessary to create a new blob object with mime-type explicitly set
        // otherwise only Chrome works like it should
        const newBlob = new Blob([resp], {
          type: 'image/svg'
        });

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(newBlob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(newBlob);

        const link = document.createElement('a');
        link.href = data;
        link.download = this.project.label + '.svg';
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
      });
    }
  }


  /**
   * Saves and downloads the PNG version of the current map
   */
  downloadPNG() {
    if (!this.saveState) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {
      this.projectService.getPNG(this.project).subscribe(resp => {
        // It is necessary to create a new blob object with mime-type explicitly set
        // otherwise only Chrome works like it should
        const newBlob = new Blob([resp], {
          type: 'image/png'
        });

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(newBlob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(newBlob);

        const link = document.createElement('a');
        link.href = data;
        link.download = this.project.label + '.png';
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
      });
    }
  }


  // -- Helpers --
  /**
   * Build key,value pair style dict
   * from nodeTemplate
   * @param nodeTemplate represents a node object
   */
  nodeStyleCompute(nodeTemplate) {
    return {
      color: nodeTemplate.color,
      background: nodeTemplate.background
    };
  }

  fitAll() {
  }

  // TODO LL-233
  removeNodes(nodes: IdType[]) {
  }

  // TODO LL-233
  removeEdges(edges: IdType[]) {
  }

  /**
   * Selects the neighbors of the currently selected node.
   * @param node the ID of the node whose neighbors are being selected
   */
  selectNeighbors(node: IdType) {
  }

  /**
   * Saves the selected nodes and edges to the CopyPaste service.
   *
   * For every edge, we check if both connected nodes have also been selected. If not, then we
   * discard the edge.
   */
  copySelection() {
  }

  // TODO LL-233
  pasteSelection() {
    // Implement me!
  }

  async createLinkNodeFromClipboard(coords: Coords2D) {
  }


  // ========== to do move ============

  getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) {
    if (!intersects.pointLine(x, y, x1, y1, x2, y2)) {
      return Infinity;
    }
    const expectedSlope = (y2 - y1) / (x2 - x1);
    const slope = (y - y1) / (x - x1);
    return Math.abs(slope - expectedSlope);
  }

  pointOnRect(x, y, minX, minY, maxX, maxY, validate) {
    if (validate && (minX < x && x < maxX) && (minY < y && y < maxY)) {
      return {x, y};
    }
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    // if (midX - x == 0) -> m == ±Inf -> minYx/maxYx == x (because value / ±Inf = ±0)
    const m = (midY - y) / (midX - x);

    if (x <= midX) { // check "left" side
      const minXy = m * (minX - x) + y;
      if (minY <= minXy && minXy <= maxY) {
        return {x: minX, y: minXy};
      }
    }

    if (x >= midX) { // check "right" side
      const maxXy = m * (maxX - x) + y;
      if (minY <= maxXy && maxXy <= maxY) {
        return {x: maxX, y: maxXy};
      }
    }

    if (y <= midY) { // check "top" side
      const minYx = (minY - y) / m + x;
      if (minX <= minYx && minYx <= maxX) {
        return {x: minYx, y: minY};
      }
    }

    if (y >= midY) { // check "bottom" side
      const maxYx = (maxY - y) / m + x;
      if (minX <= maxYx && maxYx <= maxX) {
        return {x: maxYx, y: maxY};
      }
    }

    // edge case when finding midpoint intersection: m = 0/0 = NaN
    if (x === midX && y === midY) {
      return {x, y};
    }

    // Should never happen :) If it does, please tell me!
    return {x, y};
  }
}
