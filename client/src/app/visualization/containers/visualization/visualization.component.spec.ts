import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { MockComponents } from 'ng-mocks';

import { DataSet } from 'vis-data';

import {
    ClusteredNode,
    DuplicateVisEdge,
    GraphNode,
    GraphRelationship,
    Neo4jResults,
    VisEdge,
    VisNode,
} from 'app/interfaces';
import { RootStoreModule } from 'app/root-store';
import { SearchGraphComponent } from 'app/search/containers/search-graph.component';
import { SharedModule } from 'app/shared/shared.module';

import { VisualizationComponent } from './visualization.component';

import { VisualizationService } from '../../services/visualization.service';
import { VisualizationCanvasComponent } from '../../components/visualization-canvas/visualization-canvas.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('VisualizationComponent', () => {
    let fixture: ComponentFixture<VisualizationComponent>;
    let instance: VisualizationComponent;

    let mockGraphNode: GraphNode;
    let mockGraphRelationship: GraphRelationship;
    let mockNeo4jResults: Neo4jResults;
    let mockVisEdge: VisEdge;
    let mockDuplicateVisEdge: DuplicateVisEdge;
    let mockClusteredNode: ClusteredNode;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RootStoreModule,
                RouterTestingModule,
                SharedModule,
                BrowserAnimationsModule
            ],
            declarations: [
                VisualizationComponent,
                MockComponents(
                    VisualizationCanvasComponent,
                    SearchGraphComponent
                ),
            ],
            providers: [VisualizationService],
        });
    });

    beforeEach(() => {
        // Mock Neo4j data
        mockGraphNode = {
            id: 1,
            label: 'Mock Node',
            data: {},
            subLabels: ['Mock Node'],
            displayName: 'Mock Node 1',
        };
        mockGraphRelationship = {
            id: 1,
            label: 'Mock Edge',
            data: { description: 'Mock Edge'},
            to: 1,
            from: 2,
        };
        mockNeo4jResults = {
            nodes: [mockGraphNode],
            edges: [mockGraphRelationship],
        };

        // Mock Vis JS data
        mockVisEdge = {
            ...mockGraphRelationship,
            arrows: 'to',
        };

        mockDuplicateVisEdge = {
            ...mockVisEdge,
            id: 'duplicateEdge:' + `${1}`,
            duplicateOf: 1,
            originalFrom: 2,
            originalTo: 1,
        };

        mockClusteredNode = {
            nodeId: 1,
            edges: [mockDuplicateVisEdge],
        };

        fixture = TestBed.createComponent(VisualizationComponent);
        instance = fixture.debugElement.componentInstance;

        instance.legend.set('Mock Node', ['#FFFFFF', '#FFFFFF']);
        instance.networkGraphData = instance.setupInitialProperties(mockNeo4jResults);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });

    it('convertNodeToVisJSFormat should convert a graph node to vis js format', () => {
        const convertedMockNode = instance.convertNodeToVisJSFormat(mockGraphNode);
        expect(convertedMockNode).toEqual({
            ...mockGraphNode,
            expanded: false,
            primaryLabel: mockGraphNode.label,
            color: {
                background: instance.legend.get(mockGraphNode.label)[0],
                border: instance.legend.get(mockGraphNode.label)[1],
                hover: {
                    background: instance.legend.get(mockGraphNode.label)[0],
                    border: instance.legend.get(mockGraphNode.label)[1],
                },
                highlight: {
                    background: instance.legend.get(mockGraphNode.label)[0],
                    border: instance.legend.get(mockGraphNode.label)[1],
                }
            },
            label: mockGraphNode.displayName.length > 64 ? mockGraphNode.displayName.slice(0, 64) + '...'  : mockGraphNode.displayName,
        });
    });

    it('convertEdgeToVisJSFormat should convert an edge node to vis js format', () => {
        const convertedMockEdge = instance.convertEdgeToVisJSFormat(mockGraphRelationship);
        expect(convertedMockEdge).toEqual({
            ...mockGraphRelationship,
            label: mockGraphRelationship.data.description,
            arrows: 'to',
        });
    });

    it('convertToVisJSFormat should convert neo4j query results to vis js format', () => {
        const convertedMockNode = instance.convertNodeToVisJSFormat(mockGraphNode);
        const convertedMockEdge = instance.convertEdgeToVisJSFormat(mockGraphRelationship);
        const convertedNeo4jResults = instance.convertToVisJSFormat(mockNeo4jResults);

        expect(convertedNeo4jResults).toEqual({
            nodes: [convertedMockNode],
            edges: [convertedMockEdge],
        });
    });

    it('should call expandNode service when child requests a node to be expanded', () => {
        const expandNodeSpy = spyOn(instance, 'expandNode');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.expandNode.emit(1);

        expect(expandNodeSpy).toHaveBeenCalledWith(1);
    });

    it('should call getSnippetsFromEdge service when child requests snippets for edge', () => {
        const getSnippetsFromEdgeSpy = spyOn(instance, 'getSnippetsFromEdge');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.getSnippetsFromEdge.emit(mockVisEdge);

        expect(getSnippetsFromEdgeSpy).toHaveBeenCalledWith(mockVisEdge);
    });

    it('should call getSnippetsFromDuplicateEdge when child requests snippets for duplicate edge', () => {
        const getSnippetsFromDuplicateEdgeSpy = spyOn(instance, 'getSnippetsFromDuplicateEdge');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.getSnippetsFromDuplicateEdge.emit(mockDuplicateVisEdge);

        expect(getSnippetsFromDuplicateEdgeSpy).toHaveBeenCalledWith(mockDuplicateVisEdge);
    });

    it('should call getClusterGraphData when child requests graph data for cluster', () => {
        const getClusterGraphDataSpy = spyOn(instance, 'getClusterGraphData');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.getClusterGraphData.emit([mockClusteredNode]);

        expect(getClusterGraphDataSpy).toHaveBeenCalledWith([mockClusteredNode]);
    });

    it('should call addDuplicatedEdge when child requests that a new duplicate edge be added to the set', () => {
        const addDuplicateEdgeSpy = spyOn(instance, 'addDuplicatedEdge');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.addDuplicatedEdge.emit(1);

        expect(addDuplicateEdgeSpy).toHaveBeenCalledWith(1);
    });

    it('should call removeDuplicatedEdge when child requests that a duplicate edge be removed from the set', () => {
        const removeDuplicateEdgeSpy = spyOn(instance, 'removeDuplicatedEdge');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.removeDuplicatedEdge.emit(1);

        expect(removeDuplicateEdgeSpy).toHaveBeenCalledWith(1);
    });

    it('updateCanvasWithSingleNode should clear the canvas and add a single node', () => {
        instance.nodes = new DataSet<VisNode | GraphNode>(instance.networkGraphData.nodes);
        instance.edges = new DataSet<VisEdge | GraphRelationship>(instance.networkGraphData.edges);

        expect(instance.nodes.length).toEqual(1);
        expect(instance.edges.length).toEqual(1);

        instance.updateCanvasWithSingleNode(mockGraphNode);

        expect(instance.nodes.length).toEqual(1);
        expect(instance.edges.length).toEqual(0);
    });

    it('addDuplicatedEdge should attempt to add an edge to the set of duplicates', () => {
        instance.addDuplicatedEdge(1);
        instance.addDuplicatedEdge(1);
        instance.addDuplicatedEdge(2);

        expect(instance.duplicatedEdges.size).toEqual(2);
        expect(instance.duplicatedEdges.has(1)).toBeTrue();
        expect(instance.duplicatedEdges.has(2)).toBeTrue();
    });

    it('removeDuplicatedEdge should remove an edge from the set of duplicates', () => {
        instance.addDuplicatedEdge(1);
        instance.addDuplicatedEdge(2);

        instance.removeDuplicatedEdge(1);

        expect(instance.duplicatedEdges.size).toEqual(1);
        expect(instance.duplicatedEdges.has(1)).toBeFalse();

        instance.removeDuplicatedEdge(2);

        expect(instance.duplicatedEdges.size).toEqual(0);
        expect(instance.duplicatedEdges.has(2)).toBeFalse();
    });
});
