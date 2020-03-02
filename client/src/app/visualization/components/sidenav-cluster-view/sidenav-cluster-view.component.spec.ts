import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SidenavClusterEntity } from 'app/interfaces';
import { SharedModule } from 'app/shared/shared.module';

import { SidenavClusterViewComponent } from './sidenav-cluster-view.component';

describe('SidenavClusterViewComponent', () => {
    let component: SidenavClusterViewComponent;
    let fixture: ComponentFixture<SidenavClusterViewComponent>;

    const mockClusterEntity: SidenavClusterEntity = {
        includes: [
            {
                id: 1,
                displayName: 'Mock Node 1',
                color: null,
                label: null,
                data: null,
                subLabels: null,
            },
            {
                id: 2,
                displayName: 'Mock Node 2',
                color: null,
                label: null,
                data: null,
                subLabels: null,
            },
            {
                id: 3,
                displayName: 'Mock Node 3',
                color: null,
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
    };

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ SidenavClusterViewComponent ]
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SidenavClusterViewComponent);
        component = fixture.componentInstance;
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
