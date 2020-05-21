import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SidenavNodeEntity } from 'app/interfaces';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { SidenavNodeViewComponent } from './sidenav-node-view.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
describe('SidenavNodeViewComponent', () => {
    let component: SidenavNodeViewComponent;
    let fixture: ComponentFixture<SidenavNodeViewComponent>;

    let mockNodeEntity: SidenavNodeEntity;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [ SidenavNodeViewComponent ]
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockNodeEntity = {
            data: {
                data: {id: 'MOCK_NODE_ID', name: 'Mock Node'},
                displayName: 'Mock Node',
                id: 1,
                label: 'Mock Node',
                subLabels: ['MockNode'],
                expanded: false,
                primaryLabel: 'MockNode',
                color: null,
                font: null,
            },
            edges: [],
        };

        fixture = TestBed.createComponent(SidenavNodeViewComponent);
        component = fixture.componentInstance;
        // Make a deep copy of the mock object so we get a brand new one for each test
        component.nodeEntity = mockNodeEntity;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show the input node display name', () => {
        const nodeDisplayNameElement = document.getElementById('sidenav-node-display-name');
        expect(nodeDisplayNameElement.innerText).toEqual('Display Name: Mock Node');
    });

    it('should show the input node label', () => {
        const nodeLabelElement = document.getElementById('sidenav-node-label');
        expect(nodeLabelElement.innerText).toEqual('Label: MockNode');
    });

    it('should not show sub labels for node with only one label', () => {
        const nodeSubLabelElements = document.getElementsByClassName('sidenav-node-sub-label');
        expect(nodeSubLabelElements.length).toEqual(0);
    });

    it('should show sub labels for node with more than one label', () => {
        component.nodeEntity.data.subLabels = ['MockNode', 'ExtraSubLabel'];
        fixture.detectChanges();

        const nodeSubLabelElements = document.getElementsByClassName('sidenav-node-sub-label');
        expect(nodeSubLabelElements.length).toEqual(2);

        const labels = [];
        labels.push(nodeSubLabelElements[0].textContent);
        labels.push(nodeSubLabelElements[1].textContent);

        expect(labels).toContain('MockNode');
        expect(labels).toContain('ExtraSubLabel');
    });
});
