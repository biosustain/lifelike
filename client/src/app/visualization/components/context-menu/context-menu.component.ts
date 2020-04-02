import { Component, Input, OnDestroy, Output, EventEmitter } from '@angular/core';

import { createPopper, Instance } from '@popperjs/core';

import { Subscription } from 'rxjs';
import { first, filter } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { IdType } from 'vis-network';

import { GroupRequest, Direction } from 'app/interfaces';
import { TooltipDetails } from 'app/shared/services/tooltip-control-service';
import { TooltipComponent } from 'app/shared/components/tooltip/tooltip.component';

import { ContextMenuControlService } from '../../services/context-menu-control.service';

@Component({
    selector: 'app-context-menu',
    templateUrl: './context-menu.component.html',
    styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent extends TooltipComponent implements OnDestroy {
    @Input() selectedNodeIds: IdType[];
    @Input() selectedEdgeIds: IdType[];
    // Expect this to be null if there is not exactly one node selected
    @Input() selectedNodeEdgeLabelData: Map<string, Direction[]>;

    @Output() groupNeighborsWithRelationship: EventEmitter<GroupRequest> = new EventEmitter();
    @Output() removeNodes: EventEmitter<IdType[]> = new EventEmitter();
    @Output() removeEdges: EventEmitter<IdType[]> = new EventEmitter();
    @Output() selectNeighbors: EventEmitter<IdType> = new EventEmitter();

    FADEOUT_STYLE = 'context-menu fade-out';
    DEFAULT_STYLE = 'context-menu';

    groupByRelSubmenuPopper: Instance;

    contextMenuClass: string;
    subMenuClass: string;

    subMenus: string[] = ['single-node-selection-group-1-submenu'];

    hideContextMenuSubscription: Subscription;
    updatePopperSubscription: Subscription;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {
        super();

        this.contextMenuClass = this.DEFAULT_STYLE;
        this.subMenuClass = this.DEFAULT_STYLE;

        this.hideContextMenuSubscription = this.contextMenuControlService.hideTooltip$.subscribe(hideContextMenu => {
            if (hideContextMenu) {
                this.beginContextMenuFade();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.contextMenuControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.hideContextMenuSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
        this.contextMenuClass = this.DEFAULT_STYLE;
    }

    showGroupByRelSubMenu() {
        // TODO: It would be very cool if the edges of the hovered relationship were highlighted
        this.hideAllSubMenus();
        this.contextMenuControlService.delayGroupByRel();
        this.contextMenuControlService.showGroupByRelResult$.pipe(
            first(),
            filter(showGroupByRel => showGroupByRel)
        ).subscribe(() => {
            const contextMenuItem = document.querySelector('#group-by-rel-menu-item');
            const tooltip = document.querySelector('#single-node-selection-group-1-submenu') as HTMLElement;
            tooltip.style.display = 'block';
            this.subMenuClass = this.DEFAULT_STYLE;

            if (!isNullOrUndefined(this.groupByRelSubmenuPopper)) {
                this.groupByRelSubmenuPopper.destroy();
                this.groupByRelSubmenuPopper = null;
            }
            this.groupByRelSubmenuPopper = createPopper(contextMenuItem, tooltip, {
                placement: 'right-start',
            });
        });
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    hideAllSubMenus() {
        this.contextMenuControlService.interruptGroupByRel();
        this.subMenus.forEach(subMenu => {
            const tooltip = document.querySelector(`#${subMenu}`) as HTMLElement;
            tooltip.style.display = 'none';
        });
    }

    beginContextMenuFade() {
        this.contextMenuClass = this.FADEOUT_STYLE;
        this.beginSubmenuFade();
        setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }

    beginSubmenuFade() {
        this.subMenuClass = this.FADEOUT_STYLE;
    }

    mouseLeaveNodeRow() {
        // Interrupt showing the submenu if the user hovers away from a node
        this.contextMenuControlService.interruptGroupByRel();
    }

    requestGroupByRelationship(rel: string, direction: Direction) {
        this.groupNeighborsWithRelationship.emit({
            relationship: rel,
            node: this.selectedNodeIds[0],
            direction,
        });
    }

    requestEdgeRemoval() {
        this.removeEdges.emit(this.selectedEdgeIds);
        this.beginContextMenuFade();
    }

    requestNodeRemoval() {
        this.removeNodes.emit(this.selectedNodeIds);
        this.beginContextMenuFade();
    }

    requestNeighborSelection() {
        if (this.selectedNodeIds.length !== 1) {
            alert('Can only select neighbor nodes if exactly one node is selected!');
            return;
        }
        this.selectNeighbors.emit(this.selectedNodeIds[0]);
        this.beginContextMenuFade();
    }
}
