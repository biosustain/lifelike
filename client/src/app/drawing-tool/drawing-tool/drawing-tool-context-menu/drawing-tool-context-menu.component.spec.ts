import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { DrawingToolContextMenuControlService } from 'app/drawing-tool/services/drawing-tool-context-menu-control.service';
import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { DrawingToolContextMenuComponent } from './drawing-tool-context-menu.component';
import { IdType } from 'vis-network';

describe('DrawingToolContextMenuComponent', () => {
    let component: DrawingToolContextMenuComponent;
    let fixture: ComponentFixture<DrawingToolContextMenuComponent>;
    let drawingToolContextMenuControlService: DrawingToolContextMenuControlService;

    let mockSelectedNodeIds: IdType[];
    let mockSelectedEdgeIds: IdType[];

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RootStoreModule,
                SharedModule,
            ],
            declarations: [ DrawingToolContextMenuComponent ],
            providers: [ DrawingToolContextMenuControlService ],
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockSelectedNodeIds = [1];
        mockSelectedEdgeIds = [1];

        fixture = TestBed.createComponent(DrawingToolContextMenuComponent);
        component = fixture.componentInstance;
        drawingToolContextMenuControlService = TestBed.get<DrawingToolContextMenuControlService>(DrawingToolContextMenuControlService);

        component.selectedNodeIds = [];
        component.selectedEdgeIds = [];

        component.tooltipSelector = '#***ARANGO_USERNAME***-menu';
        component.tooltipOptions = {
            placement: 'right-start',
        };

        fixture.detectChanges();
    });

    it('should create', () => {
            expect(component).toBeTruthy();
    });

    it('should show \'Settings\' option even if no nodes or edges are selected', async () => {
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const settingsGroupElement = document.getElementById('settings-group');
            expect(settingsGroupElement).toBeTruthy();
        });
    });

    it('should show \'Remove Selected Node(s)\' if at least one node is selected', async () => {
        component.selectedNodeIds = mockSelectedNodeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const nodeSelectionGroupElement = document.getElementById('node-selection-group');
            expect(nodeSelectionGroupElement).toBeTruthy();
        });
    });

    it('should show \'Remove Selected Edge(s)\' if at least one node is selected', async () => {
        component.selectedEdgeIds = mockSelectedEdgeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const edgeSelectionGroupElement = document.getElementById('edge-selection-group');
            expect(edgeSelectionGroupElement).toBeTruthy();
        });
    });

    it('should request neighbor selection if \'Select Neighbors\' is clicked', async () => {
        const requestNeighborSelectionSpy = spyOn(component, 'requestNeighborSelection');
        component.selectedNodeIds = mockSelectedNodeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const selectNeighborsElement = document.getElementById('select-neighbors-menu-item');
            selectNeighborsElement.dispatchEvent(new Event('click'));
            expect(requestNeighborSelectionSpy).toHaveBeenCalled();
        });
    });

});
