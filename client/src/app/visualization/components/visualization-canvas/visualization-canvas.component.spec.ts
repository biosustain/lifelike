import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { of } from 'rxjs';

import { DataSet } from 'vis-network';

import { MAX_CLUSTER_ROWS } from 'app/constants';
import {
    Direction,
    DuplicateNodeEdgePair,
    DuplicateVisNode,
    DuplicateVisEdge,
    GetSnippetsResult,
    GetClusterGraphDataResult,
    GroupRequest,
    Neo4jGraphConfig,
    SidenavEdgeEntity,
    VisEdge,
    VisNode,
    GetReferenceTableDataResult,
    ReferenceTableRow,
    GetClusterSnippetDataResult,
    SettingsFormValues,
    ClusterData,
    SidenavSnippetData,
    SidenavClusterEntity,
} from 'app/interfaces';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';
import { uuidv4 } from 'app/shared/utils';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuControlService } from '../../services/context-menu-control.service';

import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { SidenavClusterViewComponent } from '../sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from '../sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from '../sidenav-node-view/sidenav-node-view.component';
import { VisualizationQuickbarComponent } from '../../components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationCanvasComponent } from '../visualization-canvas/visualization-canvas.component';
import { VisualizationSettingsComponent } from '../visualization-settings/visualization-settings.component';

