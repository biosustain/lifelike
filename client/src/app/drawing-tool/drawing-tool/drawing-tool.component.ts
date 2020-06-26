import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  Output,
  EventEmitter,
  Input,
  ViewChild
} from '@angular/core';
import {
  MatSnackBar
} from '@angular/material/snack-bar';
import {
  CdkDragDrop
} from '@angular/cdk/drag-drop';

import {
  Options
} from '@popperjs/core';

import * as $ from 'jquery';

import {
  Subscription,
  Observable,
  fromEvent,
  Subject
} from 'rxjs';
import {
  filter,
  first,
  takeUntil,
  debounceTime
} from 'rxjs/operators';

import {
  IdType
} from 'vis-network';

import {
  LINK_NODE_ICON_OBJECT
} from 'app/constants';
import {
  Coords2D
} from 'app/interfaces/shared.interface';
import {
  ClipboardService
} from 'app/shared/services/clipboard.service';
import {
  keyCodeRepresentsPasteEvent
} from 'app/shared/utils';

import {
  NetworkVis
} from '../network-vis';
import {
  DataFlowService,
  ProjectsService,
  makeid
} from '../services';
import {
  GraphData,
  Project,
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  VisNetworkGraph,
  LaunchApp
} from '../services/interfaces';
import {
  DrawingToolContextMenuControlService
} from '../services/drawing-tool-context-menu-control.service';
import {
  CopyPasteMapsService
} from '../services/copy-paste-maps.service';

import {
  InfoPanelComponent
} from './info-panel/info-panel.component';

import {
  RestoreProjectDialogComponent
} from './restore-project-dialog/restore-project-dialog.component';

import {annotationTypes} from 'app/shared/annotation-styles';
import {ExportModalComponent} from './export-modal/export-modal.component';
import {MatDialog, MatDialogConfig} from '@angular/material/dialog';

interface Update {
  event: string;
  type: string;
  data: object | string | number;
}

interface Graph {
  edges: VisNetworkGraphEdge[];
  nodes: VisNetworkGraphNode[];
}

interface Command {
  action: string;
  data: {
    id?: string;
    label?: string;
    group?: string;
    x?: number;
    y?: number;
    source?: string;
    node?: VisNetworkGraphNode;
    edges?: VisNetworkGraphEdge[]
    edge?: VisNetworkGraphEdge;
  };
}

export interface Action {
  cmd: string;
  graph: Graph;
}

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './drawing-tool.component.html',
  styleUrls: ['./drawing-tool.component.scss'],
  providers: [ClipboardService],
})
export class DrawingToolComponent implements OnInit, AfterViewInit, OnDestroy {
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

  /** The current graph representation on canvas */
  currentGraphState: {
    edges: VisNetworkGraphEdge[],
    nodes: VisNetworkGraphNode[]
  } = null;

  undoStack: Action[] = [];
  redoStack: Action[] = [];

  /** Obj representation of knowledge model with metadata */
  project: Project = null;
  projectBackup: Project = null;
  /** vis.js network graph DOM instantiation */
  visjsNetworkGraph: NetworkVis = null;

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


  /** Render condition for dragging gesture of edge formation */
  addMode = false;
  /** Node part of dragging gesture for edge formation  */
  node4AddingEdge2;

  /** Build the palette ui with node templates defined */
  nodeTemplates = annotationTypes;

  /**
   * Subscription for subjects
   * to quit in destroy lifecycle
   */
  formDataSubscription: Subscription = null;
  pdfDataSubscription: Subscription = null;

  get saveStyle() {
    return {
      saved: this.saveState,
      not_saved: !this.saveState
    };
  }

  autoSaveIntervalId: number;

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
    this.setupCtrlVPasteOnCanvas();

    this.selectedNodes = [];
    this.selectedEdges = [];

    this.contextMenuTooltipSelector = '#root-menu';
    this.contextMenuTooltipOptions = {
      placement: 'right-start',
    };

    // Listen for node addition from pdf-viewer
    this.pdfDataSubscription = this.dataFlow.$pdfDataSource.subscribe(
      (node: GraphData) => this.dropPdf(node)
    );

