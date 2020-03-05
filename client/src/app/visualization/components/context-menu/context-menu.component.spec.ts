import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { SharedModule } from 'app/shared/shared.module';

import { IdType } from 'vis-network';

import { ContextMenuComponent } from './context-menu.component';

import { ContextMenuControlService } from '../../services/context-menu-control.service';

describe('ContextMenuComponent', () => {
    let component: ContextMenuComponent;
    let fixture: ComponentFixture<ContextMenuComponent>;
    let contextMenuControlService: ContextMenuControlService;

    let mockSelectedNodeIds: IdType[];
    let mockSelectedEdgeIds: IdType[];
    let mockSelectedNodeEdgeLabels: Set<string>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [SharedModule],
            declarations: [ ContextMenuComponent ],
            providers: [ContextMenuControlService],
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockSelectedNodeIds = [1];
        mockSelectedEdgeIds = [1];
        mockSelectedNodeEdgeLabels = new Set<string>(['Mock Edge 1', 'Mock Edge 2']);

        fixture = TestBed.createComponent(ContextMenuComponent);
        component = fixture.componentInstance;
        contextMenuControlService = TestBed.get<ContextMenuControlService>(ContextMenuControlService);

        component.selectedNodeIds = [];
        component.selectedEdgeIds = [];
        component.selectedNodeEdgeLabels = new Set<string>();

        component.tooltipSelector = '#root-menu';
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

    it('should show \'Group by Relationship\' option if a single node with at least one connecting edge is selected', async () => {
        component.selectedNodeIds = mockSelectedNodeIds;
        component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const groupByRelElement = document.getElementById('group-by-rel-menu-item');
            expect(groupByRelElement).toBeTruthy();
        });
    });

    // it('should show submenu when \'Group by Relationship\' is hovered', () => {
    //     // component.selectedNodeIds = mockSelectedNodeIds;
    //     // component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
    // });

    // it('should hide the contextmenu and submenus once the fade timeout completes', fakeAsync(() => {}));

    // it('should request neighbor selection if \'Select Neighbors\' is clicked', () => {});

    // it('should request node removal if \'Remove Selected Node(s)\' is clicked', () => {});

    // it('should request edge removal if \'Remove Selected Edge(s)\' is clicked', () => {});

    it('should begin tooltip fadeout when hideTooltip$ observable emits true', (() => {
        const beginContextMenuFadeSpy = spyOn(component, 'beginContextMenuFade');

        contextMenuControlService.hideTooltip();
        // referenceTableControlService.hideTooltipSource emits true
        expect(beginContextMenuFadeSpy).toHaveBeenCalled();
    }));

    it('should show tooltip when hideTooltip$ observable emits false', () => {
        const showTooltipSpy = spyOn(component, 'showTooltip');

        contextMenuControlService.showTooltip();
        // referenceTableControlService.hideTooltipSource emits false
        expect(showTooltipSpy).toHaveBeenCalled();
    });

    it('should update popper when updatePopper$ observable emits', () => {
        const updatePopperSpy = spyOn(component, 'updatePopper');

        contextMenuControlService.updatePopper(0, 0);
        // referenceTableControlService.hideTooltipSource emits {x: 0, y: 0}
        expect(updatePopperSpy).toHaveBeenCalledWith(0, 0);
    });
});
