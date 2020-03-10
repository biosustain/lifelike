import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { DataSet } from 'vis-network';

import { Neo4jGraphConfig, GetSnippetsResult, GetClusterGraphDataResult, VisEdge, VisNode } from 'app/interfaces';
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
import { By } from '@angular/platform-browser';

fdescribe('VisualizationCanvasComponent', () => {
    let fixture: ComponentFixture<VisualizationCanvasComponent>;
    let instance: VisualizationCanvasComponent;

    let mockNodes: DataSet<VisNode>;
    let mockEdges: DataSet<VisEdge>;
    let mockConfig: Neo4jGraphConfig;
    let mockLegend: Map<string, string[]>;

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
        ]);

        mockEdges = new DataSet([
            mockEdgeGenerator(1, 1, 'to', 2),
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

        fixture = TestBed.createComponent(VisualizationCanvasComponent);
        instance = fixture.debugElement.componentInstance;

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

    });

    it('clearSelectedNodeEdgeLabels should clear the selected edge labels set', () => {

    });

    it('updateSelectedNodeEdgeLabels should update the selected edge labels with the edges of the given node', () => {

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

    it('getConnectedEdgeLabels should get the labels of every edge connected to the input node', () => {

    });

    it('isNotAClusterEdge should detect whether an edge is a cluster edge or not', () => {

    });

    it('createOriginalNodeFromDuplicate should create a normal VisNode from a DuplicateVisNode', () => {

    });

    it('createDuplicateNodeFromOriginal should create a DuplicateVisNode from a VisNode', () => {

    });

    it('createOriginalEdgeFromDuplicate should create a normal VisEdge from a DuplicateVisEdge', () => {

    });

    it('createDuplicateEdgeFromOriginal should create a normal DuplicateVisNode from a VisEdge', () => {

    });

    it('cleanUpDuplicates should remove the given duplicate nodes and their duplicate edges from the canvas', () => {

    });

    it('cleanUpDuplicates should redraw originals if they were not on the canvas', () => {

    });

    it('createDuplicateNodesAndEdges should duplicate the given nodes, and the edges connected to them with the given label', () => {

    });

    it('safelyOpenCluster should open and clean up a cluster', () => {

    });

    it('groupNeighborsWithRelationship...', () => {
        // TODO: Implement me!
    });

    it('removeNodes should remove nodes from the canvas', () => {

    });

    it('removeNodes should open clusters connected to removed nodes', () => {

    });

    it('selectNeighbors should result in the neighbors of the input node being selected', () => {

    });

    it('getAssociationsWithEdge should request association snippets for the given edge', () => {

    });

    it('getAssociationsWithDuplicateEdge should request association snippets for the given duplicate edge', () => {

    });

    it('should tell all tooltips to hide if hideTooltips is called', () => {

    });

    it('should hide all tooltips if a point on the canvas is clicked', () => {

    });

    it('should hide all tooltips if a node is dragged', () => {

    });

    it('should update selected nodes if a node is dragged', () => {

    });

    it('should start the reference table delay if a cluster node is hovered', () => {

    });

    it('should interrupt showing the reference table if a node is blurred', () => {

    });

    it('should interrupt showing the reference table if a cluster is dragged', () => {

    });

    it('should update reference table data and location if it is not interrupted', () => {

    });

    it('should update selected nodes when a node is selected', () => {

    });

    it('should update selected nodes when a node is deselected', () => {

    });

    it('should update selected edges when a node is selected', () => {

    });

    it('should update selected edges when a node is deselected', () => {

    });

    it('should open a cluster if it is double clicked', () => {

    });

    it('should expand/collapse a node if it is double clicked', () => {

    });

    it('should not open the context menu if a cluster is right-clicked', () => {

    });

    it('should open and update the context menu if something other than a cluster is right-clicked', () => {

    });
});
