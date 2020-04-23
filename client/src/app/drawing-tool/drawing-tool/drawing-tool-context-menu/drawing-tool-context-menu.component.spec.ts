import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { IdType } from 'vis-network';

import { CopyPasteMapsService } from 'app/drawing-tool/services/copy-paste-maps.service';
import { DrawingToolContextMenuControlService } from 'app/drawing-tool/services/drawing-tool-context-menu-control.service';

import { RootStoreModule } from 'app/***ARANGO_USERNAME***-store';
import { SharedModule } from 'app/shared/shared.module';

import { DrawingToolContextMenuComponent } from './drawing-tool-context-menu.component';

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
            providers: [
                CopyPasteMapsService,
                DrawingToolContextMenuControlService,
            ],
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

    it('should always show the \'Create Link Node from Clipboard\' option', async () => {
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const settingsGroupElement = document.getElementById('create-link-node-from-clipboard-selection-group');
            expect(settingsGroupElement).toBeTruthy();
        });
    });

    it('should request paste if \'Create Link Node from Clipboard\' is clicked', async () => {
        const createLinkNodeSpy = spyOn(component, 'requestCreateLinkNodeFromClipboard');
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const createLinkNodeElement = document.getElementById('create-link-node-menu-item');
            createLinkNodeElement.dispatchEvent(new Event('click'));
            expect(createLinkNodeSpy).toHaveBeenCalled();
        });
    });

    // TODO LL-233: Re-enable disabled tests once LL-233 is implemented
    xit('should show \'Settings\' option even if no nodes or edges are selected', async () => {
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const settingsGroupElement = document.getElementById('settings-group');
            expect(settingsGroupElement).toBeTruthy();
        });
    });

    xit('should show \'Remove Selected Node(s)\' if at least one node is selected', async () => {
        component.selectedNodeIds = mockSelectedNodeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const nodeSelectionGroupElement = document.getElementById('node-selection-group');
            expect(nodeSelectionGroupElement).toBeTruthy();
        });
    });

    xit('should show \'Remove Selected Edge(s)\' if at least one node is selected', async () => {
        component.selectedEdgeIds = mockSelectedEdgeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const edgeSelectionGroupElement = document.getElementById('edge-selection-group');
            expect(edgeSelectionGroupElement).toBeTruthy();
        });
    });

    xit('should request neighbor selection if \'Select Neighbors\' is clicked', async () => {
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
