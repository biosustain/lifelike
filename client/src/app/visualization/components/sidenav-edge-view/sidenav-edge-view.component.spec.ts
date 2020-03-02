import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { SidenavEdgeViewComponent } from './sidenav-edge-view.component';
import { SidenavEdgeEntity } from 'app/interfaces';

fdescribe('SidenavEdgeViewComponent', () => {
    let component: SidenavEdgeViewComponent;
    let fixture: ComponentFixture<SidenavEdgeViewComponent>;

    const mockSidenavEdgeEntity: SidenavEdgeEntity = {
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

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ SidenavEdgeViewComponent ]
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SidenavEdgeViewComponent);
        component = fixture.componentInstance;
        component.edgeEntity = mockSidenavEdgeEntity;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show edge association', () => {
        const edgeAssociationElement = document.querySelector('#sidenav-edge-association');
        expect(edgeAssociationElement.innerHTML).toEqual('Association: Mock Association');
    });

    // From node tests

    it('should show the input from node display name', () => {
        const fromNodeDisplayNameElement = document.querySelector('#sidenav-from-node-display-name');
        expect(fromNodeDisplayNameElement.innerHTML).toEqual('Display Name: Mock Node 1');
    });

    it('should show the input from node label', () => {
        const fromNodeLabelElement = document.querySelector('#sidenav-from-node-label');
        expect(fromNodeLabelElement.innerHTML).toEqual('Label: MockNode');
    });

    it('should not show sub labels for from node with only one label', () => {
        component.edgeEntity.from.subLabels = ['MockNode'];
        fixture.detectChanges();

        const fromNodeSubLabelElements = document.querySelectorAll('.sidenav-from-node-sub-label');
        expect(fromNodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for from node with more than one label', () => {
        component.edgeEntity.from.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const fromNodeSubLabelElements = document.querySelectorAll('.sidenav-from-node-sub-label');
        expect(fromNodeSubLabelElements.length).toEqual(1);
        expect(fromNodeSubLabelElements[0].innerHTML).toEqual('ExtraSubLabel');
    });


    // To node tests

    it('should show the input to node display name', () => {
        const toNodeDisplayNameElement = document.querySelector('#sidenav-to-node-display-name');
        expect(toNodeDisplayNameElement.innerHTML).toEqual('Display Name: Mock Node 2');
    });

    it('should show the input to node label', () => {
        const toNodeLabelElement = document.querySelector('#sidenav-to-node-label');
        expect(toNodeLabelElement.innerHTML).toEqual('Label: MockNode');
    });

    it('should not show sub labels for to node with only one label', () => {
        component.edgeEntity.to.subLabels = ['MockNode'];
        fixture.detectChanges();

        const toNodeSubLabelElements = document.querySelectorAll('.sidenav-to-node-sub-label');
        expect(toNodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for to node with more than one label', () => {
        component.edgeEntity.to.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const toNodeSubLabelElements = document.querySelectorAll('.sidenav-to-node-sub-label');
        expect(toNodeSubLabelElements.length).toEqual(1);
        expect(toNodeSubLabelElements[0].innerHTML).toEqual('ExtraSubLabel');
    });

    it('should not show snippets if edge has no references', () => {
        const edgeAssociationSnippetElements = document.querySelectorAll('.sidenav-snippet');
        expect(edgeAssociationSnippetElements.length).toEqual(0);
    });
});