    // Listen for graph update from info-panel-ui
    this.formDataSubscription = this.dataFlow.formDataSource.subscribe((update: Update) => {
      if (!update) {
        return;
      }

      const event = update.event;
      const type = update.type;

      if (event === 'delete' && type === 'node') {
        // DELETE NODE
        const cmd = {
          action: 'delete node',
          data: update.data as VisNetworkGraphNode
        };
        this.recordCommand(cmd);
      } else if (event === 'delete' && type === 'edge') {
        // DELETE EDGE
        const cmd = {
          action: 'delete edge',
          data: update.data as VisNetworkGraphEdge
        };
        this.recordCommand(cmd);
      } else if (event === 'update' && type === 'node') {
        // UPDATE NODE
        const cmd = {
          action: 'update node',
          data: update.data as {
            node: VisNetworkGraphNode,
            edges: VisNetworkGraphEdge[]
          }
        };
        this.recordCommand(cmd);
      } else if (event === 'update' && type === 'edge') {
        // UPDATE EDGE
        const cmd = {
          action: 'update edge',
          data: update.data as VisNetworkGraphEdge
        };
        this.recordCommand(cmd);
      }
    });

    this.autoSaveIntervalId = window.setInterval(() => {
      if (this.saveState || !this.project) {
        return;
      }
      const project = Object.assign({}, this.project);
      this.prepareProjectForPersistence(project);
      this.projectService.uploadProjectBackup(project).subscribe();
    }, 60000);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      // Init network graph object
      this.visjsNetworkGraph = new NetworkVis(
        document.getElementById('canvas')
      );
      this.openMap(this.currentMap);
    });
  }

  ngOnDestroy() {
    // Unsubscribe from subscriptions
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();

    // Reset BehaviorSubjects form dataFlow service
    this.dataFlow.pushGraphData(null);
    this.dataFlow.pushGraphUpdate(null);
    this.dataFlow.pushNode2Canvas(null);

    // Complete the vis canvas element event listeners
    this.endMouseMoveEventSource.complete();
    this.endPasteEventSource.complete();

    window.clearInterval(this.autoSaveIntervalId);
  }

  private prepareMap() {
    // Convert graph from universal to vis.js format
    const g = this.projectService.universe2Vis(this.project.graph);

    // Draw graph around data
    this.visjsNetworkGraph.draw(
      g.nodes,
      g.edges
    );

    // Event handlers
    this.visjsNetworkGraph.network.on(
      'click',
      (properties) => this.networkClickHandler(properties)
    );
    this.visjsNetworkGraph.network.on(
      'doubleClick',
      (properties) => this.networkDoubleClickHandler(properties)
    );
    this.visjsNetworkGraph.network.on(
      'oncontext',
      (properties) => this.networkOnContextCallback(properties)
    );
    this.visjsNetworkGraph.network.on(
      'dragStart',
      (properties) => this.networkDragStartCallback(properties)
    );
    // Listen for nodes moving on canvas
    this.visjsNetworkGraph.network.on(
      'dragEnd',
      (properties) => {
        // Dragging a node doesn't fire node selection, but it is selected after dragging finishes, so update
        this.updateSelectedNodes();
      }
    );
    // Listen for mouse movement on canvas to feed to handler
    $('#canvas > div > canvas').on('mousemove',
      (e) => this.edgeFormationRenderer(e)
    );
  }

  /**
   * Pull map from server by hash id and draw it onto canvas
   * @param hashId - identifier to pull by from the server
   */
  openMap(hashId: string) {
    this.projectService.serveProject(hashId)
      .subscribe(
        (resp: any) => {
          this.project = resp.project;
          this.prepareMap();
          this.projectService.downloadProjectBackup(this.project.hash_id).subscribe(
            (backup) => {
              this.projectBackup = backup;
              this.openRestoreMapDialog();
            },
            () => {}, // do not spam the console in case of 404
          );
        },
        err => console.log(err)
      );
  }

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

  updateSelectedNodes() {
    this.selectedNodes = this.visjsNetworkGraph.network.getSelectedNodes();
  }

  updateSelectedEdges() {
    this.selectedEdges = this.visjsNetworkGraph.network.getSelectedEdges();
  }

  updateSelectedNodesAndEdges() {
    this.updateSelectedNodes();
    this.updateSelectedEdges();
  }

  hideAllTooltips() {
    this.drawingToolContextMenuControlService.hideTooltip();
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
   * Checks if an undo or redo action contains a graph update
   * affecting the focused entity and push update to info-panel
   * @param graph - represent a network
   */
  shouldIUpdateInfoPanel(graph: VisNetworkGraph) {
    if (!this.infoPanel.graphData.id) {
      return;
    }

    const currentEntity = this.infoPanel.graphData;
    const currentEntityType = this.infoPanel.entityType;

    if (currentEntityType === 'node') {
      const nodeIds = graph.nodes.map(n => n.id);
      if (nodeIds.includes(currentEntity.id)) {
        const data = this.visjsNetworkGraph.getNode(currentEntity.id);
        this.dataFlow.pushGraphData(data);
      } else {
        this.infoPanel.reset();
      }
    } else {
      const edgeIds = graph.edges.map(e => e.id);
      if (edgeIds.includes(currentEntity.id)) {
        const data = this.visjsNetworkGraph.getEdge(currentEntity.id);
        this.dataFlow.pushGraphData(data);
      } else {
        this.infoPanel.reset();
      }
    }
  }

  undo() {
    // Pop the action from undo stack
    const undoAction = this.undoStack.pop();

    // Record the current state of graph into redo action
    const redoAction = {
      graph: Object.assign({}, this.visjsNetworkGraph.export()),
      cmd: undoAction.cmd
    };

    // Undo action
    this.visjsNetworkGraph.import(
      undoAction.graph
    );
    this.shouldIUpdateInfoPanel(undoAction.graph);

    // Push redo action into redo stack
    this.redoStack.push(redoAction);

    this.saveState = false;
  }

  redo() {
    // Pop the action from redo stack
    const redoAction = this.redoStack.pop();

    // Record the current state of graph into undo action
    const undoAction = {
      graph: Object.assign({}, this.visjsNetworkGraph.export()),
      cmd: redoAction.cmd
    };

    // Redo action
    this.visjsNetworkGraph.import(
      redoAction.graph
    );
    this.shouldIUpdateInfoPanel(redoAction.graph);

    // Push undo action into undo stack
    this.undoStack.push(undoAction);

    this.saveState = false;
  }

  /**
   * Process all modification cmd to the graph representation
   * @param cmd The cmd to execute and push to stack
   * @param push Whether or not to push to undo stack
   */
  recordCommand(cmd: Command) {
    this.saveState = false;

    this.currentGraphState = this.visjsNetworkGraph.export();

    this.undoStack.push({
      graph: Object.assign({}, this.currentGraphState),
      cmd: cmd.action
    });
    this.redoStack = [];


    switch (cmd.action) {
      case 'add node':
        // Add node to network graph
        const addedNode = this.visjsNetworkGraph.addNode({
          ...cmd.data
        });
        // Toggle info-panel-ui for added node
        const data = this.visjsNetworkGraph.getNode(addedNode.id);
        this.dataFlow.pushGraphData(data);
        break;
      case 'update node':
        // Update node
        this.visjsNetworkGraph.updateNode(
          cmd.data.node.id, {
            label: cmd.data.node.label,
            group: cmd.data.node.group,
            shape: cmd.data.node.shape || 'box',
            icon: cmd.data.node.icon,
            data: cmd.data.node.data
          }
        );
        // Update edges of node
        cmd.data.edges.map(e => {
          this.visjsNetworkGraph.updateEdge(
            e.id, {
              label: e.label,
              from: e.from,
              to: e.to
            }
          );
        });
        break;
      case 'delete node':
        this.visjsNetworkGraph.removeNode(cmd.data.id);
        break;
      case 'add edge':
        this.visjsNetworkGraph.addEdge(
          cmd.data.edge.from,
          cmd.data.edge.to
        );
        break;
      case 'update edge':
        this.visjsNetworkGraph.updateEdge(
          cmd.data.edge.id,
          cmd.data.edge
        );
        break;
      case 'delete edge':
        this.visjsNetworkGraph.removeEdge(cmd.data.id);
        break;
      default:
        break;
    }
  }

  /**
   * Event handler for node template dropping onto canvas
   * @param event object representing a drag-and-drop event
   */
  drop(event: CdkDragDrop<any>) {
    event.item.element.nativeElement.classList.contains('map-template') ?
      this.dropMap(event) : event.item.element.nativeElement.classList.contains('node-search-template') ?
      this.dropSearchNode(event) : this.dropNode(event);
  }

  /**
   * Handle drop events from the map list
   * @param event - represent map schema through dom element
   */
  dropMap(event: CdkDragDrop<any>) {
    const nativeElement = event.item.element.nativeElement;

    const mapId = nativeElement.id;
    const label = nativeElement.children[0].textContent;
    const source = '/dt/map/' + mapId;
    const hyperlink = window.location.host + source;

    // Get DOM coordinate of dropped node relative
    // to container DOM
    const nodeCoord: DOMRect =
      document
        .getElementById(mapId)
        .getBoundingClientRect() as DOMRect;
    const containerCoord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;
    const x =
      nodeCoord.x -
      containerCoord.x +
      event.distance.x + 100;
    const y =
      nodeCoord.y + event.distance.y + 80;

    // Convert DOM coordinate to canvas coordinate
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({
      x,
      y
    });

    // ADD NODE
    const cmd = {
      action: 'add node',
      data: {
        group: 'map',
        label,
        ...coord,
        source,
        hyperlink
      }
    };
    this.recordCommand(cmd);
  }

  dropSearchNode(event: CdkDragDrop<any>) {
    const data = event.item.data;
    const nativeElement = event.item.element.nativeElement;
    const nodeId = nativeElement.id;
    const nodeCoord: DOMRect =
      document
        .getElementById(nodeId)
        .getBoundingClientRect() as DOMRect;
    const containerCoord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;
    const x =
      nodeCoord.x -
      containerCoord.x +
      event.distance.x + 100;
    const y =
      nodeCoord.y + event.distance.y + 80;
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({
      x,
      y
    });

    const type = data.type.toLowerCase();
    const cmd = {
      action: 'add node',
      data: {
        group: type === 'snippet' ? 'study' : type === 'taxonomy' ? 'species' : type,
        label: data.name,
        hyperlink: data.link.changingThisBreaksApplicationSecurity,
        ...coord
      }
    };
    this.recordCommand(cmd);

  }

  /**
   * Event handler for node template dropping onto canvas
   * @param event object representing a drag-and-drop event
   */
  dropNode(event: CdkDragDrop<any>) {
    const nodeType = event.item.element.nativeElement.id;
    const label = `${nodeType}`;

    // Get DOM coordinate of dropped node relative
    // to container DOM
    const nodeCoord: DOMRect =
      document
        .getElementById(nodeType)
        .getBoundingClientRect() as DOMRect;
    const containerCoord: DOMRect =
      document
        .getElementById('drawing-tool-view-container')
        .getBoundingClientRect() as DOMRect;
    const x =
      nodeCoord.x -
      containerCoord.x +
      event.distance.x;
    const y =
      nodeCoord.y + event.distance.y + 16;

    // Convert DOM coordinate to canvas coordinate
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({
      x,
      y
    });

    // ADD NODE
    const cmd = {
      action: 'add node',
      data: {
        group: nodeType,
        label,
        ...coord
      }
    };
    this.recordCommand(cmd);
  }

  /**
   * Handle drawing node onto canvas accoridng to pdf payload
   * @param node - represent data of new node
   */
  dropPdf(node: GraphData) {
    if (!node) {
      return;
    }

    // Convert DOM coordinate to canvas coordinate
    const coord =
      this.visjsNetworkGraph
        .network.DOMtoCanvas({
        x: node.x,
        y: node.y
      });

    // ADD NODE
    const cmd = {
      action: 'add node',
      data: {
        label: node.label,
        group: node.group,
        x: coord.x,
        y: coord.y,
        ...node.data
      }
    };
    this.recordCommand(cmd);
  }

  /**
   * Save the current representation of knowledge model
   */
  save() {
    this.prepareProjectForPersistence(this.project);
    // Push to backend to save
    this.projectService.updateProject(this.project).subscribe(() => {
      this.projectService.deleteProjectBackup(this.project.hash_id).subscribe();
      this.saveState = true;
      this.snackBar.open('Map is saved', null, {
        duration: 2000,
      });
    });
  }

  private prepareProjectForPersistence(project: Project) {
    // Export the graph from vis_js instance object
    const graph = this.visjsNetworkGraph.export();
    // Convert it to universal representation
    project.graph = this.projectService.vis2Universe(graph);
    project.date_modified = (new Date()).toISOString();
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
    this.visjsNetworkGraph.zoom2All();
  }

  // -- Event Handlers --
  /**
   * Listen for double click event from vis.js Network
   * to handle
   * - initating addMode for drawing edges from source node
   * @param properties represents a double click event
   */
  networkDoubleClickHandler(properties) {
    if (!properties.nodes.length) {
      return;
    }

    // Set up rendering gesture for the node
    this.node4AddingEdge2 = properties.nodes[0];
    this.addMode = true;

    const e = properties.event.srcEvent;
    const canvasOffset = $('#canvas > div > canvas').offset();

    // Convert DOM coordinate to canvas coordinate
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({
      x: e.pageX - canvasOffset.left,
      y: e.pageY - canvasOffset.top
    });

    // Place placeholder node near mouse cursor
    const addedNode = this.visjsNetworkGraph.addNode({
      size: 0,
      shape: 'dot',
      id: 'EDGE_FORMATION_DRAGGING',
      x: coord.x - 5,
      y: coord.y - 5
    });

    // Add edge from selected node to placeholder node
    this.visjsNetworkGraph.addEdge(
      this.node4AddingEdge2,
      addedNode.id
    );
  }

  /**
   * Listen for click events from vis.js network
   * to handle certain events ..
   * - if a node is clicked on
   * - if a edge is clicked on
   * - if a node is clicked on during addMode
   * @param properties represents a network click event
   */
  networkClickHandler(properties) {
    this.hideAllTooltips();

    if (this.addMode) {
      if (properties.nodes.length) {
        const targetId = properties.nodes[0];

        // ADD EDGE
        const cmd = {
          action: 'add edge',
          data: {
            edge: {
              from: this.node4AddingEdge2,
              to: targetId
            }
          }
        };
        this.recordCommand(cmd);
      }

      // Reset dragging gesture rendering
      this.visjsNetworkGraph.removeNode(
        'EDGE_FORMATION_DRAGGING'
      );
      this.addMode = false;
    } else {
      if (properties.nodes.length) {
        // If a node is clicked on
        const nodeId = properties.nodes[0];
        const data = this.visjsNetworkGraph.getNode(nodeId);
        this.dataFlow.pushGraphData(data);
      } else if (properties.edges.length) {
        // If an edge is clicked on
        const edgeId = properties.edges[0];
        const data = this.visjsNetworkGraph.getEdge(edgeId);
        this.dataFlow.pushGraphData(data);
      }
    }
  }

  networkDragStartCallback(params: any) {
    this.hideAllTooltips();
    if (params.nodes.length) {
      this.saveState = false;

      // Track momvement of node
      this.recordCommand({
        action: 'move',
        data: null
      });
    }
  }

  networkOnContextCallback(params: any) {
    const hoveredNode = this.visjsNetworkGraph.network.getNodeAt(params.pointer.DOM);

    // Stop the browser from showing the normal context
    params.event.preventDefault();

    // Update the canvas location
    const canvas = document.querySelector('canvas').getBoundingClientRect() as DOMRect;

    const contextMenuXPos = params.pointer.DOM.x + canvas.x;
    const contextMenuYPos = params.pointer.DOM.y + canvas.y;

    this.drawingToolContextMenuControlService.updatePopper(contextMenuXPos, contextMenuYPos);

    const hoveredEdge = this.visjsNetworkGraph.network.getEdgeAt(params.pointer.DOM);
    const currentlySelectedNodes = this.visjsNetworkGraph.network.getSelectedNodes();
    const currentlySelectedEdges = this.visjsNetworkGraph.network.getSelectedEdges();

    if (hoveredNode !== undefined) {
      if (currentlySelectedNodes.length === 0 || !currentlySelectedNodes.includes(hoveredNode)) {
        this.visjsNetworkGraph.network.selectNodes([hoveredNode], false);
      }
    } else if (hoveredEdge !== undefined) {
      if (currentlySelectedEdges.length === 0 || !currentlySelectedEdges.includes(hoveredEdge)) {
        this.visjsNetworkGraph.network.selectEdges([hoveredEdge]);
      }
    } else {
      this.visjsNetworkGraph.network.unselectAll();
    }

    this.updateSelectedNodesAndEdges();

    this.drawingToolContextMenuControlService.showTooltip();
  }

  /**
   * Handler for mouse movement on canvas
   * to render edge formation gesture in addMode
   * @param e - used to pull vent coordinate
   */
  edgeFormationRenderer(e: JQuery.Event) {
    if (!this.addMode) {
      return;
    }

    const canvasOffset = $('#canvas > div > canvas').offset();

    // Convert DOM coordinate to canvas coordinate
    const coord = this.visjsNetworkGraph.network.DOMtoCanvas({
      x: e.pageX - canvasOffset.left,
      y: e.pageY - canvasOffset.top
    });

    // Render placeholder node near mouse cursor
    this.visjsNetworkGraph.network.moveNode(
      'EDGE_FORMATION_DRAGGING',
      coord.x - 5,
      coord.y - 5
    );
  }

  // TODO LL-233
  removeNodes(nodes: IdType[]) {
    nodes.map(nodeId => this.visjsNetworkGraph.removeNode(nodeId));
  }

  // TODO LL-233
  removeEdges(edges: IdType[]) {
    edges.map(nodeId => this.visjsNetworkGraph.removeEdge(nodeId));
  }

  /**
   * Selects the neighbors of the currently selected node.
   * @param node the ID of the node whose neighbors are being selected
   */
  selectNeighbors(node: IdType) {
    this.visjsNetworkGraph.network.selectNodes(this.visjsNetworkGraph.network.getConnectedNodes(node) as IdType[]);
    this.updateSelectedNodes();
  }

  /**
   * Saves the selected nodes and edges to the CopyPaste service.
   *
   * For every edge, we check if both connected nodes have also been selected. If not, then we
   * discard the edge.
   */
  copySelection() {
    const copiedNodeIds = this.selectedNodes;
    const copiedEdgeIds = this.selectedEdges.filter(edgeId => {
      const connectedNodes = this.visjsNetworkGraph.network.getConnectedNodes(edgeId);
      // If even one of the nodes connected to this edge is not in the list of copied nodes, abandon the edge
      // (we don't want to draw edges that don't have a src/dest).
      return connectedNodes.every(connectedNodeId => copiedNodeIds.includes(connectedNodeId));
    });

    this.copyPasteMapsService.copiedNodes = copiedNodeIds.map(nodeId => this.visjsNetworkGraph.getNode(nodeId).nodeData);
    this.copyPasteMapsService.copiedEdges = copiedEdgeIds.map(edgeId => this.visjsNetworkGraph.getEdge(edgeId).edgeData);
  }

  // TODO LL-233
  pasteSelection() {
    // Implement me!
  }

  async createLinkNodeFromClipboard(coords: Coords2D) {
    const clipboardContent = await this.clipboardService.readClipboard();
    const canvasCoords = this.visjsNetworkGraph.network.DOMtoCanvas({
      x: coords.x,
      y: coords.y
    });

    const cmd = {
      action: 'add node',
      data: {
        icon: LINK_NODE_ICON_OBJECT,
        group: 'note',
        label: 'note',
        detail: clipboardContent,
        ...canvasCoords
      }
    };
    this.recordCommand(cmd);
  }

  private openRestoreMapDialog() {
    const dialogRef = this.dialog.open(RestoreProjectDialogComponent, {
      width: '480px',
    });

    dialogRef.afterClosed().subscribe((restore: boolean) => {
      if (restore) {
        this.project = this.projectBackup;
        this.prepareMap();
        this.saveState = false;
      }
    });
  }
}
