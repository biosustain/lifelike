import { AfterViewInit, Component, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Options } from '@popperjs/core';

import { asyncScheduler, fromEvent, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, filter, first, takeUntil, throttleTime } from 'rxjs/operators';

import { IdType } from 'vis-network';

import { Coords2D } from 'app/interfaces/shared.interface';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { keyCodeRepresentsPasteEvent } from 'app/shared/utils';
import { DataFlowService, makeid, ProjectsService } from '../services';
import { GraphData, LaunchApp, Project, UniversalGraph } from '../services/interfaces';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';
import { CopyPasteMapsService } from '../services/copy-paste-maps.service';

import { InfoPanelComponent } from './info-panel/info-panel.component';
import { ExportModalComponent } from './export-modal/export-modal.component';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { GraphCanvasView } from 'app/graph-viewer/graph-canvas-view';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';

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
   * Stream of 'canvas needs resize' events that need to be debounced.
   */
  canvasResizePendingSubject = new Subject<[number, number]>();

  /**
   * Subscription for the pending resize observable.
   */
  canvasResizePendingSubscription: Subscription;

  /**
   * Observer that notices when the canvas' container resizes.
   */
  canvasResizeObserver: any; // TODO: TS does not have ResizeObserver defs yet

  /**
   * Observes changes in selection, which shows the edit panel.
   */
  selectionSubscription: Subscription;

  graphCanvas: GraphCanvasView;

  constructor(
    private dataFlow: DataFlowService,
    private drawingToolContextMenuControlService: DrawingToolContextMenuControlService,
    private projectService: ProjectsService,
    private snackBar: MatSnackBar,
    private copyPasteMapsService: CopyPasteMapsService,
    private clipboardService: ClipboardService,
    private dialog: MatDialog,
    private ngZone: NgZone
  ) {
  }

  // ========================================
  // Angular events
  // ========================================

  ngOnInit() {
    this.endMouseMoveEventSource = new Subject();
    this.endPasteEventSource = new Subject();

    this.selectedNodes = [];
    this.selectedEdges = [];

    this.contextMenuTooltipSelector = '#***ARANGO_USERNAME***-menu';
    this.contextMenuTooltipOptions = {
      placement: 'right-start',
    };

    // Listen for node addition from pdf-viewer
    this.pdfDataSubscription = this.dataFlow.$pdfDataSource.subscribe(
      (node: GraphData) => this.fileDropped(node)
    );

    // Listen for graph update from info-panel-ui
    this.formDataSubscription = this.dataFlow.formDataSource.subscribe((action: GraphAction) => {
      this.graphCanvas.execute(action);
    });
  }

  ngAfterViewInit() {
    this.graphCanvas = new GraphCanvasView(this.canvasChild.nativeElement as HTMLCanvasElement);

    // Pass selections onto the data flow system
    this.selectionSubscription = this.graphCanvas.selectionObservable.subscribe(entity => {
      this.dataFlow.pushSelection(entity);
    });

    // Handle resizing of the canvas, but doing it with a throttled stream
    // so we don't burn extra CPU cycles resizing repeatedly unnecessarily
    this.canvasResizePendingSubscription = this.canvasResizePendingSubject
      .pipe(throttleTime(250, asyncScheduler, {
        leading: true,
        trailing: true
      }))
      .subscribe(([width, height]) => {
        this.graphCanvas.setSize(width, height);
      });
    const pushResize = () =>
      this.canvasResizePendingSubject.next([
        this.canvasChild.nativeElement.clientWidth,
        this.canvasChild.nativeElement.clientHeight,
      ]);
    // @ts-ignore
    this.canvasResizeObserver = new window.ResizeObserver(pushResize);
    // TODO: Can we depend on ResizeObserver yet?
    this.canvasResizeObserver.observe(this.canvasChild.nativeElement.parentNode);
    pushResize();

    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startAnimationLoop();
    });

    this.loadMap(this.currentMap);
  }

  ngOnDestroy() {
    // Unsubscribe from subscriptions
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();

    // Complete the vis canvas element event listeners
    this.endMouseMoveEventSource.complete();
    this.endPasteEventSource.complete();

    this.canvasResizeObserver.disconnect();
    this.selectionSubscription.unsubscribe();
    this.graphCanvas.destroy();
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
        this.graphCanvas.setGraph(this.project.graph);
      }
    );
  }

  zoomToFit() {
    this.graphCanvas.zoomToFit();
  }

  startGraphLayout() {
    this.graphCanvas.startGraphLayout();
  }

  stopGraphLayout() {
    this.graphCanvas.stopGraphLayout();
  }

  undo() {
    this.graphCanvas.undo();
  }

  redo() {
    this.graphCanvas.redo();
  }

  // ========================================
  // Event handlers
  // ========================================

  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | boolean {
    // Prevent the user from leaving the page if work is left un-saved
    return this.saveState ? true : confirm(
      'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.'
    );
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
    const x = this.graphCanvas.transform.invertX(nodeCoord.x - containerCoord.x + event.distance.x);
    const y = this.graphCanvas.transform.invertY(nodeCoord.y + event.distance.y);

    this.graphCanvas.execute(new NodeCreation(
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
    const x = this.graphCanvas.transform.invertX(nodeCoord.x - containerCoord.x + event.distance.x + 100);
    const y = this.graphCanvas.transform.invertY(nodeCoord.y + event.distance.y + 80);

    this.graphCanvas.execute(new NodeCreation(
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
    const x = this.graphCanvas.transform.invertX(node.x);
    const y = this.graphCanvas.transform.invertY(node.y);

    this.graphCanvas.execute(new NodeCreation(
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
  // TODO
  // ========================================

  get saveStyle() {
    return {
      saved: this.saveState,
      not_saved: !this.saveState
    };
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
    this.project.graph = this.graphCanvas.getGraph();
    this.project.date_modified = new Date().toISOString();

    // Push to backend to save
    this.projectService.updateProject(this.project).subscribe(() => {
      this.saveState = true;
      this.snackBar.open('Map saved', null, {
        duration: 2000,
      });
    });
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