describe('VisualizationCanvasComponent', () => {
    let fixture: ComponentFixture<VisualizationCanvasComponent>;
    let instance: VisualizationCanvasComponent;

    let contextMenuControlService: ContextMenuControlService;
    let visualizationService: VisualizationService;

    let mockNodes: DataSet<VisNode>;
    let mockEdges: DataSet<VisEdge>;
    let mockDuplicateNodeEdgePairs: DuplicateNodeEdgePair[];
    let mockReferenceTableRows: ReferenceTableRow[];
    let mockGetReferenceTableDataResult: GetReferenceTableDataResult;
    let mockGroupRequest: GroupRequest;
    let mockConfig: Neo4jGraphConfig;
    let mockLegend: Map<string, string[]>;
    let mockValidSettingsFormValues: SettingsFormValues;
    let mockInvalidSettingsFormValues: SettingsFormValues;
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
            font: null,
        } as VisNode;
    }

    function mockDuplicateNodeGenerator(nodeId: number, nodeDisplayName: string, nodeData?: any): DuplicateVisNode {
        return {
            ...mockNodeGenerator(nodeId, nodeDisplayName, nodeData),
            id: 'duplicateNode:' + uuidv4(),
            duplicateOf: nodeId,
        } as DuplicateVisNode;
    }

    function mockEdgeGenerator(edgeId: number, fromNode: number, arrowDirection: string, toNode: number): VisEdge {
        return {
            id: edgeId,
            label: 'Mock Edge',
            data: { description: 'Mock Edge'},
            to: toNode,
            from: fromNode,
            toLabel: 'Mock Node',
            fromLabel: 'Mock Node',
            arrows: arrowDirection,
            color: null,
        } as VisEdge;
    }

    function mockDuplicateEdgeGenerator(edgeId: number, fromNode: number, arrowDirection: string, toNode: number): DuplicateVisEdge {
        return {
            ...mockEdgeGenerator(edgeId, fromNode, arrowDirection, toNode),
            id: 'duplicateEdge:' + uuidv4(),
            duplicateOf: edgeId,
            originalFrom: fromNode,
            originalTo: toNode,
        } as DuplicateVisEdge;
    }

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [
                VisualizationCanvasComponent,
                MockComponents(
                    ContextMenuComponent,
                    SidenavClusterViewComponent,
                    SidenavEdgeViewComponent,
                    SidenavNodeViewComponent,
                    VisualizationCanvasComponent,
                    VisualizationQuickbarComponent,
                    VisualizationSettingsComponent,
                ),
            ],
            providers: [
                ContextMenuControlService,
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

        // NOTE: IDs need to be unique between both nodes AND edges!
        // Reason for this is because some vis.js network graph methods
        // expect either a node ID OR an edge ID, so if an node and edge
        // have the SAME ID, then the method may not return the expected
        // value.

        mockEdges = new DataSet([
            mockEdgeGenerator(101, 1, 'to', 2),
            mockEdgeGenerator(102, 1, 'to', 3),
        ]);

        mockGroupRequest = {
            relationship: 'Mock Edge',
            node: 1,
            direction: Direction.FROM,
        } as GroupRequest;

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
            },
        };

        mockDuplicateNodeEdgePairs = [
            {
                node: mockDuplicateNodeGenerator(2, 'Mock Node 2', {}),
                edge: mockDuplicateEdgeGenerator(101, 1, 'to', 2),
            } as DuplicateNodeEdgePair,
            {
                node: mockDuplicateNodeGenerator(3, 'Mock Node 3', {}),
                edge: mockDuplicateEdgeGenerator(102, 1, 'to', 3),
            } as DuplicateNodeEdgePair,
        ];

        mockReferenceTableRows = [
            {
                nodeId: '2',
                nodeDisplayName: 'Mock Node 2',
                snippetCount: 1,
                edge: mockDuplicateEdgeGenerator(101, 1, 'to', 2),
            } as ReferenceTableRow,
            {
                nodeId: '3',
                nodeDisplayName: 'Mock Node 3',
                snippetCount: 1,
                edge: mockDuplicateEdgeGenerator(101, 1, 'to', 3),
            } as ReferenceTableRow,
        ];

        mockGetReferenceTableDataResult = {
            referenceTableRows: mockReferenceTableRows,
        } as GetReferenceTableDataResult;

        mockLegend = new Map<string, string[]>([
            ['Chemical', ['#CD5D67', '#410B13']]
        ]);

        mockValidSettingsFormValues = {
            maxClusterShownRows: {
                value: MAX_CLUSTER_ROWS,
                valid: true,
            },
            Chemical: {
                value: true,
                valid: true,
            },
            Gene: {
                value: true,
                valid: true,
            },
            Diseases: {
                value: true,
                valid: true,
            },
        } as SettingsFormValues;

        mockInvalidSettingsFormValues = {
            maxClusterShownRows: {
                value: -1,
                valid: false,
            },
            Chemical: {
                value: true,
                valid: true,
            },
            Gene: {
                value: true,
                valid: true,
            },
            Diseases: {
                value: true,
                valid: true,
            },
        } as SettingsFormValues;

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
        visualizationService = fixture.debugElement.injector.get(VisualizationService);

        instance.nodes = mockNodes;
        instance.edges = mockEdges;
        instance.config = mockConfig;
        instance.legend = mockLegend;
        instance.settingsFormValues = mockValidSettingsFormValues;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });

    it('updateSettings should update settings values if inputs are valid', () => {
        const newSettings = {
            maxClusterShownRows: {
                value: 10,
                valid: true,
            },
            Chemical: {
                value: true,
                valid: true,
            },
            Gene: {
                value: true,
                valid: true,
            },
            Diseases: {
                value: true,
                valid: true,
            },
        } as SettingsFormValues;

        instance.updateSettings(newSettings);
        expect(instance.settingsFormValues).toEqual(newSettings);
    });

    it('updateSettings should not update update settings values if inputs are invalid', () => {
        const newSettings = {
            maxClusterShownRows: {
                value: 2,
                valid: false,
            },
            Chemical: {
                value: true,
                valid: false,
            },
            Gene: {
                value: true,
                valid: false,
            },
            Diseases: {
                value: true,
                valid: false,
            },
        } as SettingsFormValues;

        instance.updateSettings(newSettings);
        expect(instance.settingsFormValues).toEqual(mockValidSettingsFormValues);
    });

    it('should update sidenav entity data when getSnippetsResult changes', () => {
        const mockGetSnippetsResult = {
            snippets: [],
            fromNodeId: 1,
            toNodeId: 2,
            association: 'HAS A',
        } as GetSnippetsResult;

        instance.getSnippetsResult = mockGetSnippetsResult;
        fixture.detectChanges();

        expect(instance.sidenavEntityType).toEqual(2); // 2 = EDGE
        expect(instance.sidenavEntity).toEqual({
            data: {
                to: instance.nodes.get(mockGetSnippetsResult.toNodeId) as VisNode,
                from: instance.nodes.get(mockGetSnippetsResult.fromNodeId) as VisNode,
                association: mockGetSnippetsResult.association,
                snippets: mockGetSnippetsResult.snippets,
            } as SidenavSnippetData
        } as SidenavEdgeEntity);
    });

    it('should update sidenav entity data when getClusterDataResult changes', () => {
        const mockGetClusterGraphDataResult = {
            results: {
                1: {
                    'Mock Node': 0,
                }
            }
        } as GetClusterGraphDataResult;
        const mockGetClusterSnippetDataResult = {
            results: [
                {
                    fromNodeId: 1,
                    toNodeId: 2,
                    snippets: [],
                    association: '',
                } as GetSnippetsResult,
            ]
        } as GetClusterSnippetDataResult;

        instance.getClusterDataResult = {
            graphData: mockGetClusterGraphDataResult,
            snippetData: mockGetClusterSnippetDataResult,
        };
        fixture.detectChanges();

        expect(instance.sidenavEntityType).toEqual(3); // 3 = CLUSTER
        expect(instance.sidenavEntity).toEqual({
            data: mockGetClusterSnippetDataResult.results.map(snippetResult => {
                return {
                    to: instance.nodes.get(snippetResult.toNodeId) as VisNode,
                    from: instance.nodes.get(snippetResult.fromNodeId) as VisNode,
                    association: snippetResult.association,
                    snippets: snippetResult.snippets,
                } as SidenavSnippetData;
            }),
        } as SidenavClusterEntity);
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

    it('clearSelectedNodeEdgeLabelData should clear the selected edge labels set', () => {
        instance.selectedNodeEdgeLabelData.set('Mock Edge', [Direction.FROM]);
        instance.clearSelectedNodeEdgeLabelData();

        expect(instance.selectedNodeEdgeLabelData.size).toEqual(0);
    });

    it('getConnectedEdgeLabels should get the labels of every edge connected to the input node', () => {
        const edgeLabelsOfMockedNode = instance.getConnectedEdgeLabels(1);

        expect(edgeLabelsOfMockedNode.size).toEqual(1);
        expect(edgeLabelsOfMockedNode.has('Mock Edge')).toBeTrue();
        expect(edgeLabelsOfMockedNode.get('Mock Edge')).toEqual([Direction.FROM]);
    });

    it('updateSelectedNodeEdgeLabelData should update the selected edge labels with the edges of the given node', () => {
        instance.updateSelectedNodeEdgeLabelData(1);

        expect(instance.selectedNodeEdgeLabelData.size).toEqual(1);
        expect(instance.selectedNodeEdgeLabelData.has('Mock Edge')).toBeTrue();
        expect(instance.selectedNodeEdgeLabelData.get('Mock Edge')).toEqual([Direction.FROM]);
    });

    it('getNeighborsWithRelationship should get all the neighbors of the given node connected by the given relationship', () => {
        expect(instance.nodes.length).toEqual(3);
        expect(instance.edges.length).toEqual(2);


        expect(instance.networkGraph.getConnectedNodes(101)).toEqual([1, 2]);
        expect(instance.networkGraph.getConnectedNodes(102)).toEqual([1, 3]);

        const neighbors = instance.getNeighborsWithRelationship('Mock Edge', 1, Direction.FROM);

        expect(neighbors).toBeTruthy();
        expect(neighbors).toEqual([2, 3]);
    });

    it('createDuplicateNodesAndEdges should duplicate the given nodes, and their connected edges with the given label/direction', () => {
        const duplicateNodeEdgePairs = instance.createDuplicateNodesAndEdges([2, 3], 'Mock Edge', 1, Direction.FROM);

        expect(duplicateNodeEdgePairs.length).toEqual(2);
        expect(duplicateNodeEdgePairs[0].node.duplicateOf).toEqual(2);
        expect(duplicateNodeEdgePairs[0].edge.duplicateOf).toEqual(101);
        expect(duplicateNodeEdgePairs[1].node.duplicateOf).toEqual(3);
        expect(duplicateNodeEdgePairs[1].edge.duplicateOf).toEqual(102);
    });

    it('update updateGraphWithDuplicates should update the network with the given duplicate node/edge pairs', () => {
        instance.updateGraphWithDuplicates(mockDuplicateNodeEdgePairs);

        expect(instance.nodes.length).toEqual(3);
        expect(instance.edges.length).toEqual(2);

        expect(instance.nodes.get(2)).toBeNull();
        expect(instance.nodes.get(3)).toBeNull();

        expect(instance.edges.get(101)).toBeNull();
        expect(instance.edges.get(102)).toBeNull();
    });

    it('groupNeighborsWithRelationship should cluster neighbors of the given node connected by the given relationship', async () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);

        await expect(instance.clusters.size).toEqual(1);
    });

    it('isNotAClusterEdge should detect whether an edge is a cluster edge or not', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);

        const clusterInfo = instance.clusters.entries().next();
        const clusterEdge = instance.networkGraph.getConnectedEdges(clusterInfo.value[0])[0];

        expect(clusterInfo.value[1]).toEqual(
            {
                referenceTableRows: mockReferenceTableRows,
                relationship: 'Mock Edge',
            } as ClusterData
        );
        expect(instance.isNotAClusterEdge(clusterEdge)).toBeFalse();
    });

    it('collapseNeighbors should remove all edges connected to the given node', () => {
        instance.collapseNeighbors(instance.nodes.get(1));

        expect(instance.nodes.length).toEqual(1);
        expect(instance.edges.length).toEqual(0);

        expect(instance.nodes.get(1)).toBeTruthy();
        expect(instance.nodes.get(2)).toBeNull();
        expect(instance.nodes.get(3)).toBeNull();
    });

    it('collapseNeighbors should remove all nodes connected to the given node, if they are not connected to anything else', () => {
        const newNode = mockNodeGenerator(4, 'Mock Node 4', {});
        const newEdge = mockEdgeGenerator(103, 2, 'to', 4);

        instance.nodes.add(newNode);
        instance.edges.add(newEdge);

        fixture.detectChanges();

        instance.collapseNeighbors(instance.nodes.get(1));

        expect(instance.nodes.length).toEqual(3);
        expect(instance.edges.length).toEqual(1);

        expect(instance.nodes.get(1)).toBeTruthy();
        expect(instance.nodes.get(2)).toBeTruthy();
        expect(instance.nodes.get(3)).toBeNull();
        expect(instance.nodes.get(4)).toBeTruthy();

        expect(instance.edges.get(101)).toBeNull();
        expect(instance.edges.get(102)).toBeNull();
        expect(instance.edges.get(103)).toBeTruthy();
    });

    it('expandOrCollapseNode should collapse the node if it is expanded', () => {
        const updatedNodeState = {...instance.nodes.get(1), expanded: true};
        instance.nodes.update(updatedNodeState);

        expect(instance.nodes.get(1).expanded).toBeTrue();

        instance.expandOrCollapseNode(1);

        expect(instance.nodes.get(1)).toBeTruthy();
        expect(instance.nodes.get(2)).toBeNull();
        expect(instance.nodes.get(3)).toBeNull();

        expect(instance.edges.get(101)).toBeNull();
        expect(instance.edges.get(102)).toBeNull();
    });

    it('expandOrCollapseNode should destroy any connected clusters of the given node', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        const nodeRef = instance.nodes.get(1) as VisNode;
        const updatedNodeState = {...nodeRef, expanded: true};
        instance.nodes.update(updatedNodeState);

        instance.groupNeighborsWithRelationship(mockGroupRequest);
        instance.expandOrCollapseNode(1);

        expect(instance.clusters.size).toEqual(0);

        expect(instance.nodes.get(1)).toBeTruthy();
        expect(instance.nodes.get(2)).toBeNull();
        expect(instance.nodes.get(3)).toBeNull();

        expect(instance.edges.get(101)).toBeNull();
        expect(instance.edges.get(102)).toBeNull();
    });

    it('expandOrCollapseNode should request a node expansion from the parent if the node is collapsed', () => {
        const expandNodeSpy = spyOn(instance.expandNode, 'emit');

        // Technically, node 1 is "expanded" in the sense that it has connections, but for the purpose
        // of this test we only care if the "expanded" property is set to false on the node
        instance.expandOrCollapseNode(1);

        expect(expandNodeSpy).toHaveBeenCalled();
    });

    it('getEdgesBetweenNodes should get all the edges between the two given nodes', () => {
        const edges = instance.getEdgesBetweenNodes(1, 2);

        expect(edges).toEqual([101]);
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
        const original = instance.edges.get(101);
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
        const originalEdge = instance.edges.get(101);
        const clusterOrigin = 1;
        const duplicateNode = instance.createDuplicateNodeFromOriginal(instance.nodes.get(2));
        const mockDuplicateEdge = instance.createDuplicateEdgeFromOriginal(originalEdge, clusterOrigin, duplicateNode);

        expect(instance.createOriginalEdgeFromDuplicate(mockDuplicateEdge)).toEqual(originalEdge);
    });

    it('cleanUpDuplicates should remove the given duplicate nodes and their duplicate edges from the canvas', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);

        expect(instance.nodes.get(2)).toBeNull();
        expect(instance.nodes.get(3)).toBeNull();

        const clusterInfo = instance.clusters.entries().next();
        const clusteredNodeIds = instance.networkGraph.getNodesInCluster(clusterInfo.value[0]);

        instance.cleanUpDuplicates(clusteredNodeIds);

        expect(instance.nodes.length).toEqual(3);
        expect(instance.edges.length).toEqual(2);

        expect(instance.nodes.get(2)).toBeTruthy();
        expect(instance.nodes.get(3)).toBeTruthy();
    });

    it('safelyOpenCluster should open and clean up a cluster', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        const cleanUpDuplicatesSpy = spyOn(instance, 'cleanUpDuplicates').and.callThrough();

        instance.groupNeighborsWithRelationship(mockGroupRequest);
        const clusterInfo = instance.clusters.entries().next();

        instance.safelyOpenCluster(clusterInfo.value[0]);

        expect(cleanUpDuplicatesSpy).toHaveBeenCalled();
        expect(instance.clusters.size).toEqual(0);
    });

    it('removeNodes should remove nodes from the canvas', () => {
        instance.removeNodes([1]);

        expect(instance.nodes.length).toEqual(2);
        expect(instance.edges.length).toEqual(0);

        expect(instance.nodes.get(1)).toBeNull();
        expect(instance.nodes.get(2)).toBeTruthy();
        expect(instance.nodes.get(3)).toBeTruthy();
    });

    it('removeNodes should open clusters connected to removed nodes', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);
        instance.removeNodes([1]);

        expect(instance.clusters.size).toEqual(0);

        expect(instance.nodes.length).toEqual(2);
        expect(instance.edges.length).toEqual(0);

        expect(instance.nodes.get(1)).toBeNull();
        expect(instance.nodes.get(2)).toBeTruthy();
        expect(instance.nodes.get(3)).toBeTruthy();
    });

    it('selectNeighbors should result in the neighbors of the input node being selected', () => {
        const getConnectedNodesSpy = spyOn(instance.networkGraph, 'getConnectedNodes').and.callThrough();
        const selectNodesSpy = spyOn(instance.networkGraph, 'selectNodes').and.callThrough();

        // Start with the origin node selected. It will be deselected when its neighbors are selected.
        instance.networkGraph.selectNodes([1]);
        instance.updateSelectedNodes();
        instance.selectNeighbors(1);

        expect(getConnectedNodesSpy).toHaveBeenCalledWith(1);
        expect(selectNodesSpy).toHaveBeenCalledWith([2, 3]);
        expect(instance.selectedNodes.length).toEqual(2);
        expect(instance.selectedNodes).toEqual([2, 3]);
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

        instance.hideAllTooltips();

        expect(tooltipControlServiceHideTooltipSpy).toHaveBeenCalled();
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
        instance.onDragEndCallback(null);

        expect(updatedSelectedNodesSpy).toHaveBeenCalled();
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

    it('should show tooltip, update selected cluster nodes, and update sidebar if an unselected cluster is right-clicked', () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);
        const clusterInfo = instance.clusters.entries().next();
        const clusterId = clusterInfo.value[0];

        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(clusterId);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'isCluster').and.returnValue(true);
        const networkGraphSelectNodesSpy = spyOn(instance.networkGraph, 'selectNodes').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onContextCallback(mockCallbackParams);

        expect(networkGraphSelectNodesSpy).toHaveBeenCalledWith([clusterId], false);
        expect(updateSelectedNodesAndEdgesSpy).toHaveBeenCalled();
        expect(instance.selectedNodes.includes(clusterId)).toBeTrue();
        expect(instance.selectedClusterNodeData.length).toEqual(2);
        expect(showTooltipSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
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
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(101);
        const networkGraphSelectNodesSpy = spyOn(instance.networkGraph, 'selectEdges').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        instance.onContextCallback(mockCallbackParams);

        expect(networkGraphSelectNodesSpy).toHaveBeenCalledWith([101]);
        expect(updateSelectedNodesAndEdgesSpy).toHaveBeenCalled();
        expect(instance.selectedEdges.includes(101)).toBeTrue();
        expect(showTooltipSpy).toHaveBeenCalled();
        expect(updateSidebarEntitySpy).toHaveBeenCalled();
    });

    it('should not unselect selected edges if a selected edge is right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(101);
        // Select some edges to begin with
        instance.networkGraph.selectEdges([101, 102]);
        instance.updateSelectedEdges();
        instance.onContextCallback(mockCallbackParams);

        expect(instance.selectedEdges).toEqual([101, 102]);
    });

    it('should unselect all, show tooltip, and update sidebar if nothing is hovered when opening the context menu', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const networkGraphUnselectAllSpy = spyOn(instance.networkGraph, 'unselectAll').and.callThrough();
        const updateSelectedNodesAndEdgesSpy = spyOn(instance, 'updateSelectedNodesAndEdges').and.callThrough();
        const showTooltipSpy = spyOn(contextMenuControlService, 'showTooltip');
        const updateSidebarEntitySpy = spyOn(instance, 'updateSidebarEntity');

        // Select a node and edge to begin with
        instance.networkGraph.selectEdges([101]);
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
        const updateSelectedNodeEdgeLabelDataSpy = spyOn(instance, 'updateSelectedNodeEdgeLabelData').and.callThrough();

        instance.onContextCallback(mockCallbackParams);

        expect(updateSelectedNodeEdgeLabelDataSpy).toHaveBeenCalledWith(1);
        expect(instance.selectedNodeEdgeLabelData.has('Mock Edge')).toBeTrue();
    });

    it('should clear selected edge labels if more than one node is selected and right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(1);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(undefined);
        const clearSelectedNodeEdgeLabelDataSpy = spyOn(instance, 'clearSelectedNodeEdgeLabelData').and.callThrough();
        const updateSelectedNodeEdgeLabelDataSpy = spyOn(instance, 'updateSelectedNodeEdgeLabelData').and.callThrough();

        // Select some nodes to begin with
        instance.networkGraph.selectNodes([1, 2]);
        instance.updateSelectedNodes();

        expect(instance.selectedNodes.length).toEqual(2);
        expect(instance.networkGraph.getSelectedNodes().length).toEqual(2);

        instance.onContextCallback(mockCallbackParams);

        expect(updateSelectedNodeEdgeLabelDataSpy).not.toHaveBeenCalled();
        expect(clearSelectedNodeEdgeLabelDataSpy).toHaveBeenCalled();
        expect(instance.selectedNodeEdgeLabelData.size).toEqual(0);
    });

    it('should clear selected edge labels if any edges are selected and right-clicked', () => {
        spyOn(instance.networkGraph, 'getNodeAt').and.returnValue(undefined);
        spyOn(instance.networkGraph, 'getEdgeAt').and.returnValue(101);
        const clearSelectedNodeEdgeLabelDataSpy = spyOn(instance, 'clearSelectedNodeEdgeLabelData').and.callThrough();

        // Select some nodes to begin with and get the edge labels
        instance.networkGraph.selectNodes([1]);
        instance.updateSelectedNodes();
        instance.updateSelectedNodeEdgeLabelData(1);

        instance.onContextCallback(mockCallbackParams);

        expect(instance.selectedEdges.length).toEqual(2);
        expect(instance.selectedEdges.includes(101)).toBeTrue();
        expect(clearSelectedNodeEdgeLabelDataSpy).toHaveBeenCalled();
        expect(instance.selectedNodeEdgeLabelData.size).toEqual(0);
    });

    it('removeNodeFromCluster should pull out a single node from a cluster, but also not mutate the cluster', async () => {
        spyOn(visualizationService, 'getReferenceTableData').and.returnValue(
            of(mockGetReferenceTableDataResult)
        );

        instance.groupNeighborsWithRelationship(mockGroupRequest);

        const clusterInfo = instance.clusters.entries().next();
        const clusterId = clusterInfo.value[0];
        const clusteredNodeIdsBeforeRemoval = instance.networkGraph.getNodesInCluster(clusterId);

        instance.removeNodeFromCluster(clusteredNodeIdsBeforeRemoval[0]);

        const clusteredNodeIdsAfterRemoval = instance.networkGraph.getNodesInCluster(clusterId);

        expect(clusteredNodeIdsAfterRemoval.length).toEqual(2);
        expect(clusteredNodeIdsAfterRemoval).toEqual(clusteredNodeIdsBeforeRemoval);
        expect(instance.nodes.get(2)).toBeTruthy();
        expect(instance.nodes.get(3)).toBeNull();
    });
});
