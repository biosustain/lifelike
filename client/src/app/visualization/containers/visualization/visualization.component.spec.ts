import { TestBed, ComponentFixture } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { GraphNode, GraphRelationship, Neo4jResults } from 'app/interfaces';
import { SharedModule } from 'app/shared/shared.module';

import { VisualizationComponent } from './visualization.component';

import { VisualizationService } from '../../services/visualization.service';
import { ContextMenuComponent } from '../../components/context-menu/context-menu.component';
import { ReferenceTableComponent } from '../../components/reference-table/reference-table.component';
import { SidenavClusterViewComponent } from '../../components/sidenav-cluster-view/sidenav-cluster-view.component';
import { SidenavEdgeViewComponent } from '../../components/sidenav-edge-view/sidenav-edge-view.component';
import { SidenavNodeViewComponent } from '../../components/sidenav-node-view/sidenav-node-view.component';
import { VisualizationCanvasComponent } from '../../components/visualization-canvas/visualization-canvas.component';
import { VisualizationQuickbarComponent } from '../../components/visualization-quickbar/visualization-quickbar.component';
import { VisualizationSearchComponent } from '../../containers/visualization-search/visualization-search.component';

describe('VisualizationComponent', () => {
    let fixture: ComponentFixture<VisualizationComponent>;
    let instance: VisualizationComponent;

    let mockGraphNode: GraphNode;
    let mockGraphRelationship: GraphRelationship;
    let mockNeo4jResults: Neo4jResults;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
            ],
            declarations: [
                ContextMenuComponent,
                ReferenceTableComponent,
                SidenavClusterViewComponent,
                SidenavEdgeViewComponent,
                SidenavNodeViewComponent,
                VisualizationComponent,
                VisualizationCanvasComponent,
                VisualizationQuickbarComponent,
                VisualizationSearchComponent,
            ],
            providers: [VisualizationService],
        });
    });

    beforeEach(() => {
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

        fixture = TestBed.createComponent(VisualizationComponent);
        instance = fixture.debugElement.componentInstance;

        instance.legend.set('Mock Node', ['#FFFFFF', '#FFFFFF']);
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
});
