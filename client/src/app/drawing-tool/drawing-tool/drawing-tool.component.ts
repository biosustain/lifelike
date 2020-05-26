import { AfterViewInit, Component, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Options } from '@popperjs/core';

import { fromEvent, Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { keyCodeRepresentsCopyEvent, keyCodeRepresentsPasteEvent } from 'app/shared/utils';
import { DataFlowService, makeid, ProjectsService } from '../services';
import { LaunchApp, Project, UniversalGraphNode } from '../services/interfaces';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';
import { CopyPasteMapsService } from '../services/copy-paste-maps.service';

import { InfoPanelComponent } from './info-panel/info-panel.component';
import { ExportModalComponent } from './export-modal/export-modal.component';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { GraphCanvasView } from 'app/graph-viewer/renderers/canvas/graph-canvas-view';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './drawing-tool.component.html',
  styleUrls: ['./drawing-tool.component.scss'],
  providers: [ClipboardService],
})
export class DrawingToolComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() openApp: EventEmitter<LaunchApp> = new EventEmitter<LaunchApp>();
  @Input() currentApp = '';

  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild(InfoPanelComponent, {static: false}) infoPanel: InfoPanelComponent;
  @ViewChild('canvas', {static: true}) canvasChild;

  @Input() currentMap: string | undefined;
  project: Project = null;

  graphCanvas: GraphCanvasView;

  keyboardEventObservable: Observable<KeyboardEvent>;
  keyboardCopyEventSubscription: Subscription;
  keyboardPasteEventSubscription: Subscription;

  formDataSubscription: Subscription = null;
  pdfDataSubscription: Subscription = null;

  contextMenuTooltipSelector: string;
  contextMenuTooltipOptions: Partial<Options>;

  selectionSubscription: Subscription;

  SAVE_STATE = true;

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
    this.contextMenuTooltipSelector = '#***ARANGO_USERNAME***-menu';
    this.contextMenuTooltipOptions = {
      placement: 'right-start',
    };

    // Listen for node addition from pdf-viewer
    this.pdfDataSubscription = this.dataFlow.$pdfDataSource.subscribe(
      (node) => this.fileDropped(node)
    );

    // Listen for graph update from info-panel-ui
    this.formDataSubscription = this.dataFlow.formDataSource.subscribe(action => {
      this.graphCanvas.execute(action);
    });
  }

  ngAfterViewInit() {
    const style = new KnowledgeMapStyle();
    this.graphCanvas = new GraphCanvasView(this.canvasChild.nativeElement as HTMLCanvasElement, style, style);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), -101);
    this.graphCanvas.behaviors.add('selection', new SelectableEntity(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('edge-creation', new InteractiveEdgeCreation(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('handle-resizing', new HandleResizable(this.graphCanvas), 0);
    this.graphCanvas.backgroundFill = '#f2f2f2';
    this.graphCanvas.startParentFillResizeListener();

    // Handle pasting
    this.keyboardEventObservable = (fromEvent(window, 'keydown') as Observable<KeyboardEvent>);
    this.keyboardCopyEventSubscription = this.keyboardEventObservable.pipe(
      filter(event => keyCodeRepresentsCopyEvent(event)),
    ).subscribe(this.copied.bind(this));
    this.keyboardPasteEventSubscription = this.keyboardEventObservable.pipe(
      filter(event => keyCodeRepresentsPasteEvent(event)),
    ).subscribe(this.pasted.bind(this));

    // Pass selections onto the data flow system
    this.selectionSubscription = this.graphCanvas.selection.changeObservable.subscribe(([selected, previousSelected]) => {
      if (selected.length === 1) {
        this.dataFlow.pushSelection(selected[0]);
      } else {
        this.dataFlow.pushSelection(null);
      }
    });

    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startAnimationLoop();
    });

    this.loadMap(this.currentMap);
  }

  ngOnDestroy() {
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();
    this.keyboardCopyEventSubscription.unsubscribe();
    this.keyboardPasteEventSubscription.unsubscribe();
    this.selectionSubscription.unsubscribe();
    this.graphCanvas.destroy();
  }

  // ========================================
  // States
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
        this.graphCanvas.zoomToFit(0);
      }
    );
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

  get saveState() {
    return this.SAVE_STATE;
  }

  set saveState(val) {
    this.SAVE_STATE = val;
    // communicate to parent component of save state change
    this.saveStateListener.emit(this.SAVE_STATE);
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

  /**
   * Handle copying from the clipboard.
   */
  copied() {
    // TODO: Implement copying from the graph
  }

  /**
   * Handle pasting from the clipboard.
   */
  pasted() {
    this.clipboardService.readClipboard().then(content => {
      const position = this.graphCanvas.currentHoverPosition;

      if (position != null) {
        this.graphCanvas.execute(new NodeCreation(
          `Paste content from clipboard`, {
            display_name: 'note',
            hash: makeid(),
            label: 'note',
            sub_labels: [],
            data: {
              x: position.x,
              y: position.y,
              detail: content,
            }
          }
        ));
      }
    });
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
  fileDropped(node: UniversalGraphNode) {
    if (!node) {
      return;
    }

    const hash = makeid();
    const fileName = node.label;
    const x = this.graphCanvas.transform.invertX(node.data.x);
    const y = this.graphCanvas.transform.invertY(node.data.y);

    this.graphCanvas.execute(new NodeCreation(
      `Add '${fileName}' map to graph`, {
        ...node,
        hash,
        sub_labels: [],
        data: {
          ...node.data,
          x,
          y,
        }
      }
    ));
  }

  // ========================================
  // Download
  // ========================================

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

  // ========================================
  // Template stuff
  // ========================================

  get saveStyle() {
    return {
      saved: this.saveState,
      not_saved: !this.saveState
    };
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

  /**
   * Handle closing or opening apps
   * @param app any app such as pdf-viewer, map-search, kg-visualizer
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
}
