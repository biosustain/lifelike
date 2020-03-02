import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { SidenavNodeViewComponent } from './sidenav-node-view.component';
import { SidenavNodeEntity } from 'app/interfaces';

describe('SidenavNodeViewComponent', () => {
    let component: SidenavNodeViewComponent;
    let fixture: ComponentFixture<SidenavNodeViewComponent>;

    const mockNodeEntity: SidenavNodeEntity = {
        data: {
            data: {id: 'MOCK_NODE_ID', name: 'Mock Node'},
            displayName: 'Mock Node',
            id: 1,
            label: 'Mock Node',
            subLabels: ['MockNode'],
            expanded: false,
            primaryLabel: 'MockNode',
            color: null,
        },
        edges: [],
    };

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ SidenavNodeViewComponent ]
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SidenavNodeViewComponent);
        component = fixture.componentInstance;
        component.nodeEntity = mockNodeEntity;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show the input node display name', () => {
        const nodeDisplayNameElement = document.querySelector('#sidenav-node-display-name');
        expect(nodeDisplayNameElement.innerHTML).toEqual('Display Name: Mock Node');
    });

    it('should show the input node label', () => {
        const nodeLabelElement = document.querySelector('#sidenav-node-label');
        expect(nodeLabelElement.innerHTML).toEqual('Label: MockNode');
    });

    it('should not show sub labels for node with only one label', () => {
        const nodeSubLabelElements = document.querySelectorAll('.sidenav-node-sub-label');
        expect(nodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for node with more than one label', () => {
        component.nodeEntity.data.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const nodeSubLabelElements = document.querySelectorAll('.sidenav-node-sub-label');
        expect(nodeSubLabelElements.length).toEqual(1);
        expect(nodeSubLabelElements[0].innerHTML).toEqual('ExtraSubLabel');
    });
});
