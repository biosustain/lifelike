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
});
