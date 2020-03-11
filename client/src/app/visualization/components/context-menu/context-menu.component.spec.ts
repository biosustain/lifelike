import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { IdType } from 'vis-network';

import { SharedModule } from 'app/shared/shared.module';

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

    it('should show submenu when \'Group by Relationship\' is hovered', async () => {
        const showGroupByRelSubMenuSpy = spyOn(component, 'showGroupByRelSubMenu');
        component.selectedNodeIds = mockSelectedNodeIds;
        component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const groupByRelRowElement = document.getElementById('group-by-rel-menu-item');
            groupByRelRowElement.dispatchEvent(new Event('mouseenter'));
            expect(showGroupByRelSubMenuSpy).toHaveBeenCalled();
        });
    });

    it('should show grouping submenu after a delay', async () => {
        jasmine.clock().install();

        const delayGroupByRelSpy = spyOn(contextMenuControlService, 'delayGroupByRel').and.callThrough();
        component.selectedNodeIds = mockSelectedNodeIds;
        component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(async () => {
            component.showGroupByRelSubMenu();
            expect(delayGroupByRelSpy).toHaveBeenCalled();

            // wait for the delay to expire
            jasmine.clock().tick(250);

            fixture.detectChanges();
            await fixture.whenStable().then(() => {
                const groupByRelSubmenuElement = document.getElementById('single-node-selection-group-1-submenu');
                expect(groupByRelSubmenuElement.style.display).toBe('block');

                jasmine.clock().uninstall();
            });
        });
    });

    it('should interrupt showing the group by relationship submenu if the user hovers away', async () => {
        const mouseLeaveNodeRowSpy = spyOn(component, 'mouseLeaveNodeRow').and.callThrough();
        const interruptGroupByRelSpy = spyOn(contextMenuControlService, 'interruptGroupByRel');
        component.selectedNodeIds = mockSelectedNodeIds;
        component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const groupByRelRowElement = document.getElementById('group-by-rel-menu-item');
            groupByRelRowElement.dispatchEvent(new Event('mouseleave'));

            expect(mouseLeaveNodeRowSpy).toHaveBeenCalled();
            expect(interruptGroupByRelSpy).toHaveBeenCalled();
        });
    });

    it('should not show the group by relationship submenu if an interrupt is sent', async () => {
        jasmine.clock().install();

        const delayGroupByRelSpy = spyOn(contextMenuControlService, 'delayGroupByRel').and.callThrough();
        component.selectedNodeIds = mockSelectedNodeIds;
        component.selectedNodeEdgeLabels = mockSelectedNodeEdgeLabels;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(async () => {
            component.showGroupByRelSubMenu();
            expect(delayGroupByRelSpy).toHaveBeenCalled();

            // wait a bit before interrupting
            jasmine.clock().tick(50);
            contextMenuControlService.interruptGroupByRel();
            // wait for the remainder of the normal delay time
            jasmine.clock().tick(155);

            fixture.detectChanges();
            await fixture.whenStable().then(() => {
                const groupByRelSubmenuElement = document.getElementById('single-node-selection-group-1-submenu');
                expect(groupByRelSubmenuElement.style.display).toBe('none');
                jasmine.clock().uninstall();
            });
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

    it('should request node removal if \'Remove Selected Node(s)\' is clicked', async () => {
        const requestNodeRemovalSpy = spyOn(component, 'requestNodeRemoval');
        component.selectedNodeIds = mockSelectedNodeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const removeSelectedNodesElement = document.getElementById('remove-selected-nodes-menu-item');
            removeSelectedNodesElement.dispatchEvent(new Event('click'));
            expect(requestNodeRemovalSpy).toHaveBeenCalled();
        });
    });

    it('should request edge removal if \'Remove Selected Edge(s)\' is clicked', async () => {
        const requestEdgeRemovalSpy = spyOn(component, 'requestEdgeRemoval');
        component.selectedEdgeIds = mockSelectedEdgeIds;
        component.showTooltip();
        fixture.detectChanges();

        await fixture.whenStable().then(() => {
            const removeSelectedEdgesElement = document.getElementById('remove-selected-edges-menu-item');
            removeSelectedEdgesElement.dispatchEvent(new Event('click'));
            expect(requestEdgeRemovalSpy).toHaveBeenCalled();
        });
    });

    it('should begin tooltip fadeout when hideTooltip$ observable emits true', () => {
        const beginContextMenuFadeSpy = spyOn(component, 'beginContextMenuFade').and.callFake(
            // Create a fake implementation of beginContextMenuFade so we don't use the timeout in the original implementation
            () => {
                component.contextMenuClass = component.FADEOUT_STYLE;
                component.beginSubmenuFade();
            }
        );
        const beginSubmenuFadeSpy = spyOn(component, 'beginSubmenuFade');
        contextMenuControlService.hideTooltip();

        // contextMenuControlService.hideTooltipSource emits true
        expect(beginContextMenuFadeSpy).toHaveBeenCalled();
        expect(beginSubmenuFadeSpy).toHaveBeenCalled();
    });

    it('should hide the contextmenu and submenus once the fade timeout completes', fakeAsync(() => {
        const hideTooltipSpy = spyOn(component, 'hideTooltip').and.callThrough();
        const hideAllSubMenusSpy = spyOn(component, 'hideAllSubMenus');
        component.beginContextMenuFade();

        flush();

        expect(hideTooltipSpy).toHaveBeenCalled();
        expect(hideAllSubMenusSpy).toHaveBeenCalled();
    }));

    it('should show tooltip when hideTooltip$ observable emits false', () => {
        const showTooltipSpy = spyOn(component, 'showTooltip');

        contextMenuControlService.showTooltip();
        // contextMenuControlService.hideTooltipSource emits false
        expect(showTooltipSpy).toHaveBeenCalled();
    });

    it('should update popper when updatePopper$ observable emits', () => {
        const updatePopperSpy = spyOn(component, 'updatePopper');

        contextMenuControlService.updatePopper(0, 0);
        // contextMenuControlService.hideTooltipSource emits {x: 0, y: 0}
        expect(updatePopperSpy).toHaveBeenCalledWith(0, 0);
    });
});
