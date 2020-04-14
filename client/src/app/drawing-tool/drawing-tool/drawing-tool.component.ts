import {
    Component,
    OnInit,
    AfterViewInit,
    OnDestroy,
    HostListener,
    Output,
    EventEmitter,
    Input,
    ViewChild
  } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { Options } from '@popperjs/core';

import * as $ from 'jquery';

import {
    Subscription, Observable, fromEvent, Subject
} from 'rxjs';
import { filter, first, takeUntil, debounceTime } from 'rxjs/operators';

import { IdType } from 'vis-network';

import { Coords2D } from 'app/interfaces/shared.interface';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { keyCodeRepresentsPasteEvent } from 'app/shared/utils';

import {
    NetworkVis
} from '../network-vis';
import {
    DataFlowService,
    ProjectsService,
    nodeTemplates,
    makeid
} from '../services';
import {
    GraphData,
    Project,
    VisNetworkGraphEdge,
    VisNetworkGraphNode,
    VisNetworkGraph
} from '../services/interfaces';
import { DrawingToolContextMenuControlService } from '../services/drawing-tool-context-menu-control.service';
import { CopyPasteMapsService } from '../services/copy-paste-maps.service';

import {
    InfoPanelComponent
} from './info-panel/info-panel.component';

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
    @Output() openApp: EventEmitter<string> = new EventEmitter<string>();
    /** Communicate which app is active for app icon presentation */
    @Input() currentApp = '';

    @ViewChild(InfoPanelComponent, {static: false}) infoPanel: InfoPanelComponent;

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
    currentGraphState: {edges: VisNetworkGraphEdge[], nodes: VisNetworkGraphNode[]} = null;

    undoStack: Action[] = [];
    redoStack: Action[] = [];

    /** Obj representation of knowledge model with metadata */
    project: Project = null;
    /** vis.js network graph DOM instantiation */
    visjsNetworkGraph: NetworkVis = null;
    /** Whether or not graph is saved from modification */
    saveState = true;

    /** Render condition for dragging gesture of edge formation */
    addMode = false;
    /** Node part of dragging gesture for edge formation  */
    node4AddingEdge2;

    /** Build the palette ui with node templates defined */
    nodeTemplates = nodeTemplates;

    /**
     * Subscription for subjects
     * to quit in destroy lifecycle
     */
    formDataSubscription: Subscription = null;
    pdfDataSubscription: Subscription = null;

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
    ) {}

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
        this.pdfDataSubscription = this.dataFlow.$pdfDataSource.subscribe((node: GraphData) => {
            if (!node) { return; }

            // Convert DOM coordinate to canvas coordinate
            const coord =
            this.visjsNetworkGraph
                .network.DOMtoCanvas({x: node.x, y: node.y});

            // TODO ADD NODE
            const cmd = {
                action: 'add node',
                data: {
                    label: node.label,
                    group: node.group,
                    x: coord.x,
                    y: coord.y,
                    hyperlink: node.hyperlink
                }
            };
            this.recordCommand(cmd);
        });

        // Listen for graph update from info-panel-ui
        this.formDataSubscription = this.dataFlow.formDataSource.subscribe((update: Update) => {
            if (!update) { return; }

            const event = update.event;
            const type = update.type;

            if (event === 'delete' &&  type === 'node') {
                // TODO REMOVE NODE
                const cmd = {
                    action: 'delete node',
                    data: update.data as VisNetworkGraphNode
                };
                this.recordCommand(cmd);
            } else if (event === 'delete' &&  type === 'edge') {
                // TODO REMOVE EDGE
                const cmd = {
                    action: 'delete edge',
                    data: update.data as VisNetworkGraphEdge
                };
                this.recordCommand(cmd);
            } else if (event === 'update' && type === 'node') {
                // TODO UPDATE NODE
                const cmd = {
                    action: 'update node',
                    data: update.data as {
                        node: VisNetworkGraphNode,
                        edges: VisNetworkGraphEdge[]
                    }
                };
                this.recordCommand(cmd);
            } else if (event === 'update' && type === 'edge') {
                // TODO UPDATE EDGE
                const cmd = {
                    action: 'update edge',
                    data: update.data as VisNetworkGraphEdge
                };
                this.recordCommand(cmd);
            }
        });
    }

    ngAfterViewInit() {
        setTimeout(() => {
            // Init network graph object
            this.visjsNetworkGraph = new NetworkVis(
                document.getElementById('canvas')
            );

            // Listen for project sent from project-list view
            this.dataFlow.$projectlist2Canvas.subscribe((project) => {
                if (!project) { return; }

                this.project = project;

                // Convert graph from universal to vis.js format
                const g = this.projectService.universe2Vis(project.graph);

                // Draw graph around data
                this.visjsNetworkGraph.draw(
                    g.nodes,
                    g.edges
                );

                /**
                 * Event handlers
                 */
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
                        if (properties.nodes.length) {
                            this.saveState = false;
                        }
                    }
                );
                // Listen for mouse movement on canvas to feed to handler
                $('#canvas > div > canvas').on('mousemove',
                    (e) => this.edgeFormationRenderer(e)
                );
            });
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
    toggle(app) {
        if (this.currentApp === app) {
            // Shutdown app
            this.openApp.emit(null);
        } else {
            // Open app
            this.openApp.emit(app);
        }
    }

    /**
     * Checks if an undo or redo action contains a graph update
     * affecting the focused entity and push update to info-panel
     * @param graph - represent a network
     */
    shouldIUpdateInfoPanel(graph: VisNetworkGraph) {
        if (!this.infoPanel.graphData.id) { return; }

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
                const addedNode = this.visjsNetworkGraph.addNode({...cmd.data});
                // Toggle info-panel-ui for added node
                const data = this.visjsNetworkGraph.getNode(addedNode.id);
                this.dataFlow.pushGraphData(data);
                break;
            case 'update node':
                // Update node
                this.visjsNetworkGraph.updateNode(
                    cmd.data.node.id,
                    {
                        label: cmd.data.node.label,
                        group: cmd.data.node.group,
                        data: cmd.data.node.data
                    }
                );
                // Update edges of node
                cmd.data.edges.map(e => {
                    this.visjsNetworkGraph.updateEdge(
                        e.id,
                        {
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
        const nodeType = event.item.element.nativeElement.id;
        const label = `${nodeType}-${makeid()}`;

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
        const coord = this.visjsNetworkGraph.network.DOMtoCanvas({x, y});

        // TODO ADD NODE
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
     * Save the current representation of knowledge model
     */
    save() {
        // Export the graph from vis_js instance object
        const graph = this.visjsNetworkGraph.export();

        // Convert it to universal representation ..
        this.project.graph = this.projectService.vis2Universe(graph);
        this.project.date_modified = new Date().toISOString();

        // Push to backend to save
        this.projectService.updateProject(this.project).subscribe(() => {
            this.saveState = true;
            this.snackBar.open('Project is saved', null, {
                duration: 2000,
            });
        });
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
            this.projectService.getPDF(this.project).subscribe (resp => {
                // It is necessary to create a new blob object with mime-type explicitly set
                // otherwise only Chrome works like it should
                const newBlob = new Blob([resp], { type: 'application/pdf' });

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
                link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

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
        if (!properties.nodes.length) { return; }

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
        const addedNode = this.visjsNetworkGraph.addNode(
            {
                size: 0,
                shape: 'dot',
                id: 'EDGE_FORMATION_DRAGGING',
                x: coord.x - 5,
                y: coord.y - 5
            }
        );

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

                // TODO ADD EDGE
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
        if (!this.addMode) { return; }

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
        const canvasCoords = this.visjsNetworkGraph.network.DOMtoCanvas({x: coords.x, y: coords.y});
        const cmd = {
            action: 'add node',
            data: {
                // TODO: Add clipboard data here
                group: 'link',
                label: clipboardContent,
                ...canvasCoords
            }
        };
        this.recordCommand(cmd);
    }
}
