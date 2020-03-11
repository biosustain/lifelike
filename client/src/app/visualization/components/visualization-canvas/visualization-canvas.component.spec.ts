import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { ToolbarMenuModule } from 'toolbar-menu';

import { DataSet } from 'vis-network';

import {
    Neo4jGraphConfig,
    GetSnippetsResult,
    GetClusterGraphDataResult,
    VisEdge,
    VisNode,
    DuplicateVisNode,
    DuplicateVisEdge,
} from 'app/interfaces';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuControlService } from '../../services/context-menu-control.service';
import { ReferenceTableControlService } from '../../services/reference-table-control.service';

import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { ReferenceTableComponent } from '../reference-table/reference-table.component';
import { SidenavClusterViewComponent } from '../sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from '../sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from '../sidenav-node-view/sidenav-node-view.component';
import { VisualizationQuickbarComponent } from '../../components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationCanvasComponent } from '../visualization-canvas/visualization-canvas.component';

describe('VisualizationCanvasComponent', () => {
    let fixture: ComponentFixture<VisualizationCanvasComponent>;
    let instance: VisualizationCanvasComponent;

    let contextMenuControlService: ContextMenuControlService;
    let referenceTableControlService: ReferenceTableControlService;

    let mockNodes: DataSet<VisNode>;
    let mockEdges: DataSet<VisEdge>;
    let mockConfig: Neo4jGraphConfig;
    let mockLegend: Map<string, string[]>;
    let mockCallbackParams: any;

    function mockNodeGenerator(nodeId: number, nodeDisplayName: string, nodeData?: any): VisNode {
        return {
            id: nodeId,
            label: 'Mock Node',
            data: nodeData,
            subLabels: ['Mock Node'],
            displayName: nodeDisplayName,
            expanded: false,
            primaryLabel: 'Mock Node',
            color: null,
        } as VisNode;
    }

    function mockEdgeGenerator(edgeId: number, fromNode: number, arrowDirection: string, toNode: number): VisEdge {
        return {
            id: edgeId,
            label: 'Mock Edge',
            data: { description: 'Mock Edge'},
            to: toNode,
            from: fromNode,
            arrows: arrowDirection,
        } as VisEdge;
    }

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                ToolbarMenuModule,
            ],
            declarations: [
                VisualizationCanvasComponent,
                MockComponents(
                    ContextMenuComponent,
                    ReferenceTableComponent,
                    SidenavClusterViewComponent,
                    SidenavEdgeViewComponent,
                    SidenavNodeViewComponent,
                    VisualizationCanvasComponent,
                    VisualizationQuickbarComponent,
                ),
            ],
            providers: [
                ContextMenuControlService,
                ReferenceTableControlService,
                VisualizationService,
            ],
        });
    });

    beforeEach(() => {
        // Mock Inputs
        mockNodes = new DataSet([
            mockNodeGenerator(1, 'Mock Node 1', {}),
            mockNodeGenerator(2, 'Mock Node 2', {}),
            mockNodeGenerator(3, 'Mock Node 3', {}),
        ]);

        mockEdges = new DataSet([
            mockEdgeGenerator(1, 1, 'to', 2),
            mockEdgeGenerator(2, 2, 'to', 3),
        ]);

        mockConfig = {
            interaction: {
                hover: true,
                navigationButtons: true,
                multiselect: true,
                selectConnectedEdges: false,
            },
            physics: {
                enabled: true,
                barnesHut: {
                    springConstant: 0.04,
                    damping: 0.9,
                    gravitationalConstant: -10000,
                }
            },
            edges: {
                font: {
                    size: 12
                },
                widthConstraint: {
                    maximum: 90
                },
            },
            nodes: {
                size: 25,
                shape: 'box',
                // TODO: Investigate the 'scaling' property for dynamic resizing of 'box' shape nodes
            },
        };

        mockLegend = new Map<string, string[]>([
            ['Chemical', ['#CD5D67', '#410B13']]
        ]);

        mockCallbackParams = {
            event: {
            preventDefault() { /*Do nothing*/ },
            },
            pointer: {
                DOM: {
                    x: 0,
                    y: 0,
                }
            }
        };

        fixture = TestBed.createComponent(VisualizationCanvasComponent);
        instance = fixture.debugElement.componentInstance;
        contextMenuControlService = fixture.debugElement.injector.get(ContextMenuControlService);
        referenceTableControlService = fixture.debugElement.injector.get(ReferenceTableControlService);

        instance.nodes = mockNodes;
        instance.edges = mockEdges;
        instance.config = mockConfig;
        instance.legend = mockLegend;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });

    it('should update sidenav entity data and toggle the sidenav when getSnippetsResult changes', () => {
        const toggleSidenavOpenedSpy = spyOn(instance, 'toggleSidenavOpened');
        const mockGetSnippetsResult = {
            references: [],
            fromNodeId: 1,
            toNodeId: 2,
            association: 'HAS A',
        } as GetSnippetsResult;

        instance.getSnippetsResult = mockGetSnippetsResult;
        fixture.detectChanges();

        expect(instance.sidenavEntityType).toEqual(2); // 2 = EDGE
        expect(instance.sidenavEntity).toEqual({
            to: instance.nodes.get(mockGetSnippetsResult.toNodeId) as VisNode,
            from: instance.nodes.get(mockGetSnippetsResult.fromNodeId) as VisNode,
            association: mockGetSnippetsResult.association,
            references: mockGetSnippetsResult.references,
        });
        expect(toggleSidenavOpenedSpy).toHaveBeenCalled();
    });

    it('should update sidenav entity data and toggle the sidenav when getClusterGraphDataResult changes', () => {
        const mockGetClusterGraphDataResult = {
            results: {
                1: {
                    'Mock Node': 0,
                }
            }
        } as GetClusterGraphDataResult;

        instance.getClusterGraphDataResult = mockGetClusterGraphDataResult;
        fixture.detectChanges();

        expect(instance.sidenavEntityType).toEqual(3); // 3 = EDGE
        expect(instance.sidenavEntity).toEqual({
            includes: Object.keys(mockGetClusterGraphDataResult.results).map(nodeId => instance.nodes.get(nodeId)),
            clusterGraphData: mockGetClusterGraphDataResult,
        });
    });

    it('should turn animation off if quickbar component animationStatus emits false', () => {
        const toggleAnimationSpy = spyOn(instance, 'toggleAnimation').and.callThrough();
        const networkGraphSetOptionsSpy = spyOn(instance.networkGraph, 'setOptions');
        const visualizationQuickbarComponentMock = fixture.debugElement.query(
            By.directive(VisualizationQuickbarComponent)
        ).componentInstance as VisualizationQuickbarComponent;

        visualizationQuickbarComponentMock.animationStatus.emit(false);

        expect(toggleAnimationSpy).toHaveBeenCalledWith(false);
        expect(networkGraphSetOptionsSpy).toHaveBeenCalledWith({physics: false});
    });

    it('should turn animation on if quickbar component animationStatus emits true', () => {
        const toggleAnimationSpy = spyOn(instance, 'toggleAnimation').and.callThrough();
        const networkGraphSetOptionsSpy = spyOn(instance.networkGraph, 'setOptions');
        const visualizationQuickbarComponentMock = fixture.debugElement.query(
            By.directive(VisualizationQuickbarComponent)
        ).componentInstance as VisualizationQuickbarComponent;

        visualizationQuickbarComponentMock.animationStatus.emit(true);

        expect(toggleAnimationSpy).toHaveBeenCalledWith(true);
        expect(networkGraphSetOptionsSpy).toHaveBeenCalledWith({physics: true});
    });

    it('toggleSidenavOpened should flip the value of sidenavOpened', () => {
        // instance.sidenavOpened defaults to 'false'
        instance.toggleSidenavOpened();
        expect(instance.sidenavOpened).toBeTrue();
    });

    it('clearSelectedNodeEdgeLabels should clear the selected edge labels set', () => {
        instance.selectedNodeEdgeLabels.add('Mock Edge Label');
        instance.clearSelectedNodeEdgeLabels();

        expect(instance.selectedNodeEdgeLabels.size).toEqual(0);
    });

    it('getConnectedEdgeLabels should get the labels of every edge connected to the input node', () => {
        const edgeLabelsOfMockedNode = instance.getConnectedEdgeLabels(1);

        expect(edgeLabelsOfMockedNode.size).toEqual(1);
        expect(edgeLabelsOfMockedNode.has('Mock Edge')).toBeTrue();
    });

    it('updateSelectedNodeEdgeLabels should update the selected edge labels with the edges of the given node', () => {
        instance.selectedNodeEdgeLabels = new Set<string>('Fake Edge Label');
        instance.updateSelectedNodeEdgeLabels(1);

        expect(instance.selectedNodeEdgeLabels.size).toEqual(1);
        expect(instance.selectedNodeEdgeLabels.has('Mock Edge')).toBeTrue();
    });

    it('isNotAClusterEdge should detect whether an edge is a cluster edge or not', () => {

    });

    it('getNeighborsWithRelationship should get all the neighbors of the given node connected by the given relationship', () => {

    });

    it('createDuplicateNodesAndEdges should duplicate the given nodes, and the edges connected to them with the given label', () => {

    });

    it('groupNeighborsWithRelationship...', () => {
        // TODO: Implement me!
    });

    it('collapseNeighbors should remove all edges connected to the given node', () => {

    });

    it('collapseNeighbors should remove all nodes connected to the given node, if they are not connected to anything else', () => {

    });

    it('expandOrCollapseNode should open any connected clusters of the given node', () => {

    });

    it('expandOrCollapseNode should collapse the node if it is expanded', () => {

    });

    it('expandOrCollapseNode should request a node expansion from the parent if the node is collapsed', () => {

    });

    it('getEdgesBetweenNodes should get all the edges between the two given nodes', () => {

    });

    it('createDuplicateNodeFromOriginal should create a DuplicateVisNode from a VisNode', () => {
        spyOn(instance, 'createDuplicateNodeFromOriginal').and.callFake((originalNode: VisNode) => {
            // Just replacing the id with a non-random value here
            const newDuplicateNodeId = 'duplicateNode:1234';
            return {
                ...originalNode,
                id: newDuplicateNodeId,
                duplicateOf: originalNode.id,
            } as DuplicateVisNode;
        });
        const mockDuplicateNode = instance.createDuplicateNodeFromOriginal(instance.nodes.get(1));

        expect(mockDuplicateNode).toEqual({
            ...instance.nodes.get(1),
            id: 'duplicateNode:1234',
            duplicateOf: 1,
        });
    });

    it('createOriginalNodeFromDuplicate should create a normal VisNode from a DuplicateVisNode', () => {
        const mockDuplicateNode = instance.createDuplicateNodeFromOriginal(instance.nodes.get(1));

        expect(instance.createOriginalNodeFromDuplicate(mockDuplicateNode)).toEqual(instance.nodes.get(1));
    });

    it('createDuplicateEdgeFromOriginal should create a normal DuplicateVisNode from a VisEdge', () => {
        spyOn(instance, 'createDuplicateEdgeFromOriginal').and.callFake(
            (originalEdge: VisEdge, clusterOrigin: number, duplicateNode: DuplicateVisNode) => {
                // Just replacing the id with a non-random value here
                const newDuplicateEdgeId = 'duplicateEdge:1234';
                return {
                    ...originalEdge,
                    id: newDuplicateEdgeId,
                    duplicateOf: originalEdge.id,
                    from: originalEdge.from === clusterOrigin ? clusterOrigin : duplicateNode.id,
                    to: originalEdge.to === clusterOrigin ? clusterOrigin : duplicateNode.id,
                    originalFrom: originalEdge.from,
                    originalTo: originalEdge.to,
                } as DuplicateVisEdge;
            }
        );
        const original = instance.edges.get(1);
        const origin = 1;
        const duplicateN = instance.createDuplicateNodeFromOriginal(instance.nodes.get(2));
        const mockDuplicateEdge = instance.createDuplicateEdgeFromOriginal(original, origin, duplicateN);

        expect(mockDuplicateEdge).toEqual({
            ...original,
            id: 'duplicateEdge:1234',
            duplicateOf: original.id,
            from: original.from === origin ? origin : duplicateN.id,
            to: original.to === origin ? origin : duplicateN.id,
            originalFrom: original.from,
            originalTo: original.to,
        });
    });

    it('createOriginalEdgeFromDuplicate should create a normal VisEdge from a DuplicateVisEdge', () => {
        const originalEdge = instance.edges.get(1);
        const clusterOrigin = 1;
        const duplicateNode = instance.createDuplicateNodeFromOriginal(instance.nodes.get(2));
        const mockDuplicateEdge = instance.createDuplicateEdgeFromOriginal(originalEdge, clusterOrigin, duplicateNode);

        expect(instance.createOriginalEdgeFromDuplicate(mockDuplicateEdge)).toEqual(originalEdge);
    });

    it('cleanUpDuplicates should remove the given duplicate nodes and their duplicate edges from the canvas', () => {

    });

    it('cleanUpDuplicates should redraw originals if they were not on the canvas', () => {

    });

    it('safelyOpenCluster should open and clean up a cluster', () => {

    });

    it('removeNodes should remove nodes from the canvas', () => {

    });

    it('removeNodes should open clusters connected to removed nodes', () => {

    });

    it('selectNeighbors should result in the neighbors of the input node being selected', () => {
        const getConnectedNodesSpy = spyOn(instance.networkGraph, 'getConnectedNodes').and.callThrough();
        const selectNodesSpy = spyOn(instance.networkGraph, 'selectNodes').and.callThrough();

        // Start with the origin node selected. It will be deselected when its neighbors are selected.
        instance.networkGraph.selectNodes([1]);
        instance.updateSelectedNodes();
        instance.selectNeighbors(1);

        expect(getConnectedNodesSpy).toHaveBeenCalledWith(1);
        expect(selectNodesSpy).toHaveBeenCalledWith([2]);
        expect(instance.selectedNodes.length).toEqual(1);
        expect(instance.selectedNodes.includes(2)).toBeTrue();
    });

    it('getAssociationsWithEdge should request association snippets for the given edge', () => {
        const getSnippetsFromEdgeEmitSpy = spyOn(instance.getSnippetsFromEdge, 'emit');

        instance.getAssociationsWithEdge(mockEdges.get(1));

        expect(getSnippetsFromEdgeEmitSpy).toHaveBeenCalledWith(mockEdges.get(1));
    });

    it('getAssociationsWithDuplicateEdge should request association snippets for the given duplicate edge', () => {
        const getAssociationSnippetsFromEdgeEmitSpy = spyOn(instance.getSnippetsFromDuplicateEdge, 'emit');
        const mockDuplicateEdge = {
            ...mockEdges.get(1),
            id: 'duplicateEdge:1234',
            duplicateOf: 1,
            originalFrom: 1,
            originalTo: 2,
        } as DuplicateVisEdge;

        instance.getAssociationsWithDuplicateEdge(mockDuplicateEdge);

        expect(getAssociationSnippetsFromEdgeEmitSpy).toHaveBeenCalledWith(mockDuplicateEdge);
    });

    it('should tell all tooltips to hide if hideTooltips is called', () => {
        const tooltipControlServiceHideTooltipSpy = spyOn(contextMenuControlService, 'hideTooltip');
        const referenceTableControlServiceHideTooltipSpy = spyOn(referenceTableControlService, 'hideTooltip');

        instance.hideAllTooltips();

        expect(tooltipControlServiceHideTooltipSpy).toHaveBeenCalled();
        expect(referenceTableControlServiceHideTooltipSpy).toHaveBeenCalled();
    });

    it('should hide all tooltips if a point on the canvas is clicked', () => {
        const hideAllTooltipsSpy = spyOn(instance, 'hideAllTooltips');
        instance.onClickCallback(null);

        expect(hideAllTooltipsSpy).toHaveBeenCalled();
    });

    it('should hide all tooltips if a node is dragged', () => {
        const hideAllTooltipsSpy = spyOn(instance, 'hideAllTooltips');
        instance.onDragStartCallback(null);

        expect(hideAllTooltipsSpy).toHaveBeenCalled();
    });

    it('should update selected nodes if a node is dragged', () => {
        const updatedSelectedNodesSpy = spyOn(instance, 'updateSelectedNodes');
        instance.onDragStartCallback(null);

        expect(updatedSelectedNodesSpy).toHaveBeenCalled();
    });

    it('should interrupt showing the reference table if something is dragged', () => {
        const interruptReferenceTableSpy = spyOn(referenceTableControlService, 'interruptReferenceTable');
        instance.onDragStartCallback(null);

        expect(interruptReferenceTableSpy).toHaveBeenCalled();
    });

    // TODO: Create a real cluster
    it('should start the reference table delay if a cluster node is hovered', () => {
        // mock the return value of isCluster because we don't actually need a cluster to exist for this test
        spyOn(instance.networkGraph, 'isCluster').and.returnValue(true);
        const delayReferenceTableSpy = spyOn(referenceTableControlService, 'delayReferenceTable');

        instance.onHoverNodeCallback({node: null});
        referenceTableControlService.interruptReferenceTable(); // Interrupt so the service doesn't emit true

        expect(delayReferenceTableSpy).toHaveBeenCalled();
    });

    it('should interrupt showing the reference table if a node is blurred', () => {
        const interruptReferenceTableSpy = spyOn(referenceTableControlService, 'interruptReferenceTable');

        instance.onBlurNodeCallback({node: 1});

        expect(interruptReferenceTableSpy).toHaveBeenCalled();
    });

    it('should update reference table data and location if it is not interrupted', () => {

    });

    it('should update selected nodes and sidebar entity when a node is selected', () => {
        const updateSelectedNodesSpy = spyOn(instance, 'updateSelectedNodes');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onSelectNodeCallback(null);

        expect(updateSelectedNodesSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should update selected nodes when a node is deselected', () => {
        const updateSelectedNodesSpy = spyOn(instance, 'updateSelectedNodes');

        instance.onDeselectNodeCallback(null);

        expect(updateSelectedNodesSpy).toHaveBeenCalled();
    });

    it('should update selected edges when an edge is selected', () => {
        const updateSelectedEdgesSpy = spyOn(instance, 'updateSelectedEdges');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onSelectEdgeCallback(null);

        expect(updateSelectedEdgesSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should update selected edges when an edge is deselected', () => {
        const updateSelectedEdgesSpy = spyOn(instance, 'updateSelectedEdges');

        instance.onDeselectEdgeCallback(null);

        expect(updateSelectedEdgesSpy).toHaveBeenCalled();
    });

    // TODO: Should create a real cluster to test here
    it('should open a cluster if it is double clicked', () => {
        const safelyOpenClusterSpy = spyOn(instance, 'safelyOpenCluster');
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        // For now, pretend the retrieved node is a cluster to test without actually creating a cluster
        spyOn(instance.networkGraph, 'isCluster').and.returnValue(true);

        instance.onDoubleClickCallback(mockCallbackParams);

        expect(safelyOpenClusterSpy).toHaveBeenCalledWith(1);
    });

    it('should expand/collapse a node if it is double clicked', () => {
        const expandOrCollapseNodeSpy = spyOn(instance, 'expandOrCollapseNode');
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);

        instance.onDoubleClickCallback(mockCallbackParams);

        expect(expandOrCollapseNodeSpy).toHaveBeenCalledWith(1);
    });

    // TODO: Create a real cluster
    it('should not open the context menu if a cluster is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'isCluster').and.returnValue(true); // Faking the cluster for now
        const preventDefaultSpy = spyOn(mockCallbackParams.event, 'preventDefault');

        instance.onContextCallback(mockCallbackParams);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should select the node, show tooltip, and update sidebar if an unselected node is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const networkGraphSelectNodesSpy = spyOn(instance.networkGraph, 'selectNodes').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onContextCallback(mockCallbackParams);

        expect(networkGraphSelectNodesSpy).toHaveBeenCalledWith([1], false);
        expect(updateSelectedNodesAndEdgesSpy).toHaveBeenCalled();
        expect(instance.selectedNodes.includes(1)).toBeTrue();
        expect(showTooltipSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should not unselect selected nodes if a selected node is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        // Select some nodes to begin with
        instance.networkGraph.selectNodes([1, 2]);
        instance.updateSelectedNodes();
        instance.onContextCallback(mockCallbackParams);

        expect(instance.selectedNodes).toEqual([1, 2]);
    });

    it('should select the edge, show tooltip, and update sidebar if an unselected edge is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(1);
        const networkGraphSelectNodesSpy = spyOn(instance.networkGraph, 'selectEdges').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onContextCallback(mockCallbackParams);

        expect(networkGraphSelectNodesSpy).toHaveBeenCalledWith([1]);
        expect(updateSelectedNodesAndEdgesSpy).toHaveBeenCalled();
        expect(instance.selectedEdges.includes(1)).toBeTrue();
        expect(showTooltipSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should not unselect selected edges if a selected edge is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(1);
        // Select some edges to begin with
        instance.networkGraph.selectEdges([1, 2]);
        instance.updateSelectedEdges();
        instance.onContextCallback(mockCallbackParams);

        expect(instance.selectedEdges).toEqual([1, 2]);
    });

    it('should unselect all, show tooltip, and update sidebar if nothing is hovered when opening the context menu', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const networkGraphUnselectAllSpy = spyOn(instance.networkGraph, 'unselectAll').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        // Select a node and edge to begin with
        instance.networkGraph.selectEdges([1]);
        instance.updateSelectedEdges();

        instance.networkGraph.selectNodes([1]);
        instance.updateSelectedNodes();

        instance.onContextCallback(mockCallbackParams);

        expect(networkGraphUnselectAllSpy).toHaveBeenCalled();
        expect(updateSelectedNodesAndEdgesSpy).toHaveBeenCalled();
        expect(instance.selectedEdges.length).toEqual(0);
        expect(instance.selectedNodes.length).toEqual(0);
        expect(showTooltipSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should update selected edge labels if exactly one node is selected and right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const updateSelectedNodeEdgeLabelsSpy = spyOn(instance, 'updateSelectedNodeEdgeLabels').and.callThrough();

        instance.onContextCallback(mockCallbackParams);

        expect(updateSelectedNodeEdgeLabelsSpy).toHaveBeenCalledWith(1);
        expect(instance.selectedNodeEdgeLabels.has('Mock Edge')).toBeTrue();
    });

    it('should clear selected edge labels if more than one node is selected and right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const clearSelectedNodeEdgeLabelsSpy = spyOn(instance, 'clearSelectedNodeEdgeLabels').and.callThrough();
        const updateSelectedNodeEdgeLabelsSpy = spyOn(instance, 'updateSelectedNodeEdgeLabels').and.callThrough();

        // Select some nodes to begin with
        instance.networkGraph.selectNodes([1, 2]);
        instance.updateSelectedNodes();

        expect(instance.selectedNodes.length).toEqual(2);
        expect(instance.networkGraph.getSelectedNodes().length).toEqual(2);

        instance.onContextCallback(mockCallbackParams);

        expect(updateSelectedNodeEdgeLabelsSpy).not.toHaveBeenCalled();
        expect(clearSelectedNodeEdgeLabelsSpy).toHaveBeenCalled();
        expect(instance.selectedNodeEdgeLabels.size).toEqual(0);
    });

    it('should clear selected edge labels if any edges are selected and right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(1);
        const clearSelectedNodeEdgeLabelsSpy = spyOn(instance, 'clearSelectedNodeEdgeLabels').and.callThrough();

        // Select some nodes to begin with and get the edge labels
        instance.networkGraph.selectNodes([1]);
        instance.updateSelectedNodes();
        instance.updateSelectedNodeEdgeLabels(1);

        instance.onContextCallback(mockCallbackParams);

        expect(instance.selectedEdges.length).toEqual(1);
        expect(instance.selectedEdges.includes(1)).toBeTrue();
        expect(clearSelectedNodeEdgeLabelsSpy).toHaveBeenCalled();
        expect(instance.selectedNodeEdgeLabels.size).toEqual(0);
    });
});
