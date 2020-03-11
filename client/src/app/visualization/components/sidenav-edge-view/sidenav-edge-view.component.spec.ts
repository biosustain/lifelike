import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ToolbarMenuModule } from 'toolbar-menu';

import { SidenavEdgeEntity } from 'app/interfaces';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { SidenavEdgeViewComponent } from './sidenav-edge-view.component';

describe('SidenavEdgeViewComponent', () => {
    let component: SidenavEdgeViewComponent;
    let fixture: ComponentFixture<SidenavEdgeViewComponent>;

    let mockSidenavEdgeEntity: SidenavEdgeEntity;

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
        mockSidenavEdgeEntity  = {
            from: {
                data: {id: 'MOCK_NODE_1_ID', name: 'Mock Node 1'},
                displayName: 'Mock Node 1',
                id: 1,
                label: 'Mock Node 1',
                subLabels: ['MockNode'],
                expanded: true,
                primaryLabel: 'MockNode',
                color: null,
            },
            to:
            {
                data: {id: 'MOCK_NODE_2_ID', name: 'Mock Node 2'},
                displayName: 'Mock Node 2',
                id: 2,
                label: 'Mock Node 2',
                subLabels: ['MockNode'],
                expanded: true,
                primaryLabel: 'MockNode',
                color: null,
            },
            association: 'Mock Association',
            references: [],
        };

        fixture = TestBed.createComponent(SidenavEdgeViewComponent);
        component = fixture.componentInstance;
        // Make a deep copy of the mock object so we get a brand new one for each test
        component.edgeEntity = mockSidenavEdgeEntity;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show edge association', () => {
        const edgeAssociationElement = document.getElementById('sidenav-edge-association');
        expect(edgeAssociationElement.innerText).toEqual('Association: Mock Association');
    });

    // From node tests

    it('should show the input from node display name', () => {
        const fromNodeDisplayNameElement = document.getElementById('sidenav-from-node-display-name');
        expect(fromNodeDisplayNameElement.innerText).toEqual('Display Name: Mock Node 1');
    });

    it('should show the input from node label', () => {
        const fromNodeLabelElement = document.getElementById('sidenav-from-node-label');
        expect(fromNodeLabelElement.innerText).toEqual('Label: MockNode');
    });

    it('should not show sub labels for from node with only one label', () => {
        component.edgeEntity.from.subLabels = ['MockNode'];
        fixture.detectChanges();

        const fromNodeSubLabelElements = document.getElementsByClassName('sidenav-from-node-sub-label');
        expect(fromNodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for from node with more than one label', () => {
        component.edgeEntity.from.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const fromNodeSubLabelElements = document.getElementsByClassName('sidenav-from-node-sub-label');
        expect(fromNodeSubLabelElements.length).toEqual(1);
        expect(fromNodeSubLabelElements[0].textContent).toEqual('ExtraSubLabel');
    });


    // To node tests

    it('should show the input to node display name', () => {
        const toNodeDisplayNameElement = document.getElementById('sidenav-to-node-display-name');
        expect(toNodeDisplayNameElement.innerText).toEqual('Display Name: Mock Node 2');
    });

    it('should show the input to node label', () => {
        const toNodeLabelElement = document.getElementById('sidenav-to-node-label');
        expect(toNodeLabelElement.innerText).toEqual('Label: MockNode');
    });

    it('should not show sub labels for to node with only one label', () => {
        component.edgeEntity.to.subLabels = ['MockNode'];
        fixture.detectChanges();

        const toNodeSubLabelElements = document.getElementsByClassName('sidenav-to-node-sub-label');
        expect(toNodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for to node with more than one label', () => {
        component.edgeEntity.to.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const toNodeSubLabelElements = document.getElementsByClassName('sidenav-to-node-sub-label');
        expect(toNodeSubLabelElements.length).toEqual(1);
        expect(toNodeSubLabelElements[0].textContent).toEqual('ExtraSubLabel');
    });

    it('should not show snippets if edge has no references', () => {
        const edgeAssociationSnippetElements = document.getElementsByClassName('sidenav-snippet');
        expect(edgeAssociationSnippetElements.length).toEqual(0);
    });
});
