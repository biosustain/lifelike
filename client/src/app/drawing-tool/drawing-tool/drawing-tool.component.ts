import { AfterViewInit, Component, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Options } from '@popperjs/core';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { DataFlowService, makeid, ProjectsService } from '../services';
import {LaunchApp, NODE_TYPE_ID, Project, UniversalGraphNode} from '../services/interfaces';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';
import { CopyPasteMapsService } from '../services/copy-paste-maps.service';

import { InfoPanelComponent } from './info-panel/info-panel.component';
import { ExportModalComponent } from './export-modal/export-modal.component';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { ClipboardKeyboardShortcut } from '../../graph-viewer/renderers/canvas/behaviors/clipboard-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './drawing-tool.component.html',
  styleUrls: ['./drawing-tool.component.scss'],
  providers: [ClipboardService],
})
export class DrawingToolComponent implements OnInit, AfterViewInit, OnDestroy, ModuleAwareComponent {
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild(InfoPanelComponent, {static: false}) infoPanel: InfoPanelComponent;
  @ViewChild('canvas', {static: true}) canvasChild;

  @Input() currentMap: string | undefined;
  project: Project = null;

  graphCanvas: CanvasGraphView;

  formDataSubscription: Subscription = null;
  pdfDataSubscription: Subscription = null;

  contextMenuTooltipSelector: string;
  contextMenuTooltipOptions: Partial<Options>;

  selectionSubscription: Subscription;
  unsavedChangesSubscription: Subscription;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  constructor(
    private dataFlow: DataFlowService,
    private drawingToolContextMenuControlService: DrawingToolContextMenuControlService,
    private projectService: ProjectsService,
    private snackBar: MatSnackBar,
    private copyPasteMapsService: CopyPasteMapsService,
    private clipboardService: ClipboardService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private route: ActivatedRoute,
  ) {
    if (this.route.snapshot.params.hash_id) {
      this.currentMap = this.route.snapshot.params.hash_id;
    }
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
    this.graphCanvas = new CanvasGraphView(this.canvasChild.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
    });

    this.graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('clipboard-keyboard-shortcut', new ClipboardKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shorts', new HistoryKeyboardShortcuts(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('selection', new SelectableEntity(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('resize-handles', new HandleResizable(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('edge-creation', new InteractiveEdgeCreation(this.graphCanvas), 100);

    this.graphCanvas.startParentFillResizeListener();
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startAnimationLoop();
    });

    // Pass selections onto the data flow system
    this.selectionSubscription = this.graphCanvas.selection.changeObservable.subscribe(([selected, previousSelected]) => {
      if (selected.length === 1) {
        this.dataFlow.pushSelection(selected[0]);
      } else {
        this.dataFlow.pushSelection(null);
      }
    });

    this.unsavedChangesSubscription = this.graphCanvas.historyChanges$.subscribe(() => {
      this.unsavedChanges$.next(true);
    });

    this.loadMap(this.currentMap);
  }

  ngOnDestroy() {
    this.formDataSubscription.unsubscribe();
    this.pdfDataSubscription.unsubscribe();
    this.selectionSubscription.unsubscribe();
    this.unsavedChangesSubscription.unsubscribe();
    this.graphCanvas.destroy();
  }

  shouldConfirmUnload() {
    return this.unsavedChanges$.getValue();
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
        this.modulePropertiesChange.emit({
          title: this.project.label,
          fontAwesomeIcon: 'project-diagram',
        });
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
      this.unsavedChanges$.next(false);
      this.snackBar.open('Map saved', null, {
        duration: 2000,
      });
    });
  }

  // ========================================
  // Event handlers
  // ========================================

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  // Drop events
  // ---------------------------------

  /**
   * Handle something being dropped onto the canvas.
   * @param event object representing a drag-and-drop event
   */
  drop(event: CdkDragDrop<any>) {
    const item = event.item;
    const data = item.data;
    if (data != null && data.type === NODE_TYPE_ID) {
      const node = data.node as UniversalGraphNode;
      const hoverPosition = this.graphCanvas.hoverPosition;

      if (hoverPosition != null) {
        this.graphCanvas.execute(new NodeCreation(
          `Create ${node.display_name} node`, {
            hash: makeid(),
            ...node,
            data: {
              ...node.data,
              x: hoverPosition.x,
              y: hoverPosition.y,
            }
          }
        ));
      }
    }
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
    if (this.unsavedChanges$.getValue()) {
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
    if (this.unsavedChanges$.getValue()) {
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
    if (this.unsavedChanges$.getValue()) {
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
    if (this.unsavedChanges$.getValue()) {
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
}
