import { Component, Input, OnDestroy, Output, EventEmitter } from '@angular/core';

import { createPopper, Instance } from '@popperjs/core';

import { Subscription } from 'rxjs';

import { isNullOrUndefined } from 'util';

import { IdType } from 'vis-network';

import { GroupRequest } from 'app/interfaces';
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
    // Expect this to be empty if there is not exactly one node selected
    @Input() selectedNodeEdgeLabels: Set<string>;

    @Output() groupNeighborsWithRelationship: EventEmitter<GroupRequest> = new EventEmitter();
    @Output() removeNodes: EventEmitter<IdType[]> = new EventEmitter();
    @Output() removeEdges: EventEmitter<IdType[]> = new EventEmitter();

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

        this.selectedNodeEdgeLabels = new Set<string>();
    }

    ngOnDestroy() {
        this.hideContextMenuSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
        this.popper.destroy();
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
        this.contextMenuClass = this.DEFAULT_STYLE;
    }

    showGroupByRelSubMenu() {
        // TODO: Would be nice to add some kind of delay here, but it also has to be interruptible.
        // TODO: It would be very cool if the edges of the hovered relationship were highlighted
        this.hideAllSubMenus();

        const contextMenuItem = document.querySelector('#group-by-rel-menu-item');
        const tooltip = document.querySelector('#single-node-selection-group-1-submenu') as HTMLElement;
        tooltip.style.display = 'block';
        this.subMenuClass = this.DEFAULT_STYLE;

        if (!isNullOrUndefined(this.groupByRelSubmenuPopper)) {
            this.groupByRelSubmenuPopper.destroy();
            this.groupByRelSubmenuPopper = null;
        }
        this.groupByRelSubmenuPopper = createPopper(contextMenuItem, tooltip, {
            modifiers: [
                {
                    name: 'offset',
                    options: {
                        offset: [0, 0],
                    },
                },
            ],
            placement: 'right-start',
        });
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    hideAllSubMenus() {
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

    requestGroupByRelationship(rel: string) {
        this.groupNeighborsWithRelationship.emit({relationship: rel, node: this.selectedNodeIds[0]});
        this.selectedNodeEdgeLabels.delete(rel);
    }

    requestEdgeRemoval() {
        this.removeEdges.emit(this.selectedEdgeIds);
        this.beginContextMenuFade();
    }

    requestNodeRemoval() {
        this.removeNodes.emit(this.selectedNodeIds);
        this.beginContextMenuFade();
    }

    // TODO: Would be cool to have a "Select Neighbors" feature on the context menu
    // (Though I suppose we can enable this by default with vis.js...)
}
