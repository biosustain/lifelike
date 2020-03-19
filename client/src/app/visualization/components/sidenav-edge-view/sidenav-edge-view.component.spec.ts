import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ToolbarMenuModule } from 'toolbar-menu';

import { AssociationSnippet, Publication, Reference, SidenavEdgeEntity } from 'app/interfaces';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { SidenavEdgeViewComponent } from './sidenav-edge-view.component';

describe('SidenavEdgeViewComponent', () => {
    let component: SidenavEdgeViewComponent;
    let fixture: ComponentFixture<SidenavEdgeViewComponent>;

    let mockSidenavEdgeEntity: SidenavEdgeEntity;
    let mockAssociationSnippets: AssociationSnippet[];
    let mockPublication: Publication;
    let mockReference: Reference;

    let mockLegend: Map<string, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                ToolbarMenuModule,
            ],
            declarations: [ SidenavEdgeViewComponent ]
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
            },
            association: 'Mock Association',
            snippets: mockAssociationSnippets,
        };

        mockLegend = new Map<string, string[]>([
            ['MockNode1', ['#CD5D67', '#410B13']],
            ['MockNode2', ['#8FA6CB', '#7D84B2']],
        ]);

        fixture = TestBed.createComponent(SidenavEdgeViewComponent);
        component = fixture.componentInstance;

        // Make a deep copy of the mock object so we get a brand new one for each test
        component.edgeEntity = mockSidenavEdgeEntity;
        component.legend = mockLegend;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load snippet panels', () => {
        const snippetPanels = document.getElementsByClassName('association-snippet-panel');

        expect(snippetPanels.length).toEqual(1);
    });

    it('should show publication data on snippet panels', () => {
        const snippetPanelTitles = document.getElementsByClassName('association-snippet-title');
        const snippetPanelPubData = document.getElementsByClassName('association-snippet-pub-data');

        expect(snippetPanelTitles.length).toEqual(1);
        expect(snippetPanelPubData.length).toEqual(1);

        const title = snippetPanelTitles[0];
        const pubData = snippetPanelPubData[0];

        expect(title.textContent).toEqual('Mock Title');
        expect(pubData.textContent).toEqual('Mock Journal (9999)');
    });

    it('should link to pubmed', () => {
        const pubmedLinks = document.getElementsByClassName('pubmed-link');

        expect(pubmedLinks.length).toEqual(1);

        const link = pubmedLinks[0];

        expect(link.getAttribute('href')).toEqual('https://pubmed.ncbi.nlm.nih.gov/123456/');
        expect(link.textContent).toEqual('123456launch'); // 'launch' is here because of the mat-icon
    });
});
