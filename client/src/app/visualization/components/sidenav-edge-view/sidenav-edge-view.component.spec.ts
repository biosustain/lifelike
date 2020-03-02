import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { SidenavEdgeViewComponent } from './sidenav-edge-view.component';
import { SidenavEdgeEntity } from 'app/interfaces';

fdescribe('SidenavEdgeViewComponent', () => {
    let component: SidenavEdgeViewComponent;
    let fixture: ComponentFixture<SidenavEdgeViewComponent>;

    const mockSidenavEdgeEntity: SidenavEdgeEntity = {
        data: null,
        to: {
            data: {id: 'MOCK_NODE_1_ID', name: 'MockNode1'},
            displayName: 'Mock Node 1',
            id: 1,
            label: 'Mock Node 1',
            subLabels: ['MockNode'],
            expanded: true,
            primaryLabel: 'Mock Node',
            color: null,
        },
        from:
        {
            data: {id: 'MOCK_NODE_2_ID', name: 'MockNode2'},
            displayName: 'Mock Node 2',
            id: 2,
            label: 'Mock Node 2',
            subLabels: ['MockNode'],
            expanded: true,
            primaryLabel: 'Mock Node',
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
});
