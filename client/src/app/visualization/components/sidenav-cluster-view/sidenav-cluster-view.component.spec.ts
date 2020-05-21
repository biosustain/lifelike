import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import {
    AssociationSnippet,
    Publication,
    Reference,
    SidenavEdgeEntity,
    SidenavClusterEntity
} from 'app/interfaces';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';

import { SidenavClusterViewComponent } from './sidenav-cluster-view.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('SidenavClusterViewComponent', () => {
    let component: SidenavClusterViewComponent;
    let fixture: ComponentFixture<SidenavClusterViewComponent>;

    let mockSidenavEdgeEntity: SidenavEdgeEntity;
    let mockAssociationSnippets: AssociationSnippet[];
    let mockPublication: Publication;
    let mockReference: Reference;
    let mockClusterEntity: SidenavClusterEntity;

    let mockLegend: Map<string, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [ SidenavClusterViewComponent ]
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockPublication = {
            id: 3,
            label: 'Mock Publication',
            data: {
                journal: 'Mock Journal',
                title: 'Mock Title',
                pmid: '123456',
                pubYear: 9999,
            },
            subLabels: [],
            displayName: 'Mock Publication Display Name',
         } as Publication;

        mockReference = {
            id: 4,
            label: 'Mock Reference',
            data: {
                entry1Text: 'Mock Entry 1',
                entry2Text: 'Mock Entry 2',
                id: 'mockReferenceId1',
                score: 0,
                sentence: 'Mock Sentence',
            },
            subLabels: [],
            displayName: 'Mock Reference Display Name',
        } as Reference;

        mockAssociationSnippets = [
            {
                publication: mockPublication,
                reference: mockReference,
            }
        ];

        mockSidenavEdgeEntity  = {
            from: {
                data: {id: 'MOCK_NODE_1_ID', name: 'Mock Node 1'},
                displayName: 'Mock Node 1',
                id: 1,
                label: 'Mock Node 1',
                subLabels: ['MockNode1'],
                expanded: true,
                primaryLabel: 'MockNode1',
                color: null,
                font: null,
            },
            to:
            {
                data: {id: 'MOCK_NODE_2_ID', name: 'Mock Node 2'},
                displayName: 'Mock Node 2',
                id: 2,
                label: 'Mock Node 2',
                subLabels: ['MockNode2'],
                expanded: true,
                primaryLabel: 'MockNode2',
                color: null,
                font: null,
            },
            association: 'Mock Association',
            snippets: mockAssociationSnippets,
        };

        mockClusterEntity  = {
            includes: [
                {
                    id: 1,
                    displayName: 'Mock Node 1',
                    color: null,
                    font: null,
                    label: null,
                    data: null,
                    subLabels: null,
                },
                {
                    id: 2,
                    displayName: 'Mock Node 2',
                    color: null,
                    font: null,
                    label: null,
                    data: null,
                    subLabels: null,
                },
                {
                    id: 3,
                    displayName: 'Mock Node 3',
                    color: null,
                    font: null,
                    label: null,
                    data: null,
                    subLabels: null,
                },
            ],
            clusterGraphData: {
                results: {
                    1: {
                        'mock-edge-1': 1,
                    },
                    2: {
                        'mock-edge-2': 4,
                    },
                    3: {
                        'mock-edge-3': 2,
                    },
                }
            },
            clusterSnippetData: [mockSidenavEdgeEntity],
        };

        mockLegend = new Map<string, string[]>([
            ['MockNode1', ['#CD5D67', '#410B13']],
            ['MockNode2', ['#8FA6CB', '#7D84B2']],
        ]);

        fixture = TestBed.createComponent(SidenavClusterViewComponent);
        component = fixture.componentInstance;

        component.legend = mockLegend;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should setup labels and create chart when data comes in', () => {
        spyOn(component, 'getAllLabels');
        spyOn(component, 'createChart');

        component.clusterEntity = mockClusterEntity;
        fixture.detectChanges();

        expect(component.getAllLabels).toHaveBeenCalledWith(mockClusterEntity);
        expect(component.createChart).toHaveBeenCalledWith(mockClusterEntity);
    });

    it('getAllLabels should get labels from cluster entity', () => {
        component.getAllLabels(mockClusterEntity);
        expect(component.labels).toEqual(['mock-edge-1', 'mock-edge-2', 'mock-edge-3']);
    });

    it('createChart should create a highcharts barchart', () => {
        component.getAllLabels(mockClusterEntity);
        component.createChart(mockClusterEntity);
        expect(component.clusterDataChart).toBeTruthy();
    });
});
